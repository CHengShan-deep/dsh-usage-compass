/**
 * Persisted usage events from non-DSH sources.
 *
 * A source is any local plugin, MCP bridge or helper that already knows its
 * provider usage. It posts normalized events here once; the dashboard then
 * treats those events exactly like DSH session requests for range, filter,
 * pricing and ranking. DSH sessions stay the built-in source and are never
 * written to this file.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const BUILTIN_SOURCE_ID = 'dsh-session'
export const BUILTIN_SOURCE_LABEL = 'DSH 会话'
const MAX_EVENTS = 20_000
const MAX_BATCH = 100
const SOURCE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/
const CURRENCY = /^[A-Z]{3}$/

function homeDirectory() {
  const configured = typeof process.env.DSH_HOME === 'string' ? process.env.DSH_HOME.trim() : ''
  return configured !== '' ? path.resolve(configured) : path.join(os.homedir(), '.dsh')
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function token(value) {
  return Math.min(1e12, Math.floor(finite(Number(value), 0)))
}

function text(value, max, fallback = '') {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : fallback
}

function sourceId(value) {
  const id = text(value, 64).toLowerCase()
  return SOURCE_ID.test(id) ? id : ''
}

function normalizeEvent(raw, source, now) {
  if (raw === null || typeof raw !== 'object') return null
  const time = Number(raw.time)
  const when = Number.isFinite(time) && time > 0 ? Math.min(time, now + 60_000) : now
  const input = token(raw.input ?? raw.promptTokens ?? raw.prompt_tokens)
  const cacheRead = token(raw.cacheRead ?? raw.cachedTokens ?? raw.cached_tokens)
  const cacheWrite = token(raw.cacheWrite ?? raw.cache_creation_tokens)
  const output = token(raw.output ?? raw.completionTokens ?? raw.completion_tokens)
  const reasoning = token(raw.reasoning ?? raw.reasoning_tokens)
  const usage = input + cacheRead + cacheWrite + output + reasoning
  const costValue = Number(raw.cost)
  const cost = Number.isFinite(costValue) && costValue >= 0 ? costValue : null
  if (usage === 0 && cost === null) return null

  const provider = text(raw.provider, 80, 'external')
  const model = text(raw.model, 160, 'unknown')
  const currency = CURRENCY.test(String(raw.currency ?? '')) ? String(raw.currency) : 'USD'
  const session = text(raw.sessionId ?? raw.session_id, 160, 'default')
  const id = text(raw.id, 200, '') || createHash('sha256')
    .update(JSON.stringify([source.id, when, session, provider, model, input, cacheRead, cacheWrite, output, cost, currency]))
    .digest('hex')
    .slice(0, 32)

  return {
    id,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceKind: source.kind,
    time: when,
    provider,
    model,
    input,
    cacheRead,
    cacheWrite,
    output,
    reasoning,
    cost,
    currency,
    sessionId: session,
    sessionTitle: text(raw.title ?? raw.sessionTitle, 200, ''),
    workspace: text(raw.workspace ?? raw.cwd, 500, ''),
    metadata: raw.metadata !== null && typeof raw.metadata === 'object' ? raw.metadata : undefined,
  }
}

/**
 * @param {{ home?: string, now?: () => number }} [options]
 */
export function createSourceStore(options = {}) {
  const home = options.home ?? homeDirectory()
  const now = options.now ?? (() => Date.now())
  const directory = path.join(home, 'storages', 'dsh-usage-compass')
  const file = path.join(directory, 'events.jsonl')
  let cache = { mtimeMs: -1, size: -1, events: [] }

  const readEvents = async () => {
    let stat
    try {
      stat = await fs.stat(file)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        cache = { mtimeMs: -1, size: -1, events: [] }
        return cache.events
      }
      throw error
    }
    if (stat.mtimeMs === cache.mtimeMs && stat.size === cache.size) return cache.events
    let raw = ''
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      throw error
    }
    const seen = new Set()
    const events = []
    for (const line of raw.split(/\r?\n/)) {
      if (line.trim() === '') continue
      try {
        const event = JSON.parse(line)
        if (typeof event?.id !== 'string' || seen.has(event.id)) continue
        seen.add(event.id)
        events.push(event)
      } catch {
        // A torn or manually edited line must not discard the rest of the file.
      }
    }
    cache = { mtimeMs: stat.mtimeMs, size: stat.size, events: events.slice(-MAX_EVENTS) }
    return cache.events
  }

  const catalog = async () => {
    const events = await readEvents()
    const sources = new Map()
    for (const event of events) {
      const id = sourceId(event.sourceId)
      if (id === '') continue
      let row = sources.get(id)
      if (row === undefined) {
        row = {
          id,
          label: text(event.sourceLabel, 100, id),
          kind: text(event.sourceKind, 40, 'http'),
          builtin: false,
          events: 0,
          lastAt: 0,
        }
        sources.set(id, row)
      }
      row.events += 1
      row.lastAt = Math.max(row.lastAt, finite(event.time))
    }
    return [...sources.values()].sort((left, right) => right.lastAt - left.lastAt)
  }

  const sessions = async () => {
    const events = await readEvents()
    const groups = new Map()
    for (const event of events) {
      const source = sourceId(event.sourceId)
      if (source === '') continue
      const session = text(event.sessionId, 160, 'default')
      const key = `${source}\u0000${session}`
      let group = groups.get(key)
      if (group === undefined) {
        group = {
          id: `external:${createHash('sha256').update(key).digest('hex').slice(0, 20)}`,
          source,
          sourceLabel: text(event.sourceLabel, 100, source),
          title: text(event.sessionTitle, 200, '') || text(event.sourceLabel, 100, source),
          cwd: text(event.workspace, 500, ''),
          createdAt: finite(event.time),
          turns: 0,
          requests: [],
        }
        groups.set(key, group)
      }
      group.createdAt = Math.min(group.createdAt, finite(event.time))
      group.requests.push({
        time: finite(event.time),
        provider: text(event.provider, 80, 'external'),
        model: text(event.model, 160, 'unknown'),
        input: token(event.input),
        cacheRead: token(event.cacheRead),
        cacheWrite: token(event.cacheWrite),
        output: token(event.output),
        reasoning: token(event.reasoning),
        cost: Number.isFinite(event.cost) ? event.cost : null,
        currency: CURRENCY.test(String(event.currency ?? '')) ? event.currency : 'USD',
        source,
        sourceLabel: group.sourceLabel,
        sessionId: session,
        sessionTitle: group.title,
        metadata: event.metadata,
      })
    }
    return [...groups.values()]
  }

  const ingest = async (input) => {
    if (input === null || typeof input !== 'object') {
      return { accepted: 0, duplicates: 0, rejected: 0, sources: await catalog() }
    }
    const sourceValue = input.source !== null && typeof input.source === 'object' ? input.source : {}
    const id = sourceId(sourceValue.id ?? input.sourceId ?? input.source)
    if (id === '') {
      const error = new Error('source.id must match [a-z0-9][a-z0-9._-]{0,63}')
      error.code = 'source'
      throw error
    }
    if (id === BUILTIN_SOURCE_ID) {
      const error = new Error(`${BUILTIN_SOURCE_ID} is reserved for DSH session logs`)
      error.code = 'source'
      throw error
    }
    const source = {
      id,
      label: text(sourceValue.label ?? sourceValue.name ?? input.sourceLabel, 100, id),
      kind: text(sourceValue.kind ?? input.kind, 40, 'http'),
    }
    const list = Array.isArray(input) ? input : Array.isArray(input.events) ? input.events : []
    if (list.length === 0) {
      const error = new Error('events must be a non-empty array')
      error.code = 'events'
      throw error
    }
    if (list.length > MAX_BATCH) {
      const error = new Error(`events must contain at most ${MAX_BATCH} entries`)
      error.code = 'events'
      throw error
    }
    const existing = new Set((await readEvents()).map((event) => event.id))
    const accepted = []
    let duplicates = 0
    let rejected = 0
    const stamp = now()
    for (const raw of list) {
      const event = normalizeEvent(raw, source, stamp)
      if (event === null) {
        rejected += 1
        continue
      }
      if (existing.has(event.id)) {
        duplicates += 1
        continue
      }
      existing.add(event.id)
      accepted.push(event)
    }
    if (accepted.length > 0) {
      await fs.mkdir(directory, { recursive: true })
      await fs.appendFile(file, accepted.map((event) => JSON.stringify(event)).join('\n') + '\n', 'utf8')
      cache = { mtimeMs: -1, size: -1, events: [] }
    }
    return {
      accepted: accepted.length,
      duplicates,
      rejected,
      source: { ...source, events: accepted.length },
      sources: await catalog(),
    }
  }

  return { home, directory, file, readEvents, catalog, sessions, ingest }
}

