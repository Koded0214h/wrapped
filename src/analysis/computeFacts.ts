import type { AggregateChat, Fact, Member } from './types'

const metricSpecs: Array<{ kind: string; key: keyof Member; high: boolean; detail: string }> = [
  { kind: 'member_messages', key: 'messages', high: true, detail: 'messages sent' },
  { kind: 'message_share', key: 'sharePct', high: true, detail: 'percent of the chat' },
  { kind: 'fast_reply', key: 'avgReplyMins', high: false, detail: 'average reply minutes' },
  { kind: 'slow_reply', key: 'avgReplyMins', high: true, detail: 'average reply minutes' },
  { kind: 'longest_silence', key: 'longestSilenceHrs', high: true, detail: 'hours silent' },
  { kind: 'conversation_starts', key: 'starts', high: true, detail: 'conversations started' },
  { kind: 'laugh_count', key: 'laughs', high: true, detail: 'laugh reactions' },
  { kind: 'hard_to_impress', key: 'laughs', high: false, detail: 'laugh reactions' },
  { kind: 'sorry_count', key: 'sorrys', high: true, detail: 'apologies' },
  { kind: 'night_activity', key: 'nightMessages', high: true, detail: 'messages after midnight' },
  { kind: 'media_dropper', key: 'mediaCount', high: true, detail: 'links and media drops' },
  { kind: 'quiet_member', key: 'messages', high: false, detail: 'messages sent' },
  { kind: 'reply_gap', key: 'avgReplyMins', high: true, detail: 'minutes per reply' },
  { kind: 'daily_presence', key: 'messages', high: true, detail: 'activity score' },
  { kind: 'night_share', key: 'nightMessages', high: true, detail: 'night-shift score' },
  { kind: 'peace_maker', key: 'sorrys', high: true, detail: 'peace attempts' },
  { kind: 'link_energy', key: 'mediaCount', high: true, detail: 'receipts supplied' },
  { kind: 'starter_energy', key: 'starts', high: true, detail: 'chat rescues' }
]

function rankedScore(members: Member[], member: Member, key: keyof Member, high: boolean, offset: number) {
  const values = members.map((item) => Number(item[key])).sort((a, b) => high ? b - a : a - b)
  const rank = values.indexOf(Number(member[key]))
  return Math.max(35, Math.min(99, 96 - rank * 9 - offset))
}

export function computeFacts(chat: AggregateChat): Fact[] {
  const facts: Fact[] = [
    { id: 'chat_label', kind: 'chat_label', memberIds: [], value: chat.chatName, surpriseScore: 0 },
    { id: 'date_range', kind: 'date_range', memberIds: [], value: `${chat.range.start} — ${chat.range.end}`, surpriseScore: 0 },
    { id: 'total_messages', kind: 'total_messages', memberIds: [], value: chat.totals.messages, detail: 'messages', surpriseScore: 58 },
    { id: 'total_words', kind: 'total_words', memberIds: [], value: chat.totals.words, detail: 'words', surpriseScore: 45 },
    { id: 'active_days', kind: 'active_days', memberIds: [], value: chat.totals.activeDays, detail: 'active days', surpriseScore: 42 },
    { id: 'emoji_count', kind: 'emoji_count', memberIds: [], value: chat.totals.emojis, detail: 'emojis', surpriseScore: 48 },
    { id: 'busiest_day', kind: 'busiest_day', memberIds: [], value: chat.totals.busiestDay.count, detail: chat.totals.busiestDay.date, surpriseScore: 66 }
  ]
  if (chat.thinStats) facts.push({ id: 'thin_stats', kind: 'thin_stats', memberIds: [], value: chat.totals.messages, detail: 'short export', surpriseScore: 0 })

  chat.members.forEach((member, memberIndex) => metricSpecs.forEach((spec, specIndex) => {
    const raw = Number(member[spec.key])
    const derived = spec.kind === 'daily_presence' ? Math.round(raw / Math.max(1, chat.totals.activeDays)) : raw
    facts.push({
      id: `${spec.kind}_${member.id}`,
      kind: spec.kind,
      memberIds: [member.id],
      value: derived,
      detail: spec.detail,
      surpriseScore: rankedScore(chat.members, member, spec.key, spec.high, (memberIndex + specIndex) % 4)
    })
  }))

  ;(chat.topWords ?? []).filter((word) => word.count > 1).slice(0, 6).forEach((word, index) => facts.push({ id: `word_${index}`, kind: 'repeated_phrase', memberIds: [], value: word.count, detail: word.word, surpriseScore: (chat.thinStats ? 94 : 82) - index * 5 }))
  const verdictIsPlaceholder = chat.verdict && (/^the final verdict is in/i.test(chat.verdict.title) || /smaller, honest deck/i.test(chat.verdict.blurb))
  if (chat.verdict && !verdictIsPlaceholder) facts.push({ id: 'verdict', kind: 'verdict', memberIds: [], value: chat.verdict.title, detail: chat.verdict.blurb, surpriseScore: 54 })
  const boosts: Record<string, string[]> = {
    friends: ['night_activity', 'laugh_count', 'media_dropper', 'quiet_member'],
    study: ['conversation_starts', 'repeated_phrase', 'busiest_day', 'sorry_count'],
    couple: ['fast_reply', 'slow_reply', 'longest_silence', 'verdict'],
    upload: ['message_share', 'night_activity', 'conversation_starts', 'longest_silence', 'repeated_phrase']
  }
  const boosted = facts.map((fact) => ({ ...fact, surpriseScore: Math.min(99, fact.surpriseScore + ((boosts[chat.sourceKind ?? 'upload'] ?? []).includes(fact.kind) ? 12 : 0)) }))
  const required = new Set(['chat_label', 'date_range', 'total_messages', 'total_words', 'active_days', 'emoji_count', 'busiest_day', 'verdict'])
  const base = boosted.filter((fact) => required.has(fact.kind))
  const candidates = boosted.filter((fact) => !required.has(fact.kind)).sort((a, b) => b.surpriseScore - a.surpriseScore)
  return [...base, ...candidates.slice(0, 54 - base.length)]
}
