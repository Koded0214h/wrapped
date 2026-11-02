import { appConfig } from '../config/appConfig'
import { idbGet, idbSet } from './idb'

export type EventName = 'landing_view' | 'chat_type_selected' | 'export_guide_viewed' | 'export_tab_switched' | 'upload_started' | 'upload_failed' | 'parse_completed' | 'parse_failed' | 'story_viewed' | 'card_viewed' | 'paywall_viewed' | 'checkout_opened' | 'checkout_abandoned' | 'payment_succeeded' | 'payment_failed' | 'unlock_confirmed' | 'unlock_failed' | 'recovery_started' | 'recovery_succeeded' | 'theme_changed' | 'upgrade_clicked' | 'card_shared' | 'card_downloaded' | 'hide_names_toggled' | 'savage_toggled' | 'referral_landing' | 'support_clicked'
type Prop = string | number | boolean | null
type Props = Record<string, Prop>
type Event = { ts: string; sessionId: string; name: EventName | 'error' | 'timing'; props: Props; context: Props }

const sessionId = crypto.randomUUID()
let batch: Event[] = []
let flushTimer: number | undefined
let currentStep = 'landing'
const forbidden = /(?:\+?\d[\d\s().-]{7,}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/

function safeProps(props: Props = {}) {
  const safe: Props = {}
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && (value.length > 40 || forbidden.test(value))) continue
    safe[key] = value
  }
  return safe
}

function context(): Props {
  const ua = navigator.userAgent
  const query = new URLSearchParams(location.search)
  return safeProps({
    appVersion: __APP_VERSION__, device: innerWidth < 600 ? 'phone' : innerWidth < 1000 ? 'tablet' : 'desktop',
    os: /Android/i.test(ua) ? 'android' : /iPhone|iPad/i.test(ua) ? 'ios' : /Win/i.test(ua) ? 'windows' : /Mac/i.test(ua) ? 'macos' : 'other',
    browser: /Edg/i.test(ua) ? 'edge' : /Firefox/i.test(ua) ? 'firefox' : /Chrome/i.test(ua) ? 'chrome' : /Safari/i.test(ua) ? 'safari' : 'other',
    locale: navigator.language.slice(0, 10), memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0, cores: navigator.hardwareConcurrency ?? 0,
    utm: query.get('utm_source')?.slice(0, 40) ?? '', ref: query.get('ref')?.slice(0, 40) ?? '', step: currentStep
  })
}

async function queueOffline(events: Event[]) {
  const queued = await idbGet<Event[]>('telemetry', 'queue') ?? []
  await idbSet('telemetry', 'queue', [...queued, ...events].slice(-500))
}

export async function flush(useBeacon = false) {
  if (!appConfig.telemetry || !batch.length) return
  const queued = await idbGet<Event[]>('telemetry', 'queue') ?? []
  const events = [...queued, ...batch].slice(-500); batch = []
  const body = JSON.stringify({ events })
  try {
    if (useBeacon && navigator.sendBeacon?.('/api/collect', new Blob([body], { type: 'application/json' }))) return
    const response = await fetch('/api/collect', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
    if (!response.ok) throw new Error('collector unavailable')
    await idbSet('telemetry', 'queue', [])
  } catch { await queueOffline(events) }
}

function enqueue(name: Event['name'], props: Props) {
  if (!appConfig.telemetry) return
  batch.push({ ts: new Date().toISOString(), sessionId, name, props: safeProps(props), context: context() })
  if (batch.length >= 10) void flush()
  else if (!flushTimer) flushTimer = window.setTimeout(() => { flushTimer = undefined; void flush() }, 5000)
}

export const track = (name: EventName, props: Props = {}) => enqueue(name, props)
export const getSessionId = () => sessionId
export const setTelemetryStep = (step: string) => { currentStep = step.slice(0, 40) }
export const timing = (name: string, ms: number) => enqueue('timing', { metric: name.slice(0, 40), ms: Math.round(ms) })
export function trackError(error: unknown, ctx: Props = {}) {
  const raw = error instanceof Error ? error.message : String(error)
  const code = raw.match(/[A-Z]-\d{3}/)?.[0] ?? 'U-500'
  enqueue('error', { ...ctx, code, message: raw.replace(forbidden, '[redacted]').slice(0, 40) })
}

window.addEventListener('online', () => void flush())
window.addEventListener('pagehide', () => void flush(true))
