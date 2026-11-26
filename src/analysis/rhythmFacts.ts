import type { AggregateChat, Card, Fact, LayoutType } from './types'

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const monthName = (month: string) => new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
const dayName = (day: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
const hourName = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`
const peak = (values: number[]) => values.indexOf(Math.max(...values))

/** Facts behind the calendar cards of a direct chat. */
export function rhythmFacts(chat: AggregateChat): Fact[] {
  const rhythm = chat.rhythm
  if (!rhythm) return []
  const fact = (id: string, value: number, detail: string, series?: Fact['series']): Fact => ({ id, kind: id, memberIds: [], value, detail, series, surpriseScore: 60, context: { confidence: 100, humourScore: 70, visualScore: 90 } })
  const facts: Fact[] = []
  if (rhythm.months.length >= 2) {
    const counts = rhythm.months.map((item) => item.count)
    facts.push(fact('month_series', Math.max(...counts), monthName(rhythm.months[peak(counts)].month), rhythm.months.map((item) => ({ label: monthName(item.month).slice(0, 3), value: item.count }))))
  }
  if (chat.totals.messages >= 50) facts.push(fact('hour_series', Math.max(...rhythm.hours), hourName(peak(rhythm.hours)), rhythm.hours.map((value, hour) => ({ label: hourName(hour), value }))))
  if (chat.totals.activeDays >= 7) facts.push(fact('weekday_peak', Math.max(...rhythm.weekdays), weekdayNames[peak(rhythm.weekdays)]))
  if (rhythm.longestStreak >= 2) facts.push(fact('longest_streak', rhythm.longestStreak, 'days in a row'))
  if (rhythm.quietGap && rhythm.quietGap.days >= 2) facts.push(fact('quiet_gap', rhythm.quietGap.days, `${dayName(rhythm.quietGap.from)} and ${dayName(rhythm.quietGap.to)}`))
  const calls = rhythm.calls
  if (calls) facts.push(fact('call_total', calls.voice + calls.video + calls.missed, 'calls', [{ label: 'Voice', value: calls.voice }, { label: 'Video', value: calls.video }, { label: 'Missed', value: calls.missed }]), fact('call_minutes', calls.minutes, 'minutes on call'))
  return facts
}

export const rhythmKinds = ['month_series', 'hour_series', 'weekday_peak', 'longest_streak', 'quiet_gap', 'call_total', 'call_minutes']

/** Calendar cards for a direct chat. Each appears only when the export has the evidence. */
export function rhythmCards(facts: Fact[]): Card[] {
  const has = (id: string) => facts.some((fact) => fact.id === id)
  const emojis = facts.filter((fact) => fact.kind === 'top_emoji').map((fact) => fact.id).slice(0, 5)
  const members = facts.filter((fact) => fact.kind === 'member_messages').map((fact) => fact.id).slice(0, 2)
  const card = (layout: LayoutType, factIds: string[], headline: string, roast: string): Card => ({ id: `rhythm_${layout}`, layout, factIds, headline, roast, locked: true })
  return [
    ...(has('longest_streak') ? [card('highlights', ['active_days', 'longest_streak', 'longest_conversation', 'weekday_peak'].filter(has), 'Your chat in numbers.', 'This is how you showed up.')] : []),
    ...(members.length === 2 ? [card('split', members, 'Who types more?', 'Every message in the export counted.')] : []),
    ...(has('month_series') ? [card('monthly', ['month_series'], '{{detail:month_series}} was peak gist.', '{{value:month_series}} messages that month.')] : []),
    ...(has('hour_series') ? [card('hourly', ['hour_series'], '{{detail:hour_series}} is your gist hour.', 'Messages no dey rest at that time.')] : []),
    ...(has('quiet_gap') ? [card('quietGap', ['quiet_gap'], 'The chat went quiet small.', 'Nobody typed between {{detail:quiet_gap}}.')] : []),
    ...(emojis.length >= 3 ? [card('emojiBoard', emojis, 'Emojis you can’t do without.', '{{detail:emoji_0}} dey lead.')] : []),
    ...(has('call_total') ? [card('calls', ['call_total', 'call_minutes'].filter(has), 'You don’t only type, you call too.', 'Straight from the export.')] : [])
  ]
}
