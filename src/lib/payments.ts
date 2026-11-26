import type { Purchase } from '../store/useApp'
import { getPurchaseId } from './purchaseId'

const PENDING = 'chat-wrapped-pending-payment'
const PENDING_DAYS = 3

export async function postJson(path: string, payload: object) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json()
  if (!response.ok) throw new Error(String(result.error || 'C-301: Checkout failed.'))
  return result
}

export const recoverPurchase = (reference: string) =>
  postJson('/api/payments/recover', { reference, sessionId: getPurchaseId() }) as Promise<{ reference: string; product: Purchase }>

/** Bachs sends the buyer back with ?checkout_id= on the success URL. */
export const returnedCheckout = (search: string) => new URLSearchParams(search).get('checkout_id') ?? undefined

// The redirect can be lost (closed tab, bank app), so remember what was being paid for.
export function rememberPendingPayment(reference: string) {
  try { localStorage.setItem(PENDING, JSON.stringify({ reference, at: Date.now() })) } catch { /* private mode */ }
}
export function pendingPayment(): string | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING) ?? 'null') as { reference: string; at: number } | null
    return saved && Date.now() - saved.at < PENDING_DAYS * 86400000 ? saved.reference : undefined
  } catch { return undefined }
}
export function forgetPendingPayment() {
  try { localStorage.removeItem(PENDING) } catch { /* private mode */ }
}
