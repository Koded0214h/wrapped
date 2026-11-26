// The public usage counter behind the Stats panel. It sends one word, such as "wrap", and nothing
// about the person or their chat.
export type Counted = 'visitor' | 'wrap' | 'share'

export type Stats = { updatedAt: string; days: string[]; totals: Record<Counted, number>; daily: Record<Counted, number[]> }

export function countUsage(event: Counted) {
  const body = JSON.stringify({ event })
  try {
    if (navigator.sendBeacon?.('/api/stats', new Blob([body], { type: 'application/json' }))) return
  } catch { /* falls through to fetch */ }
  void fetch('/api/stats', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

/** Counts a visitor once per browser, however often they come back. */
export function countVisitorOnce() {
  const key = 'chat-wrapped:counted-visitor'
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  } catch { return }
  countUsage('visitor')
}

export async function fetchStats(): Promise<Stats> {
  const response = await fetch('/api/stats')
  if (!response.ok) throw new Error(`S-${response.status}: The numbers are not available right now.`)
  return response.json()
}
