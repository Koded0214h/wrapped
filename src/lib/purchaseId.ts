const KEY = 'chat-wrapped-purchase-id'
let fallback = ''

/** Ties unlocks to this browser. It must survive reloads and the trip to the payment page. */
export function getPurchaseId() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return saved
    const created = crypto.randomUUID()
    localStorage.setItem(KEY, created)
    return created
  } catch { return fallback ||= crypto.randomUUID() }
}
