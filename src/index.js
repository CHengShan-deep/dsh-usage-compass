/**
 * dsh-usage-statistics — host half.
 *
 * Scans this machine's DSH session logs for real provider usage (the
 * `assistant/chunk` usage events), aggregates it by day / workspace / session /
 * model, and reports the balance of the active provider:
 *
 *   - OpenCode Go  GET https://opencode.ai/zen/go/v1/usage
 *   - DeepSeek     GET https://api.deepseek.com/user/balance
 *
 * The browser half only calls this route. API keys never leave this process.
 *
 *   GET /plugins/dsh-usage-statistics/data?range=7d|30d|all&force=1
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { opencodeGoCost, deepseekOfficialCost } from './pricing.js'
import { createSourceStore, BUILTIN_SOURCE_ID, BUILTIN_SOURCE_LABEL } from './sources.js'
export { createSourceStore } from './sources.js'

const require = createRequire(import.meta.url)
const PLUGIN_VERSION = require('../package.json').version

/** Cordis function-plugin name. */
export const name = 'dsh-usage-statistics'

/** The HTTP route carrier. Every other service is optional. */
export const inject = ['webServer']

/** Browser-facing route. */
export const ROUTE = '/plugins/dsh-usage-statistics/data'
/** Local ingestion route for other plugins, MCP bridges and helper scripts. */
export const INGEST_ROUTE = '/plugins/dsh-usage-statistics/ingest'
/** Source inventory route. */
export const SOURCES_ROUTE = '/plugins/dsh-usage-statistics/sources'
/** Switch the default model provider from a provider card. */
export const ACTIVATE_ROUTE = '/plugins/dsh-usage-statistics/activate-provider'

const DEFAULTS = Object.freeze({
  refreshSeconds: 5,
  balanceSeconds: 30,
  requestsLimit: 5000,
  pricing: {},
  ingestToken: '',
})

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance'
const OPENCODE_USAGE_URL = 'https://opencode.ai/zen/go/v1/usage'
const OPENCODE_WINDOWS = ['rolling', 'weekly', 'monthly']
const TIMEOUT_MS = 8_000

/* ------------------------------------------------------------------------- *
 * zstd JSONL
 * ------------------------------------------------------------------------- */

/**
 * Find the end of one Zstandard frame without decompressing it.
 * @param {Buffer} buf - file bytes.
 * @param {number} start - frame magic offset.
 * @returns {number} offset just past the frame.
 */
function zstdFrameEnd(buf, start) {
  const fhd = buf[start + 4]
  const fcsFlag = fhd >> 6
  const singleSegment = (fhd >> 5) & 1
  const hasChecksum = (fhd >> 2) & 1
  const dictFlag = fhd & 3
  let p = start + 5
  if (!singleSegment) p += 1
  p += dictFlag === 0 ? 0 : dictFlag === 1 ? 1 : dictFlag === 2 ? 2 : 4
  p += fcsFlag === 0 ? (singleSegment ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8
  for (;;) {
    const header = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)
    p += 3
    const last = header & 1
    const type = (header >> 1) & 3
    const size = header >> 3
    if (type === 0) p += size
    else if (type === 1) p += 1
    else if (type === 2) p += size
    else throw new Error('reserved zstd block type')
    if (last) break
  }
  if (hasChecksum) p += 4
  return p
}

/**
 * Decode a `.jsonl.zstd` file. DSH appends one Zstandard frame per write, and
 * Node's one-shot decoder stops after the first frame, so frames are split and
 * decoded individually.
 * @param {Buffer} bytes - complete file.
 * @returns {string} concatenated JSONL text.
 */
export function decompressZstdFrames(bytes) {
  if (typeof zlib.zstdDecompressSync !== 'function') {
    throw new Error('this Node.js has no zstd decoder')
  }
  const parts = []
  let offset = 0
  while (offset < bytes.length) {
    if (bytes.readUInt32LE(offset) !== 0xfd2fb528) {
      throw new Error(`bad zstd magic at byte ${offset}`)
    }
    const end = zstdFrameEnd(bytes, offset)
    if (end <= offset || end > bytes.length) throw new Error('truncated zstd frame')
    parts.push(zlib.zstdDecompressSync(bytes.subarray(offset, end)))
    offset = end
  }
  return Buffer.concat(parts).toString('utf8')
}

/**
 * Decode the complete frames of a log that may be mid-append. A truncated
 * trailing frame is ignored so the already-written events remain readable.
 * @param {Buffer} bytes - complete or partially written file.
 * @returns {string} concatenated JSONL text from complete frames.
 */
export function decompressZstdFramesTolerant(bytes) {
  if (typeof zlib.zstdDecompressSync !== 'function') {
    throw new Error('this Node.js has no zstd decoder')
  }
  const parts = []
  let offset = 0
  while (offset + 8 <= bytes.length) {
    if (bytes.readUInt32LE(offset) !== 0xfd2fb528) break
    let end
    try {
      end = zstdFrameEnd(bytes, offset)
      if (end <= offset || end > bytes.length) break
      parts.push(zlib.zstdDecompressSync(bytes.subarray(offset, end)))
    } catch {
      break
    }
    offset = end
  }
  return Buffer.concat(parts).toString('utf8')
}

/**
 * Read one session log, plain or Zstandard-compressed.
 * @param {string} file - absolute log path.
 * @returns {Promise<string>} JSONL text.
 */
export async function readSessionLog(file) {
  const bytes = await fs.readFile(file)
  return file.endsWith('.zstd') ? decompressZstdFramesTolerant(bytes) : bytes.toString('utf8')
}

/* ------------------------------------------------------------------------- *
 * Session parsing
 * ------------------------------------------------------------------------- */

/** Resolve the harness home directory. */
export function resolveDshHome() {
  const configured = typeof process.env.DSH_HOME === 'string' ? process.env.DSH_HOME.trim() : ''
  return configured !== '' ? path.resolve(configured) : path.join(os.homedir(), '.dsh')
}

/** Pick the newest canonical session log filename. */
function pickLogFile(names) {
  let best = null
  for (const name of names) {
    const match = /^session(?:\.v(\d+))?\.jsonl(\.zstd)?$/.exec(name)
    if (match === null) continue
    const version = match[1] === undefined ? 0 : Number(match[1])
    const zstd = match[2] === '.zstd' ? 1 : 0
    if (best === null || version > best.version || (version === best.version && zstd > best.zstd)) {
      best = { name, version, zstd }
    }
  }
  return best?.name ?? null
}

/** Extract a printable first prompt from a user message event. */
function firstText(content) {
  if (!Array.isArray(content)) return ''
  for (const block of content) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      return block.text.replace(/\s+/g, ' ').trim().slice(0, 120)
    }
  }
  return ''
}

/**
 * Parse one session log into metadata plus one record per real API response.
 * Summing `assistant/chunk` usage events reproduces DSH's own token totals.
 * @param {string} text - JSONL contents.
 * @param {string} fallbackId - directory-derived session id.
 * @returns {object} parsed session.
 */
export function parseSessionText(text, fallbackId) {
  const session = {
    id: fallbackId,
    createdAt: 0,
    cwd: '',
    title: '',
    firstPrompt: '',
    turns: 0,
    requests: [],
  }
  let provider = 'unknown'
  let model = 'unknown'
  /** One record per turn/step; the final message usage wins over stream chunks. */
  const usageByStep = new Map()
  const rememberUsage = (usage, at, eventData) => {
    const input = number(usage.inputTokens)
    const output = number(usage.outputTokens)
    const cacheRead = number(usage.cacheReadTokens)
    const cacheWrite = number(usage.cacheWriteTokens)
    if (input + output + cacheRead + cacheWrite === 0) return
    usageByStep.set(`${eventData.turn ?? 0}:${eventData.step ?? 0}`, {
      time: at,
      turn: typeof eventData.turn === 'number' ? eventData.turn : 0,
      step: typeof eventData.step === 'number' ? eventData.step : 0,
      provider,
      model,
      input,
      output,
      cacheRead,
      cacheWrite,
      reasoning: number(usage.reasoningTokens),
    })
  }
  for (const line of text.split('\n')) {
    if (line === '') continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    const time = typeof event.time === 'number' ? event.time : 0
    const data = event.data !== null && typeof event.data === 'object' ? event.data : {}
    switch (event.type) {
      case 'session': {
        const id = typeof event.id === 'string' ? event.id : data.id
        const cwd = typeof event.cwd === 'string' ? event.cwd : data.cwd
        if (typeof id === 'string' && id !== '') session.id = id
        if (typeof event.createdAt === 'number') session.createdAt = event.createdAt
        if (typeof cwd === 'string') session.cwd = cwd
        break
      }
      case 'session/title': {
        if (typeof data.title === 'string' && data.title !== '') session.title = data.title
        break
      }
      case 'turn/start': {
        if (typeof data.turn === 'number') session.turns = Math.max(session.turns, data.turn)
        break
      }
      case 'user/message': {
        if (session.firstPrompt === '') session.firstPrompt = firstText(data.content)
        break
      }
      case 'request/header': {
        const config = data.header?.config
        if (config !== null && typeof config === 'object') {
          if (typeof config.provider === 'string') provider = config.provider
          if (typeof config.model === 'string') model = config.model
        }
        break
      }
      case 'request/context': {
        if (typeof data.provider === 'string') provider = data.provider
        if (typeof data.model === 'string') model = data.model
        break
      }
      case 'assistant/chunk': {
        const chunk = data.chunk
        if (chunk === null || typeof chunk !== 'object' || chunk.type !== 'usage') break
        const usage = chunk.usage
        if (usage === null || typeof usage !== 'object') break
        rememberUsage(usage, time, data)
        break
      }
      case 'assistant/message': {
        const usage = data.usage
        if (usage === null || typeof usage !== 'object') break
        rememberUsage(usage, time, data)
        break
      }
      default:
        break
    }
  }
  session.requests = [...usageByStep.values()].sort((left, right) => left.time - right.time)
  if (session.createdAt === 0 && session.requests.length > 0) session.createdAt = session.requests[0].time
  if (session.turns === 0) session.turns = session.requests.reduce((max, item) => Math.max(max, item.turn), 0)
  if (session.title === '') session.title = session.firstPrompt
  return session
}

/** Coerce a token field to a finite non-negative integer. */
function number(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * Fill metadata and, when a log recorded no usage events at all, the session's
 * own token projection. Older logs carry usage on `assistant/chunk`; newer ones
 * carry the final usage on `assistant/message`. A session that has neither can
 * still be read from the projection cache DSH writes beside the log.
 * @param {object} session - parsed session, mutated in place.
 * @param {string} projectionRoot - `storages/session_projcache/sessions`.
 * @returns {Promise<void>}
 */
async function hydrateProjection(session, projectionRoot) {
  const candidates = [path.join(projectionRoot, `${session.id}.json`)]
  if (session.logPath !== undefined) {
    candidates.push(path.join(projectionRoot, `${path.basename(path.dirname(session.logPath))}.json`))
  }
  for (const file of candidates) {
    let projection
    try {
      projection = JSON.parse(await fs.readFile(file, 'utf8'))
    } catch {
      continue
    }
    const record = projection?.record
    const rows = record?.rows
    if (rows === null || typeof rows !== 'object') continue
    if (session.cwd === '' && typeof record.identity?.cwd === 'string') session.cwd = record.identity.cwd
    if (session.createdAt === 0 && typeof record.identity?.createdAt === 'number') session.createdAt = record.identity.createdAt
    if (session.title === '' && typeof rows.title?.val === 'string') session.title = rows.title.val
    if (session.requests.length > 0) return
    const totals = rows.tokenUsage?.val?.totals
    if (totals === null || typeof totals !== 'object') return
    const input = number(totals.uncachedInputTokens)
    const output = number(totals.outputTokens)
    const cacheRead = number(totals.cacheReadTokens)
    const cacheWrite = number(totals.cacheWriteTokens)
    if (input + output + cacheRead + cacheWrite === 0) return
    const selection = rows.modelSelection?.val?.lastUsed
    const stats = rows.sessionStats?.val
    const lastAt =
      (typeof rows.sessionListMetadata?.val?.lastPromptAt === 'number' ? rows.sessionListMetadata.val.lastPromptAt : 0) ||
      session.createdAt ||
      Date.now()
    session.requests.push({
      time: lastAt,
      turn: typeof stats?.lastTurn === 'number' ? stats.lastTurn : 0,
      step: typeof stats?.steps === 'number' ? stats.steps : 0,
      provider: typeof selection?.provider === 'string' ? selection.provider : 'unknown',
      model: typeof selection?.model === 'string' ? selection.model : 'unknown',
      input,
      output,
      cacheRead,
      cacheWrite,
      reasoning: 0,
      synthetic: true,
    })
    return
  }
}

/**
 * Walk `<home>/sessions/<workspace>/<session>/session*.jsonl[.zstd]`.
 * Results are cached by file signature so a refresh only reparses the sessions
 * that actually changed.
 * @param {string} root - sessions root.
 * @param {Map<string, {signature: string, session: object}>} cache - per-file cache.
 * @returns {Promise<{sessions: object[], scanned: number, errors: object[]}>}
 */
export async function scanSessions(root, cache, options = {}) {
  const projectionRoot = options.projectionRoot ?? path.join(path.dirname(root), 'storages', 'session_projcache', 'sessions')
  const sessions = []
  const errors = []
  let scanned = 0
  let workspaceDirs = []
  try {
    workspaceDirs = await fs.readdir(root, { withFileTypes: true })
  } catch (error) {
    return { sessions, scanned, errors: [{ file: root, message: error instanceof Error ? error.message : String(error) }] }
  }
  for (const workspace of workspaceDirs) {
    if (!workspace.isDirectory()) continue
    const workspacePath = path.join(root, workspace.name)
    let sessionDirs = []
    try {
      sessionDirs = await fs.readdir(workspacePath, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of sessionDirs) {
      if (!entry.isDirectory()) continue
      const sessionPath = path.join(workspacePath, entry.name)
      let names = []
      try {
        names = await fs.readdir(sessionPath)
      } catch {
        continue
      }
      const logName = pickLogFile(names)
      if (logName === null) continue
      const file = path.join(sessionPath, logName)
      let stat
      try {
        stat = await fs.stat(file)
      } catch {
        continue
      }
      const signature = `${stat.mtimeMs}:${stat.size}`
      const cached = cache.get(file)
      if (cached !== undefined && cached.signature === signature) {
        sessions.push(cached.session)
        continue
      }
      try {
        const text = await readSessionLog(file)
        const session = parseSessionText(text, entry.name)
        session.logPath = file
        await hydrateProjection(session, projectionRoot)
        cache.set(file, { signature, session })
        sessions.push(session)
        scanned += 1
      } catch (error) {
        if (errors.length < 20) {
          errors.push({ file, message: error instanceof Error ? error.message : String(error) })
        }
      }
    }
  }
  return { sessions, scanned, errors }
}

/* ------------------------------------------------------------------------- *
 * Aggregation
 * ------------------------------------------------------------------------- */

/** Allowed preset ranges and their day counts. */
const RANGE_DAYS = Object.freeze({ today: 1, '7d': 7, '14d': 14, '30d': 30 })

/**
 * Resolve a preset or custom window to local epoch milliseconds.
 * @param {object} options - `{ range, now, from, to }`.
 * @returns {{range: string, start: number, end: number}} inclusive window.
 */
function resolveWindow(options = {}) {
  const now = typeof options.now === 'number' ? options.now : Date.now()
  const requested = typeof options.range === 'string' ? options.range : '7d'
  if (requested === 'custom') {
    const from = Number(options.from)
    const to = Number(options.to)
    if (Number.isFinite(from) && Number.isFinite(to) && from > 0 && to > from) {
      return { range: 'custom', start: from, end: to }
    }
    return resolveWindow({ range: '7d', now })
  }
  if (requested === 'all') return { range: 'all', start: 0, end: now }
  if (requested === '24h') return { range: '24h', start: now - 86_400_000, end: now }
  const range = RANGE_DAYS[requested] === undefined ? '7d' : requested
  const days = RANGE_DAYS[range] ?? 7
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  return { range, start: start.getTime(), end: now }
}

/** Local YYYY-MM-DD key. */
function dayKey(time) {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Blank counters shared by every rollup. */
function counters() {
  return {
    requests: 0,
    input: 0,
    cacheRead: 0,
    cacheWrite: 0,
    output: 0,
    reasoning: 0,
    tokens: 0,
    cost: 0,
    costs: {},
    pricedRequests: 0,
  }
}

/** Add one request to a counter object. */
function addRequest(target, request) {
  target.requests += 1
  target.input += request.input
  target.cacheRead += request.cacheRead
  target.cacheWrite += request.cacheWrite
  target.output += request.output
  target.reasoning += request.reasoning
  target.tokens += request.input + request.cacheRead + request.cacheWrite + request.output
  if (typeof request.cost === 'number') {
    target.cost += request.cost
    target.pricedRequests += 1
    const currency = request.currency || 'CNY'
    target.costs[currency] = (target.costs[currency] || 0) + request.cost
  }
}

/** Shape counters for the wire. */
function publicCounters(value) {
  const total = value.input + value.cacheRead + value.cacheWrite
  const costs = value.costs !== null && typeof value.costs === 'object' && Object.keys(value.costs).length > 0 ? value.costs : null
  const currencies = costs === null ? [] : Object.keys(costs)
  return {
    requests: value.requests,
    input: value.input,
    cacheRead: value.cacheRead,
    cacheWrite: value.cacheWrite,
    output: value.output,
    reasoning: value.reasoning,
    tokens: value.tokens,
    cacheHitRate: total === 0 ? null : value.cacheRead / total,
    cost: currencies.length === 1 ? costs[currencies[0]] : null,
    currency: currencies.length === 1 ? currencies[0] : null,
    costs,
    costMixed: currencies.length > 1,
    pricedRequests: value.pricedRequests,
  }
}

/** Price lookup by exact model id, lower-case model id, or `*`. */
function priceFor(pricing, model) {
  if (pricing === null || typeof pricing !== 'object') return null
  const direct = pricing[model]
  if (direct !== undefined) return direct
  const lower = String(model).toLowerCase()
  if (pricing[lower] !== undefined) return pricing[lower]
  if (pricing['*'] !== undefined) return pricing['*']
  return null
}

/** Estimated cost of one request, or null when the model has no price. */
function estimateCost(pricing, provider, request) {
  if (typeof provider === 'string' && provider.includes('opencode')) {
    const amount = opencodeGoCost(request.model, request.time, request)
    return amount === null ? null : { amount, currency: 'USD' }
  }
  const price = priceFor(pricing, request.model)
  if (price !== null && typeof price === 'object') {
    const input = Number(price.input) || 0
    const cacheRead = Number(price.cacheRead) || 0
    const cacheWrite = Number(price.cacheWrite) || 0
    const output = Number(price.output) || 0
    return {
      amount:
        (request.input * input + request.cacheRead * cacheRead + request.cacheWrite * cacheWrite + request.output * output) /
        1_000_000,
      currency: typeof price.currency === 'string' && price.currency !== '' ? price.currency : 'CNY',
    }
  }
  if (typeof provider === 'string' && provider.includes('deepseek')) {
    const amount = deepseekOfficialCost(request.model, request.time, request)
    return amount === null ? null : { amount, currency: 'CNY' }
  }
  return null
}

/**
 * Aggregate parsed sessions for one range.
 * @param {object[]} sessions - parsed sessions.
 * @param {object} options - `{ range, now, pricing, requestsLimit }`.
 * @returns {object} the wire payload without balances.
 */
/**
 * Aggregate parsed sessions for one range, filter set and sort order.
 * @param {object[]} sessions - parsed sessions.
 * @param {object} options - `{ range, now, pricing, requestsLimit, filters, sort }`.
 * @returns {object} the wire payload without balances.
 */
export function summarizeSessions(sessions, options = {}) {
  const now = typeof options.now === 'number' ? options.now : Date.now()
  const window = resolveWindow({ range: options.range, now, from: options.from, to: options.to })
  const range = window.range
  const start = window.start
  const end = window.end
  const pricing = options.pricing ?? {}
  const search = typeof options.search === 'string' ? options.search.trim().toLowerCase() : ''
  const filters = {
    workspace: typeof options.filters?.workspace === 'string' ? options.filters.workspace : '',
    provider: typeof options.filters?.provider === 'string' ? options.filters.provider : '',
    model: typeof options.filters?.model === 'string' ? options.filters.model : '',
    session: typeof options.filters?.session === 'string' ? options.filters.session : '',
  }
  const sortMode = options.sort === 'tokens' ? 'tokens' : 'active'
  const allowedSources = new Set(
    Array.isArray(options.sources)
      ? options.sources
      : [BUILTIN_SOURCE_ID],
  )
  const workspaceName = (cwd) => path.basename(cwd) || cwd || '未知工作区'

  const facetWorkspaces = new Map()
  const facetProviders = new Map()
  const facetModels = new Map()
  const facetSessions = new Map()
  const facetSources = new Map()
  const selected = []
  const tokenCount = (request) => request.input + request.cacheRead + request.cacheWrite + request.output
  const touchFacet = (map, key, init, request) => {
    let row = map.get(key)
    if (row === undefined) {
      row = { ...init, requests: 0, tokens: 0, lastAt: 0 }
      map.set(key, row)
    }
    row.requests += 1
    row.tokens += tokenCount(request)
    row.lastAt = Math.max(row.lastAt, request.time)
  }

  for (const session of sessions) {
    const source = typeof session.source === 'string' && session.source !== '' ? session.source : BUILTIN_SOURCE_ID
    if (!allowedSources.has(source)) continue
    const sourceLabel = session.sourceLabel || (source === BUILTIN_SOURCE_ID ? BUILTIN_SOURCE_LABEL : source)
    const requests = []
    const workspaceKey = session.cwd || ''
    for (const request of session.requests) {
      if (request.time < start || request.time > end) continue
      const priced = Number.isFinite(request.cost)
        ? { amount: request.cost, currency: request.currency || 'USD' }
        : estimateCost(pricing, request.provider, request)
      const isGo = typeof request.provider === 'string' && request.provider.includes('opencode')
      const enriched = {
        ...request,
        source,
        sourceLabel,
        sessionId: session.id,
        sessionTitle: session.title,
        cwd: session.cwd,
        cost: priced === null ? null : priced.amount,
        currency: priced === null ? null : priced.currency,
        billing: priced === null ? 'unknown' : isGo ? (priced.amount === 0 ? 'free' : 'go') : 'api',
      }
      touchFacet(facetWorkspaces, workspaceKey, { path: workspaceKey, name: workspaceName(workspaceKey) }, enriched)
      touchFacet(facetProviders, request.provider, { id: request.provider }, enriched)
      touchFacet(facetModels, `${request.provider}\u0000${request.model}`, { provider: request.provider, model: request.model }, enriched)
      touchFacet(facetSessions, session.id, { id: session.id, title: session.title || '未命名会话', workspace: workspaceName(workspaceKey) }, enriched)
      touchFacet(facetSources, source, { id: source, label: sourceLabel }, enriched)
      if (filters.workspace !== '' && workspaceKey !== filters.workspace) continue
      if (filters.session !== '' && session.id !== filters.session) continue
      if (filters.provider !== '' && request.provider !== filters.provider) continue
      if (filters.model !== '' && request.model !== filters.model) continue
      if (search !== '') {
        const haystack = `${session.title} ${session.cwd} ${request.provider} ${request.model}`.toLowerCase()
        if (!haystack.includes(search)) continue
      }
      requests.push(enriched)
    }
    if (requests.length > 0) selected.push({ session, requests })
  }

  const byActive = (left, right) =>
    (right.lastAt ?? 0) - (left.lastAt ?? 0) || right.tokens - left.tokens || right.requests - left.requests
  const byTokens = (left, right) =>
    right.tokens - left.tokens || right.requests - left.requests || (right.lastAt ?? 0) - (left.lastAt ?? 0)
  const order = sortMode === 'tokens' ? byTokens : byActive
  const facets = {
    sources: [...facetSources.values()].sort(byActive),
    workspaces: [...facetWorkspaces.values()].sort(byActive),
    providers: [...facetProviders.values()].sort(byActive),
    models: [...facetModels.values()].sort(byActive),
    sessions: [...facetSessions.values()].sort(byActive).slice(0, 200),
  }

  let firstAt = Number.POSITIVE_INFINITY
  let lastAt = 0
  for (const entry of selected) {
    for (const request of entry.requests) {
      if (request.time < firstAt) firstAt = request.time
      if (request.time > lastAt) lastAt = request.time
    }
  }
  let firstDay = new Date(start === 0 ? now : start)
  firstDay.setHours(0, 0, 0, 0)
  let dayCount = range === '30d' ? 30 : range === '14d' ? 14 : range === '7d' ? 7 : 1
  if (range === 'all') {
    if (!Number.isFinite(firstAt)) firstAt = now
    if (lastAt === 0) lastAt = now
    const firstCalendar = new Date(firstAt)
    firstCalendar.setHours(0, 0, 0, 0)
    const lastCalendar = new Date(lastAt)
    lastCalendar.setHours(0, 0, 0, 0)
    const span = Math.floor((lastCalendar.getTime() - firstCalendar.getTime()) / 86_400_000) + 1
    dayCount = Math.max(1, Math.min(30, span))
    firstDay = new Date(lastCalendar)
    firstDay.setDate(firstDay.getDate() - (dayCount - 1))
  } else {
    const lastDay = new Date(end)
    lastDay.setHours(0, 0, 0, 0)
    const span = Math.floor((lastDay.getTime() - firstDay.getTime()) / 86_400_000) + 1
    dayCount = Math.max(1, Math.min(366, span))
  }
  const days = []
  const dayMap = new Map()
  for (let index = 0; index < dayCount; index += 1) {
    const date = new Date(firstDay)
    date.setDate(firstDay.getDate() + index)
    const key = dayKey(date.getTime())
    const bucket = { date: key, requests: 0, tokens: 0, input: 0, cacheRead: 0, output: 0, cost: 0, costs: {} }
    days.push(bucket)
    dayMap.set(key, bucket)
  }

  const totals = counters()
  const modelMap = new Map()
  const workspaceMap = new Map()
  const sessionRows = []
  const allRequests = []
  for (const { session, requests } of selected) {
    const sessionCounter = counters()
    for (const request of requests) {
      addRequest(totals, request)
      addRequest(sessionCounter, request)
      allRequests.push(request)
      const bucket = dayMap.get(dayKey(request.time))
      if (bucket !== undefined) {
        bucket.requests += 1
        bucket.tokens += tokenCount(request)
        bucket.input += request.input
        bucket.cacheRead += request.cacheRead
        bucket.output += request.output
        if (typeof request.cost === 'number') {
          bucket.cost += request.cost
          const currency = request.currency || 'CNY'
          bucket.costs[currency] = (bucket.costs[currency] || 0) + request.cost
        }
      }
      const modelKey = `${request.provider}\u0000${request.model}`
      let modelRow = modelMap.get(modelKey)
      if (modelRow === undefined) {
        modelRow = { provider: request.provider, model: request.model, ...counters(), sessions: new Set(), lastAt: 0 }
        modelMap.set(modelKey, modelRow)
      }
      addRequest(modelRow, request)
      modelRow.sessions.add(session.id)
      modelRow.lastAt = Math.max(modelRow.lastAt, request.time)
      const workspaceKey = session.cwd || ''
      let workspaceRow = workspaceMap.get(workspaceKey)
      if (workspaceRow === undefined) {
        workspaceRow = {
          path: workspaceKey,
          name: workspaceName(workspaceKey),
          ...counters(),
          sessions: new Set(),
          lastAt: 0,
        }
        workspaceMap.set(workspaceKey, workspaceRow)
      }
      addRequest(workspaceRow, request)
      workspaceRow.sessions.add(session.id)
      workspaceRow.lastAt = Math.max(workspaceRow.lastAt, request.time)
    }
    const last = requests.reduce((max, request) => Math.max(max, request.time), 0)
    sessionRows.push({
      id: session.id,
      source: session.source || BUILTIN_SOURCE_ID,
      sourceLabel: session.sourceLabel || BUILTIN_SOURCE_LABEL,
      title: session.title || '未命名会话',
      cwd: session.cwd,
      workspace: workspaceName(session.cwd),
      provider: requests[requests.length - 1]?.provider ?? 'unknown',
      model: requests[requests.length - 1]?.model ?? 'unknown',
      createdAt: session.createdAt,
      turns: session.turns,
      lastAt: last,
      firstAt: requests.reduce((min, request) => Math.min(min, request.time), Number.POSITIVE_INFINITY),
      ...publicCounters(sessionCounter),
    })
  }

  const models = [...modelMap.values()]
    .sort(order)
    .map((row) => ({
      provider: row.provider,
      model: row.model,
      sessions: row.sessions.size,
      lastAt: row.lastAt,
      ...publicCounters(row),
    }))
  const workspaces = [...workspaceMap.values()]
    .sort(order)
    .map((row) => ({
      path: row.path,
      name: row.name,
      sessions: row.sessions.size,
      lastAt: row.lastAt,
      ...publicCounters(row),
    }))
  sessionRows.sort(order)
  allRequests.sort((left, right) => right.time - left.time)
  const limit = Number.isFinite(options.requestsLimit) ? Math.max(1, options.requestsLimit) : 2000
  const requests = allRequests.slice(0, limit).map((request) => ({
    time: request.time,
    source: request.source,
    sourceLabel: request.sourceLabel,
    sessionId: request.sessionId,
    sessionTitle: request.sessionTitle,
    provider: request.provider,
    model: request.model,
    input: request.input,
    cacheRead: request.cacheRead,
    cacheWrite: request.cacheWrite,
    output: request.output,
    reasoning: request.reasoning,
    cost: request.cost,
    currency: request.currency,
    billing: request.billing,
  }))
  const summary = publicCounters(totals)
  return {
    range,
    from: start,
    to: end,
    search,
    sort: sortMode,
    filters,
    totals: {
      ...summary,
      sessions: sessionRows.length,
      workspaces: workspaces.length,
      costComplete: summary.pricedRequests === totals.requests,
    },
    days,
    models,
    workspaces,
    sessions: sessionRows,
    requests,
    facets,
    scanned: {
      sessions: sessions.length,
      requests: allRequests.length,
      firstAt: allRequests.length === 0 ? null : allRequests.reduce((min, item) => Math.min(min, item.time), Number.POSITIVE_INFINITY),
      lastAt: allRequests.length === 0 ? null : allRequests[0].time,
    },
  }
}

/* ------------------------------------------------------------------------- *
 * Balances
 * ------------------------------------------------------------------------- */

/** Resolve one credential through the credentials store, launch env, then process env. */
export async function resolveKey(ctx, names) {
  for (const ref of names) {
    try {
      const hit = await ctx.get('credentials')?.resolve(ref)
      if (typeof hit?.value === 'string' && hit.value !== '') return hit.value
    } catch {}
  }
  for (const ref of names) {
    try {
      const entry = ctx.get('launchEnvironment')?.get(ref)
      if (typeof entry?.value === 'string' && entry.value !== '') return entry.value
    } catch {}
  }
  for (const ref of names) {
    const value = process.env[ref]
    if (typeof value === 'string' && value !== '') return value
  }
  return null
}

/** Clamp a gateway percentage. */
function percentOf(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, value))
}

/** Parse an ISO timestamp. */
function isoOf(value) {
  if (typeof value !== 'string') return null
  const at = Date.parse(value)
  return Number.isNaN(at) ? null : new Date(at).toISOString()
}

/**
 * Read the OpenCode Go plan's three usage windows.
 * @param {string} key - account API key.
 * @param {Function} fetchImpl - fetch-compatible function.
 * @returns {Promise<object>} normalized reading.
 */
export async function readOpenCodeUsage(key, fetchImpl = fetch) {
  let response
  try {
    response = await fetchImpl(OPENCODE_USAGE_URL, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${key}`,
        accept: 'application/json',
        'x-opencode-session': randomUUID(),
        'user-agent': 'dsh-usage-statistics/0.1.0',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timeout = error !== null && typeof error === 'object' && error.name === 'TimeoutError'
    return { ok: false, code: timeout ? 'timeout' : 'network', message: timeout ? '读取 OpenCode Go 额度超时' : '无法连接 opencode.ai' }
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: 'auth', message: 'OPENCODE_GO_API_KEY 无效或已失效' }
  }
  if (!response.ok) return { ok: false, code: 'upstream', message: `OpenCode Go 返回 HTTP ${response.status}` }
  let payload
  try {
    payload = await response.json()
  } catch {
    return { ok: false, code: 'payload', message: 'OpenCode Go 返回的不是 JSON' }
  }
  const source = payload?.usage
  if (source === null || typeof source !== 'object') {
    return { ok: false, code: 'payload', message: 'OpenCode Go 返回里没有 usage' }
  }
  const windows = {}
  for (const window of OPENCODE_WINDOWS) {
    const entry = source[window]
    if (entry === null || typeof entry !== 'object') continue
    windows[window] = {
      status: typeof entry.status === 'string' ? entry.status : 'unknown',
      percent: percentOf(entry.percent),
      resetsAt: isoOf(entry.resetsAt),
    }
  }
  if (Object.keys(windows).length === 0) {
    return { ok: false, code: 'payload', message: 'OpenCode Go 没有可识别的限额窗口' }
  }
  return { ok: true, windows }
}

/**
 * Read the DeepSeek official account balance.
 * @param {string} key - DeepSeek API key.
 * @param {Function} fetchImpl - fetch-compatible function.
 * @returns {Promise<object>} normalized balance.
 */
export async function readDeepSeekBalance(key, fetchImpl = fetch) {
  const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '')
  let response
  try {
    response = await fetchImpl(`${base}/user/balance`, {
      method: 'GET',
      headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timeout = error !== null && typeof error === 'object' && error.name === 'TimeoutError'
    return { ok: false, code: timeout ? 'timeout' : 'network', message: timeout ? '读取 DeepSeek 余额超时' : '无法连接 api.deepseek.com' }
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: 'auth', message: 'DEEPSEEK_API_KEY 无效或已失效' }
  }
  if (!response.ok) return { ok: false, code: 'upstream', message: `DeepSeek 返回 HTTP ${response.status}` }
  let payload
  try {
    payload = await response.json()
  } catch {
    return { ok: false, code: 'payload', message: 'DeepSeek 返回的不是 JSON' }
  }
  const infos = Array.isArray(payload?.balance_infos) ? payload.balance_infos : []
  const balances = infos
    .map((info) => ({
      currency: typeof info?.currency === 'string' ? info.currency : 'CNY',
      total: Number(info?.total_balance),
      granted: Number(info?.granted_balance),
      toppedUp: Number(info?.topped_up_balance),
    }))
    .filter((info) => Number.isFinite(info.total))
  if (balances.length === 0) return { ok: false, code: 'payload', message: 'DeepSeek 返回里没有余额' }
  return { ok: true, available: payload?.is_available !== false, balances }
}

/** Map a provider route to the balance source it can actually query. */
function balanceSource(provider) {
  if (typeof provider !== 'string') return null
  if (provider.includes('opencode')) return 'opencode-go'
  if (provider === 'deepseek-official') return 'deepseek'
  return null
}

/**
 * Query both supported balance sources. A missing key is an ordinary reading,
 * not an error.
 * @param {object} ctx - plugin context.
 * @param {object} options - `{ fetchImpl, active, force, cached }`.
 * @returns {Promise<object>} balance section.
 */
export async function readBalances(ctx, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const [deepseekKey, opencodeKey] = await Promise.all([
    resolveKey(ctx, ['DEEPSEEK_API_KEY']),
    resolveKey(ctx, ['OPENCODE_GO_API_KEY', 'OPENCODE_API_KEY']),
  ])
  const [deepseek, opencode] = await Promise.all([
    deepseekKey === null
      ? { ok: false, code: 'no-key', message: '未配置 DEEPSEEK_API_KEY' }
      : readDeepSeekBalance(deepseekKey, fetchImpl),
    opencodeKey === null
      ? { ok: false, code: 'no-key', message: '未配置 OPENCODE_GO_API_KEY' }
      : readOpenCodeUsage(opencodeKey, fetchImpl),
  ])
  const activeProvider = options.active?.provider ?? null
  const activeId = balanceSource(activeProvider)
  const providers = [
    { id: 'opencode-go', name: 'OpenCode Go', kind: 'subscription', active: activeId === 'opencode-go', ...opencode },
    { id: 'deepseek', name: 'DeepSeek 官方', kind: 'api', active: activeId === 'deepseek', ...deepseek },
  ]
  providers.sort((left, right) => Number(right.active) - Number(left.active))
  return {
    fetchedAt: new Date().toISOString(),
    activeProvider,
    activeId,
    accountLogin: activeProvider === 'deepseek-account',
    providers,
  }
}

/* ------------------------------------------------------------------------- *
 * HTTP
 * ------------------------------------------------------------------------- */

/** JSON response, never cached. */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-length', Buffer.byteLength(body))
  res.end(body)
}

/** Trust fence: the shipped `connection` guard when present, else loopback. */
function allow(ctx, req) {
  const connection = ctx.get('connection')
  if (connection !== undefined && typeof connection.requestRejection === 'function') {
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) return false
    return true
  }
  const address = req.socket?.remoteAddress
  return address === undefined || address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Read one bounded JSON request body. */
async function readJsonBody(req, limit = 1_000_000) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      const error = new Error(`request body exceeds ${limit} bytes`)
      error.code = 'body'
      throw error
    }
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('request body must be valid JSON')
    error.code = 'body'
    throw error
  }
}

/** Parse the `sources` query. Missing means the built-in DSH source only. */
function parseSources(value) {
  if (typeof value !== 'string' || value.trim() === '') return [BUILTIN_SOURCE_ID]
  if (value.trim() === 'none') return []
  const ids = value.split(',').map((id) => id.trim()).filter((id) => /^[a-z0-9][a-z0-9._-]{0,63}$/.test(id))
  return [...new Set(ids)]
}

/** Source catalog with the built-in DSH source first. */
function withBuiltinSource(catalog, scannedSessions) {
  return [
    {
      id: BUILTIN_SOURCE_ID,
      label: BUILTIN_SOURCE_LABEL,
      kind: 'builtin',
      builtin: true,
      events: scannedSessions,
      lastAt: null,
    },
    ...catalog,
  ]
}

/**
 * Build the provider cards shown above the dashboard. The two balance-backed
 * providers stay first; every other provider configured in DSH follows them so
 * a custom gateway can be activated from the same strip. The active provider
 * always occupies the first slot.
 */
async function readProviderCards(ctx, active, balance) {
  const balanceRows = Array.isArray(balance?.providers) ? balance.providers : []
  const balanceById = new Map(balanceRows.map((row) => [row.id, row]))
  const rows = new Map()
  const llm = ctx.get('llm')
  if (llm !== undefined && typeof llm.listProviders === 'function') {
    for (const provider of llm.listProviders()) {
      if (provider === null || typeof provider !== 'object' || typeof provider.id !== 'string') continue
      let models = []
      try {
        const listed = await llm.listModels(provider.id)
        if (Array.isArray(listed)) models = listed.map((model) => model?.id).filter((id) => typeof id === 'string')
      } catch {
        // A provider whose catalogue is unavailable still deserves a card.
      }
      rows.set(provider.id, {
        id: provider.id,
        name: typeof provider.name === 'string' && provider.name !== '' ? provider.name : provider.id,
        models,
        modelCount: models.length,
        available: models.length > 0,
        balance: balanceById.get(provider.id) ?? null,
        kind: balanceById.has(provider.id) ? 'balance' : 'preset',
      })
    }
  }
  for (const row of balanceRows) {
    if (!rows.has(row.id)) {
      rows.set(row.id, {
        id: row.id,
        name: row.id === 'opencode-go' ? 'OpenCode Go' : row.id === 'deepseek-official' ? 'DeepSeek 官方' : row.id,
        models: [],
        modelCount: 0,
        available: row.ok !== false,
        balance: row,
        kind: 'balance',
      })
    }
  }
  const activeId = typeof active?.provider === 'string' ? active.provider : balance?.activeId ?? ''
  const preferred = ['opencode-go', 'deepseek-official']
  return [...rows.values()]
    .map((row) => ({ ...row, active: row.id === activeId }))
    .sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1
      const leftIndex = preferred.indexOf(left.id)
      const rightIndex = preferred.indexOf(right.id)
      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1
        if (rightIndex === -1) return -1
        return leftIndex - rightIndex
      }
      return left.name.localeCompare(right.name)
    })
}

/**
 * Build the request handler.
 * @param {object} ctx - plugin context.
 * @param {object} options - `{ config, fetchImpl, now, scanRoot }`.
 * @returns {(req: object, res: object) => Promise<void>} handler.
 */
export function createHandler(ctx, options = {}) {
  const config = { ...DEFAULTS, ...(options.config ?? {}) }
  const fetchImpl = options.fetchImpl ?? fetch
  const scanRoot = options.scanRoot ?? path.join(resolveDshHome(), 'sessions')
  const sourceHome = options.home ?? path.dirname(path.resolve(scanRoot))
  const sourceStore = options.sourceStore ?? createSourceStore({ home: sourceHome, now: options.now })
  const now = options.now ?? (() => Date.now())
  const fileCache = new Map()
  const responseCache = new Map()
  let balanceCache = null
  let scanning = null

  const scan = async () => {
    const started = Date.now()
    const result = await scanSessions(scanRoot, fileCache)
    return { ...result, durationMs: Date.now() - started }
  }

  const readActive = () => {
    try {
      const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
      if (selection !== null && typeof selection === 'object' && typeof selection.provider === 'string') {
        return {
          provider: selection.provider,
          model: typeof selection.model === 'string' ? selection.model : '',
          source: 'default',
        }
      }
    } catch {}
    return null
  }

  return async (req, res) => {
    if (!allow(ctx, req)) {
      res.statusCode = 401
      res.end()
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('allow', 'GET, HEAD')
      res.end()
      return
    }
    let params
    try {
      params = new URL(String(req.url), 'http://localhost').searchParams
    } catch {
      params = new URLSearchParams()
    }
    const requested = params.get('range')
    const range = ['today', '24h', '7d', '14d', '30d', 'all', 'custom'].includes(requested) ? requested : '7d'
    const from = Number(params.get('from'))
    const to = Number(params.get('to'))
    const force = params.get('force') === '1'
    const sort = params.get('sort') === 'tokens' ? 'tokens' : 'active'
    const search = (params.get('q') ?? '').slice(0, 200)
    const readParam = (name) => (params.get(name) ?? '').slice(0, 512)
    const sources = parseSources(params.get('sources'))
    const filters = {
      workspace: readParam('workspace'),
      provider: readParam('provider'),
      model: readParam('model'),
      session: readParam('session'),
    }
    if (range === 'custom' && !(Number.isFinite(from) && Number.isFinite(to) && from > 0 && to > from)) {
      sendJson(res, 400, { ok: false, code: 'range', message: 'from/to must be finite and from < to' })
      return
    }
    const cacheKey = [range, from, to, search, sort, filters.workspace, filters.provider, filters.model, filters.session, sources.join(',')].join('\u0000')
    const ttl = Math.max(0, Number(config.refreshSeconds) || 0) * 1000
    const cached = responseCache.get(cacheKey)
    if (!force && cached !== undefined && now() - cached.at < ttl) {
      sendJson(res, 200, { ...cached.payload, cached: true })
      return
    }

    try {
      const started = Date.now()
      if (scanning === null) scanning = scan().finally(() => { scanning = null })
      const [scanned, externalSessions, externalCatalog] = await Promise.all([
        scanning,
        sourceStore.sessions(),
        sourceStore.catalog(),
      ])
      const sourceCatalog = withBuiltinSource(externalCatalog, scanned.sessions.length)
      const effectiveSources = sources.includes('all')
        ? sourceCatalog.map((source) => source.id)
        : sources
      let summary
      try {
        summary = summarizeSessions([
          ...scanned.sessions.map((session) => ({
            ...session,
            source: BUILTIN_SOURCE_ID,
            sourceLabel: BUILTIN_SOURCE_LABEL,
          })),
          ...externalSessions,
        ], {
          range,
          from,
          to,
          search,
          now: now(),
          pricing: config.pricing,
          requestsLimit: config.requestsLimit,
          filters,
          sort,
          sources: effectiveSources,
        })
      } catch (error) {
        sendJson(res, 500, { ok: false, code: 'aggregate', message: error instanceof Error ? error.message : String(error) })
        return
      }

      const active = readActive() ?? {
        provider: summary.sessions[0]?.provider ?? 'unknown',
        model: summary.sessions[0]?.model ?? '',
        source: 'session',
      }
      let balance = balanceCache
      const balanceTtl = Math.max(0, Number(config.balanceSeconds) || 0) * 1000
      if (force || balance === null || now() - balance.at >= balanceTtl) {
        const reading = await readBalances(ctx, { fetchImpl, active })
        balance = { at: now(), reading }
        balanceCache = balance
      }
      const providers = await readProviderCards(ctx, active, balance.reading)
      const payload = {
        ok: true,
        version: PLUGIN_VERSION,
        generatedAt: new Date(now()).toISOString(),
        range,
        active,
        ...summary,
        sources: sourceCatalog,
        providers,
        balance: balance.reading,
        scan: {
          sessions: scanned.sessions.length,
          externalSessions: externalSessions.length,
          parsed: scanned.scanned,
          requests: summary.scanned.requests,
          errors: scanned.errors,
          durationMs: Date.now() - started,
          root: scanRoot,
        },
      }
      responseCache.set(cacheKey, { at: now(), payload })
      sendJson(res, 200, payload)
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        code: 'internal',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Build the local ingestion route used by other plugins, MCP bridges and
 * helper scripts. DSH-hosted callers can use the `usageAudit` service instead.
 * @param {object} ctx - plugin context.
 * @param {{ config?: object, sourceStore?: object }} [options]
 * @returns {(req: object, res: object) => Promise<void>}
 */
export function createIngestHandler(ctx, options = {}) {
  const config = { ...DEFAULTS, ...(options.config ?? {}) }
  const sourceStore = options.sourceStore ?? createSourceStore({ home: options.home })
  return async (req, res) => {
    if (!allow(ctx, req)) {
      res.statusCode = 401
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('allow', 'POST')
      res.end()
      return
    }
    if (typeof config.ingestToken === 'string' && config.ingestToken !== '') {
      const provided = req.headers?.['x-usage-token']
      if (provided !== config.ingestToken) {
        sendJson(res, 401, { ok: false, code: 'token', message: 'invalid x-usage-token' })
        return
      }
    }
    try {
      const body = await readJsonBody(req)
      const result = await sourceStore.ingest(body)
      sendJson(res, 200, { ok: true, ...result })
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        code: error?.code ?? 'ingest',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/** Build the read-only source inventory route. */
export function createSourcesHandler(ctx, options = {}) {
  const sourceStore = options.sourceStore ?? createSourceStore({ home: options.home })
  return async (req, res) => {
    if (!allow(ctx, req)) {
      res.statusCode = 401
      res.end()
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('allow', 'GET, HEAD')
      res.end()
      return
    }
    try {
      const catalog = await sourceStore.catalog()
      sendJson(res, 200, {
        ok: true,
        store: sourceStore.file,
        builtin: { id: BUILTIN_SOURCE_ID, label: BUILTIN_SOURCE_LABEL },
        sources: catalog,
      })
    } catch (error) {
      sendJson(res, 500, { ok: false, code: 'sources', message: error instanceof Error ? error.message : String(error) })
    }
  }
}

/** Build the provider activation route. */
export function createActivateHandler(ctx, options = {}) {
  return async (req, res) => {
    if (!allow(ctx, req)) {
      res.statusCode = 401
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('allow', 'POST')
      res.end()
      return
    }
    try {
      const body = await readJsonBody(req, 64 * 1024)
      const provider = typeof body?.provider === 'string' ? body.provider.trim() : ''
      if (provider === '') {
        sendJson(res, 400, { ok: false, code: 'provider', message: 'provider is required' })
        return
      }
      const llm = ctx.get('llm')
      const modelService = ctx.get('agentDefaultModel')
      if (llm === undefined || typeof llm.listProviders !== 'function' || modelService === undefined || typeof modelService.saveSelection !== 'function') {
        sendJson(res, 503, { ok: false, code: 'unavailable', message: 'provider switching is unavailable' })
        return
      }
      const found = llm.listProviders().some((entry) => entry?.id === provider)
      if (!found) {
        sendJson(res, 404, { ok: false, code: 'provider', message: `unknown provider: ${provider}` })
        return
      }
      const listed = await llm.listModels(provider)
      const models = Array.isArray(listed) ? listed.map((entry) => entry?.id).filter((id) => typeof id === 'string') : []
      if (models.length === 0) {
        sendJson(res, 400, { ok: false, code: 'model', message: `provider ${provider} has no available model` })
        return
      }
      const requested = typeof body?.model === 'string' ? body.model.trim() : ''
      const model = requested !== '' && models.includes(requested) ? requested : models[0]
      await modelService.saveSelection({ provider, model })
      sendJson(res, 200, { ok: true, active: { provider, model } })
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        code: 'activate',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Register the readout route.
 * @param {object} ctx - plugin context carrying `webServer`.
 * @param {object} config - optional overrides (`refreshSeconds`, `balanceSeconds`, `pricing`, `requestsLimit`).
 */
export function apply(ctx, config = {}) {
  const logger = ctx.logger ?? console
  try {
    const sourceStore = createSourceStore()
    const handler = createHandler(ctx, { config, sourceStore })
    const ingest = createIngestHandler(ctx, { config, sourceStore })
    const sources = createSourcesHandler(ctx, { sourceStore })
    const activate = createActivateHandler(ctx)
    ctx.effect(
      () => ctx.webServer.register({ kind: 'exact', path: ROUTE, handler }),
      'dsh-usage-statistics: usage data route',
    )
    ctx.effect(
      () => ctx.webServer.register({ kind: 'exact', path: INGEST_ROUTE, handler: ingest }),
      'dsh-usage-statistics: usage ingest route',
    )
    ctx.effect(
      () => ctx.webServer.register({ kind: 'exact', path: SOURCES_ROUTE, handler: sources }),
      'dsh-usage-statistics: usage sources route',
    )
    ctx.effect(
      () => ctx.webServer.register({ kind: 'exact', path: ACTIVATE_ROUTE, handler: activate }),
      'dsh-usage-statistics: provider activation route',
    )
    ctx.provide('usageAudit', {
      version: PLUGIN_VERSION,
      ingest: (payload) => sourceStore.ingest(payload),
      sources: () => sourceStore.catalog(),
      file: sourceStore.file,
    })
    logger.info?.('dsh-usage-statistics ready at ' + ROUTE)
  } catch (error) {
    logger.warn?.('dsh-usage-statistics failed to apply: ' + (error instanceof Error ? error.message : String(error)))
  }
}
