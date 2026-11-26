import type { CallStats, Rhythm } from './types'

const DAY = 86400000
const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`)

// Only the exact lines WhatsApp writes for calls, so a typed "voice call" stays a message.
const callLine = /^(?:missed (voice|video) call(?:\.\s*tap to call back)?|(voice|video) call, (\d+) (hr|min|sec)s?(?: (\d+) (min|sec)s?)?(?:\s*[•·.].*)?)$/i
const seconds: Record<string, number> = { hr: 3600, min: 60, sec: 1 }

export function readCall(text: string) {
  const match = text.trim().match(callLine)
  if (!match) return undefined
  if (match[1]) return { kind: match[1].toLowerCase() as 'voice' | 'video', missed: true, seconds: 0 }
  return { kind: match[2].toLowerCase() as 'voice' | 'video', missed: false, seconds: Number(match[3]) * seconds[match[4].toLowerCase()] + (match[5] ? Number(match[5]) * seconds[match[6].toLowerCase()] : 0) }
}

export function totalCalls(calls: NonNullable<ReturnType<typeof readCall>>[]): CallStats | undefined {
  if (!calls.length) return undefined
  const answered = calls.filter((call) => !call.missed)
  return {
    voice: answered.filter((call) => call.kind === 'voice').length,
    video: answered.filter((call) => call.kind === 'video').length,
    missed: calls.length - answered.length,
    minutes: Math.round(answered.reduce((sum, call) => sum + call.seconds, 0) / 60)
  }
}

/** Calendar patterns, from message counts per local day (YYYY-MM-DD) and per hour. */
export function buildRhythm(days: Map<string, number>, hours: number[], calls?: CallStats): Rhythm {
  const ordered = [...days.keys()].sort()
  let streak = 0, run = 0, quiet: Rhythm['quietGap']
  ordered.forEach((day, index) => {
    const step = index ? Math.round((toUtc(day) - toUtc(ordered[index - 1])) / DAY) : 0
    run = step === 1 ? run + 1 : 1
    streak = Math.max(streak, run)
    // Days with no message at all, between two days that had one.
    if (step - 1 > (quiet?.days ?? 0)) quiet = { days: step - 1, from: ordered[index - 1], to: day }
  })
  const monthTotals = new Map<string, number>()
  const weekdays = Array.from({ length: 7 }, () => 0)
  for (const [day, count] of days) {
    monthTotals.set(day.slice(0, 7), (monthTotals.get(day.slice(0, 7)) ?? 0) + count)
    weekdays[new Date(toUtc(day)).getUTCDay()] += count
  }
  const months: Rhythm['months'] = []
  if (ordered.length) {
    const cursor = new Date(toUtc(`${ordered[0].slice(0, 7)}-01`))
    const end = ordered.at(-1)!.slice(0, 7)
    // Silent months stay on the chart as zeros.
    while (cursor.toISOString().slice(0, 7) <= end) {
      const month = cursor.toISOString().slice(0, 7)
      months.push({ month, count: monthTotals.get(month) ?? 0 })
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }
  return { months: months.slice(-12), hours, weekdays, longestStreak: streak, quietGap: quiet, calls }
}
