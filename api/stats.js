// Vercel function for /api/stats. The counting itself lives in server/stats.mjs.
import { handleStats } from '../server/stats.mjs'

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 1000) break }
  try { return JSON.parse(raw) } catch { return {} }
}

export default function handler(req, res) {
  return handleStats(req, res, readBody)
}
