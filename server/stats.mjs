// Public usage counts: totals only, never names, chat text or anything about a person.
// Stored in Redis when REDIS_URL is set (production on Vercel), otherwise kept in memory.
import Redis from 'ioredis'

export const COUNTED = ['visitor', 'wrap', 'share']
const DAYS_SHOWN = 14
const PER_MINUTE = 30

const day = (offset = 0) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)

let redis
function store() {
  if (!process.env.REDIS_URL) return undefined
  redis ??= new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, connectTimeout: 5000 })
  return redis
}

// Used only when there is no Redis, such as on a laptop.
const memory = new Map()
const memoryStore = {
  async incr(key) { const next = (memory.get(key) ?? 0) + 1; memory.set(key, next); return next },
  async mget(...keys) { return keys.map((key) => memory.get(key) ?? null) }
}

/** Adds one to a counter. Returns false for an unknown event or a sender over the rate limit. */
export async function countEvent(event, sender = 'unknown') {
  if (!COUNTED.includes(event)) return false
  const db = store()
  if (db) {
    const minuteKey = `stats:rate:${sender}:${Math.floor(Date.now() / 60_000)}`
    const [[, sent]] = await db.multi().incr(minuteKey).expire(minuteKey, 90).exec()
    if (sent > PER_MINUTE) return false
    await db.multi().incr(`stats:total:${event}`).incr(`stats:day:${day()}:${event}`).expire(`stats:day:${day()}:${event}`, 60 * 86_400).exec()
    return true
  }
  await memoryStore.incr(`stats:total:${event}`)
  await memoryStore.incr(`stats:day:${day()}:${event}`)
  return true
}

/** Totals, today, and the last two weeks for each counter. */
export async function readStats() {
  const db = store() ?? memoryStore
  const days = Array.from({ length: DAYS_SHOWN }, (_, index) => day(DAYS_SHOWN - 1 - index))
  const keys = COUNTED.flatMap((event) => [`stats:total:${event}`, ...days.map((date) => `stats:day:${date}:${event}`)])
  const values = (await db.mget(...keys)).map((value) => Number(value ?? 0))
  const result = { updatedAt: new Date().toISOString(), days, totals: {}, daily: {} }
  COUNTED.forEach((event, index) => {
    const start = index * (DAYS_SHOWN + 1)
    result.totals[event] = values[start]
    result.daily[event] = values.slice(start + 1, start + 1 + DAYS_SHOWN)
  })
  return result
}

/** One handler for both the Vercel function and the local server. */
export async function handleStats(req, res, readBody) {
  const reply = (status, body) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.setHeader('cache-control', status === 200 && req.method === 'GET' ? 'public, max-age=30' : 'no-store')
    res.end(JSON.stringify(body))
  }
  try {
    if (req.method === 'GET') return reply(200, await readStats())
    if (req.method === 'POST') {
      const body = await readBody(req)
      const sender = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim()
      return reply(await countEvent(String(body?.event ?? ''), sender) ? 200 : 400, { ok: true })
    }
    return reply(405, { error: 'method_not_allowed' })
  } catch (error) {
    console.error('stats', error instanceof Error ? error.message : error)
    return reply(503, { error: 'stats_unavailable' })
  }
}
