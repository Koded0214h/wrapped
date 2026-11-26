import { createHmac, timingSafeEqual } from 'node:crypto'

const LIVE = 'https://api.bachs.io'
const SANDBOX = 'https://sandbox-api.bachs.io'
const TOLERANCE_SECONDS = 300

/** Bachs hosted checkout. https://docs.bachs.io */
export function createBachsService(options = {}) {
  const apiKey = options.apiKey ?? process.env.BACHS_SECRET_KEY ?? ''
  const webhookSecret = options.webhookSecret ?? process.env.BACHS_WEBHOOK_SECRET ?? ''
  const baseUrl = options.apiUrl || process.env.BACHS_API_URL || (apiKey.startsWith('sk_sandbox_') ? SANDBOX : LIVE)
  const fetchImpl = options.fetchImpl ?? fetch

  async function call(path, init = {}) {
    // Webhooks must be answered within ten seconds, so never wait longer than this.
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(8000), headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...init.headers } })
    const data = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, data }
  }

  return {
    configured: Boolean(apiKey),
    webhookConfigured: Boolean(webhookSecret),

    async createCheckout({ reference, product, amountSubunits, currency, email, successUrl, cancelUrl }) {
      const result = await call('/v1/checkout-sessions', {
        method: 'POST',
        headers: { 'idempotency-key': reference },
        body: JSON.stringify({
          // Bachs takes decimal major units ("800.00"), never kobo.
          pricing: { currency, amount: (amountSubunits / 100).toFixed(2), price_type: 'fixed' },
          billing_currency: currency,
          customer: { email },
          success_url: successUrl,
          cancel_url: cancelUrl,
          reference,
          metadata: { product }
        })
      })
      if (!result.ok || !result.data.checkout_url || !result.data.checkout_id) throw new Error(String(result.data.detail || result.data.error_code || `HTTP ${result.status}`))
      return { checkoutId: result.data.checkout_id, checkoutUrl: result.data.checkout_url }
    },

    async getCheckout(checkoutId) {
      const result = await call(`/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`)
      if (result.status === 404) return null
      if (!result.ok) throw new Error(`Bachs lookup failed: HTTP ${result.status}`)
      return result.data
    },

    verifyWebhook(rawBody, headers, now = Date.now()) {
      if (!webhookSecret) return false
      const v2 = String(headers['x-bachs-signature-v2'] || '').split(',').map((part) => part.trim().split('='))
      const timestamp = v2.find(([key]) => key === 't')?.[1] ?? String(headers['x-bachs-timestamp'] || '')
      // During secret rotation there is one v1 per valid secret.
      const signatures = v2.filter(([key]) => key === 'v1').map(([, value]) => value)
      if (!signatures.length && headers['x-bachs-signature']) signatures.push(String(headers['x-bachs-signature']))
      if (!timestamp || Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_SECONDS || !Number.isFinite(Number(timestamp))) return false
      const expected = Buffer.from(createHmac('sha256', webhookSecret).update(`${timestamp}.`).update(rawBody).digest('hex'))
      return signatures.some((signature) => { const given = Buffer.from(String(signature)); return given.length === expected.length && timingSafeEqual(given, expected) })
    }
  }
}

export const isPaid = (session) => session?.status === 'completed' && ['succeeded', 'paid'].includes(session.payment_status)
