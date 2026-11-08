/**
 * OpenCode Go token prices, in USD per 1M tokens.
 * Source: https://opencode.ai/docs/console/go/ (fetched 2026-11-08).
 *
 * `peak` entries use the DeepSeek V4 peak window: 01:00-04:00 and
 * 06:00-10:00 UTC, Monday through Friday. Everything else is off-peak.
 */

const PEAK_WINDOWS = [
  [1, 4],
  [6, 10],
]

function isDeepSeekPeak(time) {
  const date = new Date(time)
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false
  const hour = date.getUTCHours()
  return PEAK_WINDOWS.some(([start, end]) => hour >= start && hour < end)
}

const rate = (input, output, cacheRead, cacheWrite = 0) => ({ input, output, cacheRead, cacheWrite })

/** model id -> prices. `tiers` choose by input context; `peak` chooses by UTC time. */
export const OPENCODE_GO_PRICING = Object.freeze({
  'glm-5.3-flash': { name: 'GLM-5.3-Flash', rates: rate(0.15, 0.5, 0.03) },
  'glm-5.3': { name: 'GLM-5.3', rates: rate(1.4, 4.4, 0.26) },
  'glm-5.2': { name: 'GLM-5.2', rates: rate(1.4, 4.4, 0.26) },
  'kimi-k3.1-pro': { name: 'Kimi K3.1 Pro', rates: rate(2, 10, 0.2, 2) },
  'kimi-k3': { name: 'Kimi K3', rates: rate(3, 15, 0.3, 3) },
  'kimi-k2.7-code': { name: 'Kimi K2.7 Code', rates: rate(0.95, 4, 0.19) },
  'longcat-2.0': { name: 'LongCat-2.0', rates: rate(0.3, 1.2, 0.006) },
  'step-5-preview': { name: 'Step 5 Preview', rates: rate(1, 2.7, 0.1) },
  'crouton-alpha-free': { name: 'Crouton Alpha Free', free: true },
  'beam-free': { name: 'Beam Free', free: true },
  'iceman-contributor-free': { name: 'Iceman Contributor Free', free: true },
  'mimo-v2.6-flash': { name: 'MiMo-V2.6-Flash', rates: rate(0.14, 0.28, 0.0028) },
  'mimo-v2.6-pro': { name: 'MiMo-V2.6-Pro', rates: rate(0.435, 0.87, 0.003625) },
  'mimo-v2.5': { name: 'MiMo-V2.5', rates: rate(0.14, 0.28, 0.0028) },
  'mimo-v2.5-pro': { name: 'MiMo-V2.5-Pro', rates: rate(0.435, 0.87, 0.003625) },
  'minimax-m3.1-flash': { name: 'MiniMax M3.1 Flash', rates: rate(0.15, 0.6, 0.015) },
  'minimax-m3': {
    name: 'MiniMax M3',
    tiers: [
      { maxContext: 512_000, rates: rate(0.3, 1.2, 0.06) },
      { rates: rate(0.6, 2.4, 0.12) },
    ],
  },
  'muse-spark-1.3-contributor': { name: 'Muse Spark 1.3 Contributor', rates: rate(0.1, 0.2, 0.002) },
  'muse-spark-1.2-contributor': { name: 'Muse Spark 1.2 Contributor', rates: rate(0.1, 0.2, 0.002) },
  'qwen3.8-max': { name: 'Qwen3.8 Max', rates: rate(2, 6, 0.25, 2.5) },
  'qwen3.8-flash': { name: 'Qwen3.8 Flash', rates: rate(0.15, 0.47, 0.016, 0.2) },
  'qwen3.7-plus': {
    name: 'Qwen3.7 Plus',
    tiers: [
      { maxContext: 256_000, rates: rate(0.4, 1.6, 0.04, 0.5) },
      { rates: rate(1.2, 4.8, 0.12, 1.5) },
    ],
  },
  'deepseek-v4.1-flash': {
    name: 'DeepSeek V4.1 Flash',
    peak: true,
    offPeak: rate(0.15, 0.6, 0.003),
    peakRates: rate(0.3, 1.2, 0.006),
  },
  'deepseek-v4-pro': {
    name: 'DeepSeek V4 Pro',
    peak: true,
    offPeak: rate(0.66, 1.98, 0.022),
    peakRates: rate(1.32, 3.96, 0.044),
  },
  hy4: { name: 'Hy4', rates: rate(0.834, 2.501, 0.042) },
  'hy4-preview': { name: 'Hy4 preview', rates: rate(0.834, 2.501, 0.042) },
  hy3: { name: 'Hy3', rates: rate(0.14, 0.58, 0.035) },
  'grok-4.7': {
    name: 'Grok 4.7',
    tiers: [
      { maxContext: 200_000, rates: rate(2, 6, 0.5) },
      { rates: rate(4, 12, 1) },
    ],
  },
  'gpt-6-luna': {
    name: 'GPT 6 Luna',
    tiers: [
      { maxContext: 272_000, rates: rate(0.1, 0.5, 0.01, 0.125) },
      { rates: rate(0.2, 0.75, 0.02, 0.25) },
    ],
  },
  'gpt-5.6-luna': {
    name: 'GPT 5.6 Luna',
    tiers: [
      { maxContext: 272_000, rates: rate(0.2, 1.2, 0.02, 0.25) },
      { rates: rate(0.4, 1.8, 0.04, 0.5) },
    ],
  },
  'claude-haiku-5-5': {
    name: 'Claude Haiku 5.5',
    tiers: [
      { maxContext: 100_000, rates: rate(0.1, 0.5, 0.01, 0.125) },
      { rates: rate(0.5, 2.5, 0.05, 0.625) },
    ],
  },
  'gemini-4-argon': { name: 'Gemini 4 Argon', rates: rate(2, 10, 0.1) },
})

/** Normalize a provider model id (`opencode-go/deepseek-v4.1-flash` too). */
export function normalizeModelId(model) {
  const text = String(model ?? '').trim().toLowerCase()
  const slash = text.lastIndexOf('/')
  return slash === -1 ? text : text.slice(slash + 1)
}

/**
 * Resolve the applicable rate for one request.
 * @param {string} model - provider model id.
 * @param {number} time - request timestamp.
 * @param {object} usage - token counts.
 * @returns {{rates: object, free: boolean}|null} rate, or null when unknown.
 */
export function opencodeGoRate(model, time, usage) {
  const entry = OPENCODE_GO_PRICING[normalizeModelId(model)]
  if (entry === undefined) return null
  if (entry.free === true) return { rates: rate(0, 0, 0), free: true }
  let rates = entry.rates
  if (entry.peak === true) rates = isDeepSeekPeak(time) ? entry.peakRates : entry.offPeak
  else if (Array.isArray(entry.tiers)) {
    const context = (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0)
    rates = context > entry.tiers[0].maxContext ? entry.tiers[1].rates : entry.tiers[0].rates
  }
  return rates === undefined ? null : { rates, free: false }
}

/**
 * Estimated USD value of one OpenCode Go request.
 * @param {string} model - provider model id.
 * @param {number} time - request timestamp.
 * @param {object} usage - token counts.
 * @returns {number|null} dollars, or null when the model is not priced.
 */
export function opencodeGoCost(model, time, usage) {
  const resolved = opencodeGoRate(model, time, usage)
  if (resolved === null) return null
  const { rates } = resolved
  return (
    ((usage.input ?? 0) * rates.input +
      (usage.output ?? 0) * rates.output +
      (usage.cacheRead ?? 0) * rates.cacheRead +
      (usage.cacheWrite ?? 0) * rates.cacheWrite) /
    1_000_000
  )
}

/**
 * DeepSeek official API prices, CNY per 1M tokens.
 * Off-peak is 00:30-08:30 Asia/Shanghai (16:30-00:30 UTC).
 * Source: DeepSeek price table, V4.1-Flash-1017 / V4-Pro-0813.
 */
const DEEPSEEK_OFFICIAL = Object.freeze({
  'deepseek-v4.1-flash': {
    name: 'DeepSeek V4.1 Flash',
    peak: rate(2, 8, 0.04),
    offPeak: rate(1, 4, 0.02),
  },
  'deepseek-v4-pro': {
    name: 'DeepSeek V4 Pro',
    peak: rate(9, 27, 0.3),
    offPeak: rate(4.5, 13.5, 0.15),
  },
})

const DEEPSEEK_ALIASES = Object.freeze({
  'deepseek-v4.1-flash-1017': 'deepseek-v4.1-flash',
  'deepseek-v4-flash': 'deepseek-v4.1-flash',
  'deepseek-v4-flash-vision-exp': 'deepseek-v4.1-flash',
  'deepseek-flash': 'deepseek-v4.1-flash',
  'deepseek-v4-pro-0813': 'deepseek-v4-pro',
})

function isDeepSeekOffPeak(time) {
  const date = new Date(time)
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  return minutes >= 16 * 60 + 30 || minutes < 30
}

/**
 * Estimated CNY cost of one DeepSeek official request.
 * @param {string} model - provider model id.
 * @param {number} time - request timestamp.
 * @param {object} usage - token counts.
 * @returns {number|null} yuan, or null when the model is not in the table.
 */
export function deepseekOfficialCost(model, time, usage) {
  const normalized = normalizeModelId(model)
  const id = DEEPSEEK_ALIASES[normalized] ?? normalized
  const entry = DEEPSEEK_OFFICIAL[id]
  if (entry === undefined) return null
  const rates = isDeepSeekOffPeak(time) ? entry.offPeak : entry.peak
  return (
    ((usage.input ?? 0) * rates.input +
      (usage.output ?? 0) * rates.output +
      (usage.cacheRead ?? 0) * rates.cacheRead +
      (usage.cacheWrite ?? 0) * rates.cacheWrite) /
    1_000_000
  )
}
