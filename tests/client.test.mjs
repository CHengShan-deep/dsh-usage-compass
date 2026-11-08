import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const profileBases = [
  fileURLToPath(new URL('../../tools/harness/package.json', import.meta.url)),
  path.join(os.homedir(), '.dsh', 'profiles', 'index.js'),
  path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'package.json'),
  path.join(os.homedir(), '.dsh', 'profiles', 'web', 'package.json'),
]
let React
let ReactDOM
let renderToStaticMarkup
for (const base of profileBases) {
  try {
    const req = createRequire(base)
    React = req('react')
    ReactDOM = req('react-dom')
    renderToStaticMarkup = req('react-dom/server').renderToStaticMarkup
    break
  } catch {
    React = null
  }
}

const sample = {
  ok: true,
  generatedAt: '2026-11-07T16:24:00.000Z',
  version: '0.3.0',
  range: 'all',
  active: { provider: 'opencode-go', model: 'deepseek-v4.1-flash', source: 'default' },
  totals: {
    requests: 472,
    input: 768224,
    cacheRead: 83879680,
    cacheWrite: 0,
    output: 782302,
    reasoning: 503736,
    tokens: 85430206,
    cacheHitRate: 0.9909,
    cost: 0.0042,
    currency: 'USD',
    costs: { USD: 0.0042 },
    costMixed: false,
    pricedRequests: 472,
    sessions: 5,
    workspaces: 5,
    costComplete: true,
  },
  days: [
    { date: '2026-08-14', requests: 125, tokens: 18392848, input: 138762, cacheRead: 18131968, output: 122118 },
    { date: '2026-08-15', requests: 166, tokens: 37707571, input: 382538, cacheRead: 36983168, output: 341865 },
    { date: '2026-08-16', requests: 49, tokens: 8632098, input: 58409, cacheRead: 8457856, output: 115833 },
    { date: '2026-08-17', requests: 7, tokens: 1543210, input: 1749, cacheRead: 1539968, output: 1493 },
  ],
  models: [
    { provider: 'deepseek-official', model: 'deepseek-v4-flash', requests: 347, tokens: 66275727, sessions: 1, cacheHitRate: 0.99, cost: null, pricedRequests: 0 },
  ],
  workspaces: [
    { path: 'L:\\work\\alpha', name: 'alpha', sessions: 1, requests: 144, tokens: 32420334, lastAt: 1787475801993, cacheHitRate: 0.99, cost: null, pricedRequests: 0 },
  ],
  sessions: [
    {
      id: 's-1',
      title: 'Alpha 会话',
      cwd: 'L:\\work\\alpha',
      workspace: 'alpha',
      provider: 'opencode-go',
      model: 'deepseek-v4.1-flash',
      createdAt: 1787470000000,
      turns: 3,
      lastAt: 1787475801993,
      firstAt: 1787470000000,
      requests: 144,
      tokens: 32420334,
      cacheHitRate: 0.99,
      cost: null,
      pricedRequests: 0,
    },
  ],
  requests: [
    {
      time: 1787475801993,
      sessionId: 's-1',
      sessionTitle: 'Alpha 会话',
      provider: 'opencode-go',
      model: 'deepseek-v4.1-flash',
      input: 1200,
      cacheRead: 29056,
      cacheWrite: 0,
      output: 4266,
      reasoning: 3012,
      cost: 0.0031,
      currency: 'USD',
      billing: 'go',
    },
  ],
  facets: {
    workspaces: [{ path: 'L:\\work\\alpha', name: 'alpha', requests: 144, tokens: 32420334, lastAt: 1787475801993 }],
    providers: [{ id: 'opencode-go', requests: 144, tokens: 32420334, lastAt: 1787475801993 }],
    models: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash', requests: 144, tokens: 32420334, lastAt: 1787475801993 }],
    sessions: [{ id: 's-1', title: 'Alpha 会话', workspace: 'alpha', requests: 144, tokens: 32420334, lastAt: 1787475801993 }],
  },
  balance: {
    fetchedAt: '2026-11-07T16:24:00.000Z',
    activeProvider: 'opencode-go',
    activeId: 'opencode-go',
    accountLogin: false,
    providers: [
      {
        id: 'opencode-go',
        name: 'OpenCode Go',
        kind: 'subscription',
        active: true,
        ok: true,
        windows: {
          rolling: { status: 'ok', percent: 2, resetsAt: '2026-11-07T19:52:20.000Z' },
          weekly: { status: 'ok', percent: 86, resetsAt: '2026-11-09T00:00:00.000Z' },
          monthly: { status: 'ok', percent: 61, resetsAt: '2026-11-28T09:45:55.000Z' },
        },
      },
      {
        id: 'deepseek',
        name: 'DeepSeek 官方',
        kind: 'api',
        active: false,
        ok: true,
        available: true,
        balances: [{ currency: 'CNY', total: 9.7, granted: 0, toppedUp: 9.7 }],
      },
    ],
  },
  scanned: { sessions: 5, requests: 472, firstAt: 1787470000000, lastAt: 1787475801993 },
  scan: { sessions: 24, parsed: 0, requests: 472, errors: [], durationMs: 12, root: 'C:\\Users\\demo\\.dsh\\sessions' },
}

async function loadClient() {
  const source = await fs.readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let definition
  const documentStub = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, style: {}, textContent: '', setAttribute() {} }),
    head: { appendChild() {} },
  }
  const sandbox = {
    window: { __ModuleLoader__: { load: (value) => { definition = value } } },
    document: documentStub,
    console,
    fetch: async () => { throw new Error('fetch must not run while rendering a snapshot') },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    Date,
    Intl,
    Math,
    JSON,
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)
  return definition.factory((id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return ReactDOM
    throw new Error(`unexpected require: ${id}`)
  })
}

test('client bundle registers a settings section', { skip: React === null }, async () => {
  const exports = await loadClient()
  assert.equal(typeof exports.apply, 'function')
  let registered
  const ctx = {
    slots: {
      inject(name, callback) {
        callback()
      },
      register(options, component) {
        registered = { options, component }
      },
    },
  }
  exports.apply(ctx)
  assert.equal(registered.options.name, 'settings.section')
  assert.equal(registered.options.id, 'usage-statistics')
  assert.equal(registered.options.label(), '用量统计')
})

test('UsageView renders balances, totals, trend, ranking and log', { skip: React === null }, async () => {
  const exports = await loadClient()
  const html = renderToStaticMarkup(React.createElement(exports.UsageView, {
    data: sample,
    phase: 'ready',
    error: '',
    range: { mode: 'all', from: null, to: null },
    onRange() {},
    onRefresh() {},
    filters: { workspace: '', provider: '', model: '', session: '' },
    onFilters() {},
    sort: 'active',
    onSort() {},
    search: '',
    onSearch() {},
  }))
  assert.match(html, /用量统计/)
  assert.match(html, /OpenCode Go/)
  assert.match(html, /当前生效/)
  assert.match(html, /86%/)
  assert.match(html, /98%/)
  assert.match(html, /9\.70/)
  assert.match(html, /Alpha 会话/)
  assert.match(html, /deepseek-v4\.1-flash/)
  assert.match(html, /\$0\.0042/)
  assert.match(html, /85\.43M/)
})

test('UsageView renders a readable empty state', { skip: React === null }, async () => {
  const exports = await loadClient()
  const empty = {
    ...sample,
    totals: { ...sample.totals, requests: 0, tokens: 0, input: 0, cacheRead: 0, output: 0, cacheHitRate: null, sessions: 0, workspaces: 0 },
    days: [],
    models: [],
    workspaces: [],
    sessions: [],
    requests: [],
    scanned: { sessions: 0, requests: 0, firstAt: null, lastAt: null },
  }
  const html = renderToStaticMarkup(React.createElement(exports.UsageView, {
    data: empty,
    phase: 'ready',
    error: '',
    range: { mode: '7d', from: null, to: null },
    onRange() {},
    onRefresh() {},
    filters: { workspace: '', provider: '', model: '', session: '' },
    onFilters() {},
    sort: 'active',
    onSort() {},
    search: '',
    onSearch() {},
  }))
  assert.match(html, /当前筛选范围内还没有 API 用量/)
  assert.match(html, /0/)
})

test('UsageView paginates the breakdown and request log', { skip: React === null }, async () => {
  const exports = await loadClient()
  const sessions = Array.from({ length: 12 }, (_, index) => ({
    ...sample.sessions[0],
    id: `s-${index + 1}`,
    title: `会话 ${index + 1}`,
    lastAt: sample.sessions[0].lastAt - index * 1000,
  }))
  const requests = Array.from({ length: 12 }, (_, index) => ({
    ...sample.requests[0],
    time: sample.requests[0].time + index * 1000,
    sessionId: `s-${(index % 12) + 1}`,
  }))
  const html = renderToStaticMarkup(React.createElement(exports.UsageView, {
    data: { ...sample, sessions, requests, totals: { ...sample.totals, requests: 12, sessions: 12 } },
    phase: 'ready',
    error: '',
    range: { mode: 'all', from: null, to: null },
    onRange() {},
    onRefresh() {},
    filters: { workspace: '', provider: '', model: '', session: '' },
    onFilters() {},
    sort: 'active',
    onSort() {},
    search: '',
    onSearch() {},
  }))
  assert.match(html, /u-pager/)
  assert.match(html, /跳转页码/)
  assert.match(html, /\/ 2 页/)
  assert.match(html, /第 2 \/ 2 页/)
})
test('UsageView renders the subscription forecast tab', { skip: React === null }, async () => {
  const exports = await loadClient()
  const html = renderToStaticMarkup(React.createElement(exports.UsageView, {
    data: sample,
    phase: 'ready',
    error: '',
    range: { mode: '30d', from: null, to: null },
    onRange() {},
    onRefresh() {},
    filters: { workspace: '', provider: '', model: '', session: '' },
    onFilters() {},
    sort: 'active',
    onSort() {},
    search: '',
    onSearch() {},
    initialMetric: 'forecast',
  }))
  assert.match(html, /预测/)
  assert.match(html, /当前已用/)
  assert.match(html, /按趋势预计/)
  assert.match(html, /月额度 100%/)
})
test('UsageView labels the official balance line as a live balance', { skip: React === null }, async () => {
  const exports = await loadClient()
  const official = {
    ...sample,
    active: { provider: 'deepseek', model: 'deepseek-v4-flash', source: 'default' },
    balance: { ...sample.balance, activeId: 'deepseek' },
  }
  official.balance.providers = official.balance.providers.map((provider) => provider.id === 'deepseek'
    ? { ...provider, info: { total: 9.7, currency: 'CNY' } }
    : provider)
  const html = renderToStaticMarkup(React.createElement(exports.UsageView, {
    data: official,
    phase: 'ready',
    error: '',
    range: { mode: 'all', from: null, to: null },
    onRange() {},
    onRefresh() {},
    filters: { workspace: '', provider: 'deepseek', model: '', session: '' },
    onFilters() {},
    sort: 'active',
    onSort() {},
    search: '',
    onSearch() {},
    initialMetric: 'forecast',
  }))
  assert.match(html, /余额 ¥9\.70/)
  assert.match(html, /本周期已用/)
  assert.match(html, /DeepSeek 余额消耗预测/)
})