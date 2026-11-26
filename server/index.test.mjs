import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'

const dir = mkdtempSync(join(tmpdir(), 'cw-server-'))
const children = []

async function start(port, env) {
  const child = spawn(process.execPath, ['server/index.mjs'], { env: { PATH: process.env.PATH, PORT: String(port), DATABASE_PATH: join(dir, `${port}.sqlite`), ...env }, stdio: 'ignore' })
  children.push(child)
  const base = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(`${base}/api/health`); return base } catch { await new Promise((resolve) => setTimeout(resolve, 50)) }
  }
  throw new Error('server did not start')
}
const post = (base, path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

// A stand-in for api.bachs.io that remembers the checkouts it was asked to create.
const checkouts = new Map()
let fakeBachs
function startFakeBachs(port) {
  fakeBachs = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
    if (req.headers.authorization !== 'Bearer sk_sandbox_test') return reply(401, {})
    if (req.method === 'POST') {
      const request = JSON.parse(Buffer.concat(chunks).toString())
      const id = `chk_${checkouts.size + 1}`
      checkouts.set(id, { request, session: { checkout_id: id, status: 'open', payment_status: 'processing', reference: request.reference, amount: request.pricing.amount, currency: request.pricing.currency, metadata: request.metadata } })
      return reply(201, { checkout_id: id, checkout_url: `https://checkout.bachs.io/c/${id}` })
    }
    const found = checkouts.get(req.url.split('/').at(-1))
    return found ? reply(200, found.session) : reply(404, {})
  })
  return new Promise((resolve) => fakeBachs.listen(port, '127.0.0.1', resolve))
}
const pay = (id) => Object.assign(checkouts.get(id).session, { status: 'completed', payment_status: 'succeeded' })
const webhook = (base, event, { secret = 'whsec_test', timestamp = Math.floor(Date.now() / 1000) } = {}) => {
  const raw = JSON.stringify(event)
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
  return fetch(`${base}/api/payments/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bachs-signature-v2': `t=${timestamp},v1=${signature}` }, body: raw })
}

let free, mock, capped, live
beforeAll(async () => {
  await startFakeBachs(18810)
  live = await start(18804, { VITE_PAYMENT_MODE: 'bachs', BACHS_SECRET_KEY: 'sk_sandbox_test', BACHS_WEBHOOK_SECRET: 'whsec_test', BACHS_API_URL: 'http://127.0.0.1:18810' })
  free = await start(18801, { VITE_PAYMENT_MODE: 'free' })
  mock = await start(18802, { VITE_PAYMENT_MODE: 'mock', MAX_RECOVERIES_PER_REFERENCE: '1' })
  capped = await start(18803, { VITE_PAYMENT_MODE: 'free', AI_DAILY_PLAN_LIMIT: '2' })
})
afterAll(() => { fakeBachs.close(); children.forEach((child) => child.kill()); rmSync(dir, { recursive: true, force: true }) })

describe('server hardening', () => {
  it('survives a request for a directory and a malformed Host header', async () => {
    await fetch(`${free}/assets`)
    const { request } = await import('node:http')
    await new Promise((resolve) => request(`${free}/`, { headers: { host: 'a b' } }, (response) => response.resume().on('end', resolve)).on('error', resolve).end())
    expect((await fetch(`${free}/api/health`)).status).toBe(200)
  })

  it('ignores a spoofed X-Forwarded-For when rate limiting', async () => {
    const statuses = []
    for (let i = 0; i < 10; i++) statuses.push((await post(free, '/api/cards/plan', { facts: [] }, { 'x-forwarded-for': `10.0.0.${i}` })).status)
    expect(statuses.at(-1)).toBe(429)
  })

  it('stops AI planning at the daily ceiling', async () => {
    const statuses = []
    for (let i = 0; i < 3; i++) statuses.push((await post(capped, '/api/cards/plan', { facts: [] })).status)
    expect(statuses).toEqual([400, 400, 429])
  })

  it('restores only the product that was bought, a limited number of times', async () => {
    const init = await (await post(mock, '/api/payments/init', { product: 'theme', currency: 'NGN', email: 'a@b.co', sessionId: 's1' })).json()
    await post(mock, '/api/payments/mock-complete', { reference: init.reference })
    const first = await post(mock, '/api/payments/recover', { reference: init.reference, sessionId: 's2' })
    expect(await first.json()).toMatchObject({ product: 'theme' })
    expect((await post(mock, '/api/payments/recover', { reference: init.reference, sessionId: 's3' })).status).toBe(403)
    expect((await post(mock, '/api/payments/recover', { reference: 'nope', sessionId: 's2' })).status).toBe(404)
  })
})

describe('Bachs checkout', () => {
  const buy = async (product, sessionId) => {
    const response = await post(live, '/api/payments/init', { product, currency: 'NGN', email: 'a@b.co', sessionId })
    const result = await response.json()
    return { ...result, checkoutId: result.checkoutUrl?.split('/').at(-1) }
  }
  const recover = (reference, sessionId = 's1') => post(live, '/api/payments/recover', { reference, sessionId })

  it('sends the price in naira with our reference', async () => {
    const order = await buy('theme', 's1')
    expect(checkouts.get(order.checkoutId).request).toMatchObject({ pricing: { currency: 'NGN', amount: '800.00' }, reference: order.reference, metadata: { product: 'theme' }, customer: { email: 'a@b.co' } })
  })

  it('unlocks on return only once Bachs says the checkout is paid', async () => {
    const order = await buy('font', 's1')
    expect((await recover(order.checkoutId)).status).toBe(404)
    pay(order.checkoutId)
    expect(await (await recover(order.checkoutId)).json()).toMatchObject({ product: 'font', reference: order.reference })
    expect((await recover(order.reference)).status).toBe(200)
  })

  it('refuses a payment whose amount does not match', async () => {
    const order = await buy('everything', 's1')
    pay(order.checkoutId); checkouts.get(order.checkoutId).session.amount = '100.00'
    expect((await recover(order.checkoutId)).status).toBe(404)
  })

  it('accepts only correctly signed, recent webhooks', async () => {
    const order = await buy('savage', 's1')
    const event = { id: 'evt_1', type: 'checkout.completed', data: { checkout_id: order.checkoutId } }
    expect((await webhook(live, event, { secret: 'wrong' })).status).toBe(400)
    expect((await webhook(live, event, { timestamp: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(400)
    expect((await webhook(live, event)).status).toBe(503) // signed, but not paid yet: ask Bachs to retry
    pay(order.checkoutId)
    expect((await webhook(live, event)).status).toBe(200)
    expect((await webhook(live, event)).status).toBe(200)
  })

  it('has no mock completion and no story product', async () => {
    expect((await post(live, '/api/payments/mock-complete', { reference: 'x' })).status).toBe(404)
    expect((await buy('core', 's1')).error).toBe('unsupported price')
  })
})
