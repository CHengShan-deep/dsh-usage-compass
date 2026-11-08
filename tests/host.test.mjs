import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { Readable } from 'node:stream'
import {
  createHandler,
  createActivateHandler,
  createIngestHandler,
  createSourceStore,
  decompressZstdFrames,
  decompressZstdFramesTolerant,
  parseSessionText,
  readSessionLog,
  scanSessions,
  summarizeSessions,
} from '../src/index.js'
import { deepseekOfficialCost } from '../src/pricing.js'
import { opencodeGoCost } from '../src/pricing.js'

const NOW = new Date('2026-11-08T12:00:00+08:00').getTime()
const HOUR = 3_600_000

function event(type, time, data, extra = {}) {
  return JSON.stringify({ type, time, seq: Math.floor(time / 1000), data, ...extra })
}

function fixtureText() {
  return [
    JSON.stringify({ type: 'session', version: 4, id: 's-1', createdAt: NOW - 8 * HOUR, cwd: 'L:\\work\\alpha' }),
    event('session/title', NOW - 7.9 * HOUR, { title: 'Alpha 会话' }),
    event('turn/start', NOW - 7.8 * HOUR, { turn: 1 }),
    event('request/header', NOW - 7.7 * HOUR, {
      header: { config: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } },
    }),
    event('assistant/chunk', NOW - 7 * HOUR, {
      turn: 1,
      step: 1,
      chunk: { type: 'usage', usage: { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 9000, reasoningTokens: 50 } },
    }),
    event('assistant/chunk', NOW - 2 * HOUR, {
      turn: 1,
      step: 2,
      chunk: { type: 'usage', usage: { inputTokens: 500, outputTokens: 100, cacheReadTokens: 4500, reasoningTokens: 20 } },
    }),
    event('user/message', NOW - 7.6 * HOUR, { content: [{ type: 'text', text: 'Hello alpha' }] }),
  ].join('\n') + '\n'
}

test('parseSessionText reads session metadata and every usage event', () => {
  const session = parseSessionText(fixtureText(), 'fallback')
  assert.equal(session.id, 's-1')
  assert.equal(session.cwd, 'L:\\work\\alpha')
  assert.equal(session.title, 'Alpha 会话')
  assert.equal(session.turns, 1)
  assert.equal(session.requests.length, 2)
  assert.deepEqual(
    session.requests.map((request) => [request.provider, request.model, request.input, request.cacheRead, request.output]),
    [
      ['opencode-go', 'deepseek-v4.1-flash', 1000, 9000, 200],
      ['opencode-go', 'deepseek-v4.1-flash', 500, 4500, 100],
    ],
  )
})

test('assistant/message usage overrides the stream chunk for the same step', () => {
  const text = [
    JSON.stringify({ type: 'session', version: 4, id: 's-2', createdAt: NOW - HOUR, cwd: 'L:\\work\\beta' }),
    event('request/header', NOW - 0.9 * HOUR, {
      header: { config: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } },
    }),
    event('assistant/chunk', NOW - 0.5 * HOUR, {
      turn: 1,
      step: 1,
      chunk: { type: 'usage', usage: { inputTokens: 10, outputTokens: 1, cacheReadTokens: 20 } },
    }),
    event('assistant/message', NOW - 0.4 * HOUR, {
      turn: 1,
      step: 1,
      usage: { inputTokens: 100, outputTokens: 7, cacheReadTokens: 300 },
      message: { role: 'assistant', content: [] },
    }),
  ].join('\n') + '\n'
  const session = parseSessionText(text, 'fallback')
  assert.equal(session.requests.length, 1)
  assert.deepEqual(
    [session.requests[0].input, session.requests[0].cacheRead, session.requests[0].output],
    [100, 300, 7],
  )
})

test('scanSessions fills a usage-less log from the projection cache', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-usage-proj-'))
  try {
    const sessionsRoot = path.join(root, 'sessions')
    const dir = path.join(sessionsRoot, '--L-work-gamma--', 'session-s-3')
    await fs.mkdir(dir, { recursive: true })
    const text = [
      JSON.stringify({ type: 'session', version: 4, id: 'session-s-3', createdAt: NOW - HOUR, cwd: 'L:\\work\\gamma' }),
      event('session/title', NOW - HOUR, { title: 'Gamma 会话' }),
    ].join('\n') + '\n'
    await fs.writeFile(path.join(dir, 'session.v4.jsonl'), text)
    const projectionDir = path.join(root, 'storages', 'session_projcache', 'sessions')
    await fs.mkdir(projectionDir, { recursive: true })
    await fs.writeFile(path.join(projectionDir, 'session-s-3.json'), JSON.stringify({
      record: {
        identity: { cwd: 'L:\\work\\gamma', createdAt: NOW - HOUR },
        rows: {
          title: { val: 'Gamma 会话' },
          tokenUsage: { val: { totals: { uncachedInputTokens: 1234, outputTokens: 56, cacheReadTokens: 7890, cacheWriteTokens: 0 } } },
          sessionStats: { val: { steps: 3, lastTurn: 1 } },
          modelSelection: { val: { lastUsed: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } } },
          sessionListMetadata: { val: { lastPromptAt: NOW - 0.2 * HOUR } },
        },
      },
    }))
    const result = await scanSessions(sessionsRoot, new Map())
    assert.equal(result.sessions.length, 1)
    const session = result.sessions[0]
    assert.equal(session.requests.length, 1)
    assert.equal(session.requests[0].synthetic, true)
    assert.equal(session.requests[0].provider, 'opencode-go')
    assert.deepEqual(
      [session.requests[0].input, session.requests[0].cacheRead, session.requests[0].output],
      [1234, 7890, 56],
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('summarizeSessions rolls up totals, days, workspaces and sessions', () => {
  const session = parseSessionText(fixtureText(), 'fallback')
  const summary = summarizeSessions([session], { range: '7d', now: NOW, pricing: {} })
  assert.equal(summary.totals.requests, 2)
  assert.equal(summary.totals.tokens, 15_300)
  assert.equal(summary.totals.input, 1500)
  assert.equal(summary.totals.cacheRead, 13_500)
  assert.equal(summary.totals.output, 300)
  assert.equal(summary.days.length, 7)
  assert.equal(summary.days.at(-1).requests, 2)
  assert.equal(summary.sessions[0].title, 'Alpha 会话')
  assert.equal(summary.workspaces[0].name, 'alpha')
  assert.equal(summary.models[0].model, 'deepseek-v4.1-flash')
  assert.equal(summary.totals.currency, 'USD')
  assert.ok(summary.totals.cost > 0)
  assert.equal(summary.totals.costComplete, true)
})

test('summarizeSessions computes a configured model price', () => {
  const session = parseSessionText(fixtureText().replaceAll('opencode-go', 'deepseek-official'), 'fallback')
  const summary = summarizeSessions([session], {
    range: 'all',
    now: NOW,
    pricing: { 'deepseek-v4.1-flash': { input: 2, cacheRead: 0.2, output: 4 } },
  })
  // 1500 * 2 + 13500 * 0.2 + 300 * 4 = 6900 / 1e6
  assert.equal(summary.totals.cost, 0.0069)
  assert.equal(summary.totals.pricedRequests, 2)
  assert.equal(summary.totals.costComplete, true)
})

test('summarizeSessions prices OpenCode Go usage from the built-in table', () => {
  const session = parseSessionText(fixtureText(), 'fallback')
  const summary = summarizeSessions([session], {
    range: 'all',
    now: NOW,
    pricing: { 'deepseek-v4.1-flash': { input: 2, cacheRead: 0.2, output: 4 } },
  })
  assert.equal(summary.requests[0].billing, 'go')
  assert.equal(summary.requests[0].currency, 'USD')
  assert.ok(summary.requests[0].cost > 0)
  // Configured CNY pricing must not override Go's own table.
  assert.equal(summary.totals.currency, 'USD')
})

test('OpenCode Go chooses DeepSeek peak and off-peak rates', () => {
  const usage = { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }
  const peak = Date.UTC(2026, 10, 6, 2, 0, 0) // Friday 02:00 UTC
  const offPeak = Date.UTC(2026, 10, 7, 2, 0, 0) // Saturday 02:00 UTC
  assert.equal(opencodeGoCost('deepseek-v4.1-flash', peak, usage), 0.3)
  assert.equal(opencodeGoCost('deepseek-v4.1-flash', offPeak, usage), 0.15)
  const output = { input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }
  assert.equal(opencodeGoCost('deepseek-v4.1-flash', peak, output), 1.2)
  assert.equal(opencodeGoCost('deepseek-v4.1-flash', offPeak, output), 0.6)
})

test('summarizeSessions filters and sorts by activity or tokens', () => {
  const first = parseSessionText(fixtureText(), 'fallback')
  const second = structuredClone(first)
  second.id = 's-2'
  second.cwd = 'L:\\work\\beta'
  second.title = 'Beta 会话'
  second.requests = second.requests.map((request) => ({
    ...request,
    time: request.time + 1000,
    input: 100,
    cacheRead: 0,
    cacheWrite: 0,
    output: 10,
  }))
  const active = summarizeSessions([first, second], { range: 'all', now: NOW })
  assert.equal(active.sessions[0].id, 's-2')
  assert.equal(active.sessions[1].id, 's-1')
  const byTokens = summarizeSessions([first, second], { range: 'all', now: NOW, sort: 'tokens' })
  assert.equal(byTokens.sessions[0].id, 's-1')
  const alpha = summarizeSessions([first, second], {
    range: 'all',
    now: NOW,
    filters: { workspace: 'L:\\work\\alpha' },
  })
  assert.equal(alpha.totals.requests, 2)
  assert.equal(alpha.facets.workspaces.length, 2)
  const one = summarizeSessions([first, second], { range: 'all', now: NOW, filters: { session: 's-2' } })
  assert.equal(one.totals.requests, 2)
  assert.equal(one.sessions.length, 1)
})
test('DeepSeek official prices use peak and off-peak CNY rates', () => {
  const usage = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0 }
  const offPeak = new Date('2026-11-08T02:00:00+08:00').getTime()
  const peak = new Date('2026-11-08T10:00:00+08:00').getTime()
  assert.equal(deepseekOfficialCost('deepseek-v4.1-flash', offPeak, usage), 5.02)
  assert.equal(deepseekOfficialCost('deepseek-v4.1-flash', peak, usage), 10.04)
  assert.equal(deepseekOfficialCost('deepseek-v4-pro', offPeak, usage), 18.15)
  assert.equal(deepseekOfficialCost('deepseek-v4-pro', peak, usage), 36.3)
  assert.equal(deepseekOfficialCost('deepseek-v4-flash', peak, usage), 10.04)
})

test('summarizeSessions supports custom windows and text search', () => {
  const session = parseSessionText(fixtureText(), 'fallback')
  const custom = summarizeSessions([session], {
    range: 'custom',
    from: NOW - 3 * HOUR,
    to: NOW - 1 * HOUR,
    now: NOW,
  })
  assert.equal(custom.totals.requests, 1)
  assert.equal(custom.from, NOW - 3 * HOUR)
  assert.equal(custom.to, NOW - 1 * HOUR)
  assert.equal(custom.days.length, 1)
  const searched = summarizeSessions([session], { range: 'all', now: NOW, search: 'alpha' })
  assert.equal(searched.totals.requests, 2)
  const missing = summarizeSessions([session], { range: 'all', now: NOW, search: 'not-there' })
  assert.equal(missing.totals.requests, 0)
})
test('zstd frame splitting decodes concatenated frames', async () => {
  const text = fixtureText()
  const lines = text.split('\n').filter(Boolean)
  const first = zlib.zstdCompressSync(Buffer.from(lines.slice(0, 2).join('\n') + '\n'))
  const second = zlib.zstdCompressSync(Buffer.from(lines.slice(2).join('\n') + '\n'))
  const merged = Buffer.concat([first, second])
  assert.equal(decompressZstdFrames(merged), text)
  assert.equal(decompressZstdFramesTolerant(Buffer.concat([first, second.subarray(0, 6)])), lines.slice(0, 2).join('\n') + '\n')
})

test('scanSessions and HTTP handler serve the aggregate', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-usage-test-'))
  try {
    const dir = path.join(root, '--L-work-alpha--', 'session-s-1')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'session.v4.jsonl.zstd'), zlib.zstdCompressSync(Buffer.from(fixtureText())))

    const ctx = {
      get(name) {
        if (name === 'credentials') {
          return {
            async resolve(ref) {
              if (ref === 'OPENCODE_GO_API_KEY') return { value: 'test-opencode' }
              if (ref === 'DEEPSEEK_API_KEY') return { value: 'test-deepseek' }
              return undefined
            },
          }
        }
        if (name === 'agentDefaultModel') {
          return { currentSelection: () => ({ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }) }
        }
        return undefined
      },
    }
    const calls = []
    const fetchImpl = async (url) => {
      calls.push(String(url))
      if (String(url).includes('opencode.ai')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              usage: {
                rolling: { status: 'ok', percent: 2, resetsAt: '2026-11-08T04:00:00.000Z' },
                weekly: { status: 'ok', percent: 86, resetsAt: '2026-11-09T00:00:00.000Z' },
                monthly: { status: 'ok', percent: 61, resetsAt: '2026-11-28T00:00:00.000Z' },
              },
            }
          },
        }
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '9.70', granted_balance: '0', topped_up_balance: '9.70' }] }
        },
      }
    }
    const handler = createHandler(ctx, {
      config: { refreshSeconds: 0, balanceSeconds: 0 },
      fetchImpl,
      now: () => NOW,
      scanRoot: root,
    })
    let body
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(key, value) { this.headers[key] = value },
      end(value) { body = value },
    }
    await handler({ method: 'GET', url: '/plugins/dsh-usage-statistics/data?range=7d&force=1', socket: { remoteAddress: '127.0.0.1' } }, res)
    assert.equal(res.statusCode, 200)
    const payload = JSON.parse(body)
    assert.equal(payload.ok, true)
    assert.equal(payload.totals.requests, 2)
    assert.equal(payload.balance.providers[0].id, 'opencode-go')
    assert.equal(payload.balance.providers[0].windows.weekly.percent, 86)
    assert.equal(payload.balance.providers[1].balances[0].total, 9.7)
    assert.equal(calls.length, 2)
    assert.equal(payload.requests.length, 2)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('handler reports missing keys without failing the request', async () => {
  const ctx = { get: () => undefined }
  const handler = createHandler(ctx, {
    config: { refreshSeconds: 0, balanceSeconds: 0 },
    fetchImpl: async () => {
      throw new Error('fetch should not run')
    },
    now: () => NOW,
    scanRoot: path.join(os.tmpdir(), 'dsh-usage-empty-does-not-exist'),
  })
  let body
  const res = {
    statusCode: 0,
    setHeader() {},
    end(value) { body = value },
  }
  await handler({ method: 'GET', url: '/plugins/dsh-usage-statistics/data?range=7d', socket: { remoteAddress: '127.0.0.1' } }, res)
  assert.equal(res.statusCode, 200)
  const payload = JSON.parse(body)
  assert.equal(payload.ok, true)
  assert.equal(payload.balance.providers.every((provider) => provider.code === 'no-key'), true)
})

test('external sources are opt-in, ingest into the same totals, and deduplicate', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-usage-sources-'))
  try {
    const store = createSourceStore({ home: root, now: () => NOW })
    const input = {
      source: { id: 'cc-guard', label: 'CC-Guard 自动审核', kind: 'plugin' },
      events: [{
        time: NOW - HOUR,
        provider: 'deepseek-official',
        model: 'deepseek-v4.1-flash',
        input: 1200,
        cacheRead: 3000,
        cacheWrite: 0,
        output: 300,
        cost: 0.02,
        currency: 'CNY',
        sessionId: 'review-1',
        title: '命令审核',
        workspace: 'L:/demo/guard',
      }],
    }
    const first = await store.ingest(input)
    assert.equal(first.accepted, 1)
    assert.equal(first.source.id, 'cc-guard')
    const second = await store.ingest(input)
    assert.equal(second.accepted, 0)
    assert.equal(second.duplicates, 1)

    const catalog = await store.catalog()
    assert.equal(catalog[0].id, 'cc-guard')
    assert.equal(catalog[0].events, 1)

    const sessions = await store.sessions()
    const summary = summarizeSessions(sessions, {
      range: '7d',
      now: NOW,
      pricing: {},
      requestsLimit: 100,
      sources: ['cc-guard'],
    })
    assert.equal(summary.totals.requests, 1)
    assert.equal(summary.totals.tokens, 4500)
    assert.equal(summary.totals.costs.CNY, 0.02)
    assert.equal(summary.facets.sources[0].id, 'cc-guard')

    const ctx = { get: () => undefined }
    const handler = createHandler(ctx, {
      config: { refreshSeconds: 0, balanceSeconds: 0 },
      fetchImpl: async () => { throw new Error('offline') },
      now: () => NOW,
      scanRoot: path.join(root, 'sessions'),
      sourceStore: store,
    })
    const read = async (url) => {
      let body
      const res = { statusCode: 0, setHeader() {}, end(value) { body = value } }
      await handler({ method: 'GET', url, socket: { remoteAddress: '127.0.0.1' } }, res)
      return { status: res.statusCode, payload: JSON.parse(body) }
    }
    const guarded = await read('/plugins/dsh-usage-statistics/data?range=7d&sources=cc-guard&force=1')
    assert.equal(guarded.payload.totals.requests, 1)
    assert.equal(guarded.payload.sources.some((source) => source.id === 'dsh-session'), true)
    assert.equal(guarded.payload.sources.some((source) => source.id === 'cc-guard'), true)
    const defaults = await read('/plugins/dsh-usage-statistics/data?range=7d&force=1')
    assert.equal(defaults.payload.totals.requests, 0)
    const none = await read('/plugins/dsh-usage-statistics/data?range=7d&sources=none&force=1')
    assert.equal(none.payload.totals.requests, 0)
    assert.equal(none.payload.facets.sources.length, 0)

    const ingest = createIngestHandler(ctx, { sourceStore: store })
    const req = Readable.from([Buffer.from(JSON.stringify({
      source: { id: 'cc-guard', label: 'CC-Guard 自动审核', kind: 'plugin' },
      events: [{ id: 'new-event', time: NOW, provider: 'deepseek-official', model: 'deepseek-v4.1-flash', input: 10, output: 2, sessionId: 'review-2' }],
    }))])
    req.method = 'POST'
    req.headers = {}
    req.socket = { remoteAddress: '127.0.0.1' }
    let body
    const res = { statusCode: 0, setHeader() {}, end(value) { body = value } }
    await ingest(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal(JSON.parse(body).accepted, 1)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('activate provider saves the first available model', async () => {
  let saved
  const ctx = {
    get(name) {
      if (name === 'llm') {
        return {
          listProviders: () => [{ id: 'demo-gateway', name: 'Demo Gateway' }],
          listModels: async () => [{ id: 'demo-model' }],
        }
      }
      if (name === 'agentDefaultModel') {
        return { saveSelection: async (next) => { saved = next } }
      }
      return undefined
    },
  }
  const handler = createActivateHandler(ctx)
  const req = Readable.from([Buffer.from(JSON.stringify({ provider: 'demo-gateway' }))])
  req.method = 'POST'
  req.headers = {}
  req.socket = { remoteAddress: '127.0.0.1' }
  let body
  const res = { statusCode: 0, setHeader() {}, end(value) { body = value } }
  await handler(req, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(saved, { provider: 'demo-gateway', model: 'demo-model' })
  assert.equal(JSON.parse(body).ok, true)
})
