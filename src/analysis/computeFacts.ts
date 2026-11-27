import type { AggregateChat, Fact, FactContext, Member } from './types'
import { qualifiesForReplyRank } from './fairness'
import { rhythmFacts, rhythmKinds } from './rhythmFacts'

type MetricSpec = {
  kind: string
  high: boolean
  detail: string
  humourScore: number
  visualScore: number
  value: (member: Member, chat: AggregateChat) => number
}

const round = (value: number, places = 0) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// Parsed exports carry YYYY-MM-DD; people should read "5 Mar 2025".
export const readableDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day)
  ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
  : day

const percent = (part: number, whole: number) => round(part / Math.max(1, whole) * 100, 1)

const metricSpecs: MetricSpec[] = [
  { kind: 'member_messages', high: true, detail: 'messages sent', humourScore: 84, visualScore: 96, value: (member) => member.messages },
  { kind: 'message_share', high: true, detail: 'percent of all messages', humourScore: 88, visualScore: 92, value: (member) => member.sharePct },
  { kind: 'fast_reply', high: false, detail: 'average minutes before reply', humourScore: 91, visualScore: 88, value: (member) => member.avgReplyMins },
  { kind: 'slow_reply', high: true, detail: 'average minutes before reply', humourScore: 88, visualScore: 84, value: (member) => member.avgReplyMins },
  { kind: 'longest_silence', high: true, detail: 'hours of silence', humourScore: 85, visualScore: 90, value: (member) => member.longestSilenceHrs },
  { kind: 'conversation_starts', high: true, detail: 'fresh gists started', humourScore: 86, visualScore: 82, value: (member) => member.starts },
  { kind: 'laugh_count', high: true, detail: 'laughs sent', humourScore: 90, visualScore: 89, value: (member) => member.laughs },
  { kind: 'hard_to_impress', high: false, detail: 'laughs sent', humourScore: 72, visualScore: 68, value: (member) => member.laughs },
  { kind: 'sorry_count', high: true, detail: 'sorrys typed', humourScore: 78, visualScore: 76, value: (member) => member.sorrys },
  { kind: 'night_activity', high: true, detail: 'messages after midnight', humourScore: 94, visualScore: 96, value: (member) => member.nightMessages },
  { kind: 'night_share', high: true, detail: 'percent after midnight', humourScore: 92, visualScore: 94, value: (member) => percent(member.nightMessages, member.messages) },
  { kind: 'media_dropper', high: true, detail: 'media messages marked omitted in the export', humourScore: 82, visualScore: 84, value: (member) => member.mediaCount },
  { kind: 'daily_presence', high: true, detail: 'messages for each active day', humourScore: 81, visualScore: 80, value: (member, chat) => round(member.messages / Math.max(1, chat.totals.activeDays), 1) },
  { kind: 'starter_share', high: true, detail: 'percent of fresh gists started', humourScore: 87, visualScore: 86, value: (member, chat) => percent(member.starts, chat.members.reduce((sum, item) => sum + item.starts, 0)) },
  { kind: 'laugh_rate', high: true, detail: 'laughs for every hundred messages', humourScore: 89, visualScore: 86, value: (member) => round(member.laughs / Math.max(1, member.messages) * 100, 1) },
  { kind: 'media_rate', high: true, detail: 'media for every hundred messages', humourScore: 80, visualScore: 83, value: (member) => round(member.mediaCount / Math.max(1, member.messages) * 100, 1) }
  ,{ kind: 'member_words', high: true, detail: 'actual words typed', humourScore: 90, visualScore: 97, value: (member) => member.words ?? 0 }
  ,{ kind: 'avg_message_words', high: true, detail: 'words per message', humourScore: 88, visualScore: 92, value: (member) => member.avgMessageWords ?? round((member.words ?? 0) / Math.max(1, member.messages), 1) }
  ,{ kind: 'replies_received', high: true, detail: 'replies pulled from the group', humourScore: 82, visualScore: 96, value: (member) => member.repliesReceived ?? 0 }
  ,{ kind: 'conversation_continuations', high: true, detail: 'follow-up messages that kept the chat moving', humourScore: 78, visualScore: 90, value: (member) => member.continuations ?? 0 }
  ,{ kind: 'link_count', high: true, detail: 'links shared', humourScore: 84, visualScore: 86, value: (member) => member.linkCount ?? 0 }
  ,{ kind: 'voice_notes', high: true, detail: 'voice notes sent', humourScore: 92, visualScore: 90, value: (member) => member.voiceNotes ?? 0 }
  ,{ kind: 'money_mentions', high: true, detail: 'money mentions', humourScore: 87, visualScore: 82, value: (member) => member.moneyMentions ?? 0 }
  ,{ kind: 'location_questions', high: true, detail: 'location checks', humourScore: 88, visualScore: 84, value: (member) => member.locationQuestions ?? 0 }
  ,{ kind: 'long_explanations', high: true, detail: 'messages longer than thirty-five words', humourScore: 91, visualScore: 88, value: (member) => member.explanationCount ?? 0 }
]

function contextFor(values: number[], memberIndex: number, spec: MetricSpec, confidence: number): FactContext {
  const value = values[memberIndex]
  const ordered = values.map((item, index) => ({ item, index })).sort((a, b) => spec.high ? b.item - a.item : a.item - b.item)
  const rank = ordered.findIndex((item) => item.index === memberIndex) + 1
  const average = values.reduce((sum, item) => sum + item, 0) / Math.max(1, values.length)
  const neighbour = ordered[rank === 1 ? 1 : Math.max(0, rank - 2)]?.item ?? value
  const gap = Math.abs(value - neighbour)
  const relativeGap = gap / Math.max(1, Math.abs(average))
  return {
    rank,
    outOf: values.length,
    gap: round(gap, 1),
    average: round(average, 1),
    ratioToAverage: round(value / Math.max(.1, average), 2),
    confidence,
    humourScore: spec.humourScore,
    visualScore: spec.visualScore,
    magnitude: relativeGap > .75 ? 'wild' : relativeGap > .3 ? 'clear' : 'close'
  }
}

function surpriseFor(context: FactContext, value: number) {
  const rankWeight = 78 - ((context.rank ?? 1) - 1) * 8
  const deviation = Math.min(18, Math.abs(Math.log2(Math.max(.1, context.ratioToAverage ?? 1))) * 10)
  const zeroPenalty = value === 0 ? 12 : 0
  return Math.max(30, Math.min(99, Math.round(rankWeight + deviation - zeroPenalty)))
}

export function computeFacts(chat: AggregateChat): Fact[] {
  const facts: Fact[] = [
    { id: 'chat_label', kind: 'chat_label', memberIds: [], value: chat.chatName, surpriseScore: 0 },
    { id: 'date_range', kind: 'date_range', memberIds: [], value: `${chat.range.start} — ${chat.range.end}`, surpriseScore: 0 },
    { id: 'total_messages', kind: 'total_messages', memberIds: [], value: chat.totals.messages, detail: 'messages', surpriseScore: 58, context: { confidence: 100, humourScore: 58, visualScore: 88 } },
    { id: 'total_words', kind: 'total_words', memberIds: [], value: chat.totals.words, detail: 'words typed', surpriseScore: 45, context: { confidence: 100, humourScore: 52, visualScore: 76 } },
    { id: 'total_members', kind: 'total_members', memberIds: [], value: chat.members.length, detail: 'active members', surpriseScore: 50, context: { confidence: 100, humourScore: 64, visualScore: 82 } },
    { id: 'media_count', kind: 'media_count', memberIds: [], value: chat.members.reduce((sum, member) => sum + member.mediaCount, 0), detail: 'media messages marked omitted in the export', surpriseScore: 52, context: { confidence: 100, humourScore: 72, visualScore: 84 } },
    { id: 'avg_messages_day', kind: 'avg_messages_day', memberIds: [], value: round(chat.totals.messages / Math.max(1, chat.totals.activeDays), 1), detail: 'messages per active day', surpriseScore: 56, context: { confidence: 100, humourScore: 76, visualScore: 88 } },
    { id: 'active_days', kind: 'active_days', memberIds: [], value: chat.totals.activeDays, detail: 'active days', surpriseScore: 42, context: { confidence: 100, humourScore: 50, visualScore: 70 } },
    { id: 'emoji_count', kind: 'emoji_count', memberIds: [], value: chat.totals.emojis, detail: 'emojis', surpriseScore: 48, context: { confidence: 100, humourScore: 70, visualScore: 76 } },
    { id: 'busiest_day', kind: 'busiest_day', memberIds: [], value: chat.totals.busiestDay.count, detail: readableDay(chat.totals.busiestDay.date), surpriseScore: 72, context: { confidence: 100, humourScore: 82, visualScore: 90 } }
  ]
  if (chat.thinStats) facts.push({ id: 'thin_stats', kind: 'thin_stats', memberIds: [], value: chat.totals.messages, detail: 'short export', surpriseScore: 0 })

  for (const spec of metricSpecs) {
    const pool = spec.kind === 'fast_reply' || spec.kind === 'slow_reply'
      ? chat.members.filter((member) => qualifiesForReplyRank(member, chat.totals.messages))
      : chat.members
    const values = pool.map((member) => spec.value(member, chat))
    pool.forEach((member, memberIndex) => {
      const confidence = Math.min(100, Math.round(45 + Math.log10(member.messages + 1) * 17))
      const context = contextFor(values, memberIndex, spec, confidence)
      context.activitySharePct = member.sharePct
      if (spec.kind === 'night_activity') context.sharePct = percent(member.nightMessages, member.messages)
      facts.push({
        id: `${spec.kind}_${member.id}`,
        kind: spec.kind,
        memberIds: [member.id],
        value: values[memberIndex],
        detail: spec.detail,
        surpriseScore: surpriseFor(context, values[memberIndex]),
        context
      })
    })
  }

  const words = (chat.topWords ?? []).filter((word) => word.count > 1).slice(0, 6)
  const wordAverage = words.reduce((sum, word) => sum + word.count, 0) / Math.max(1, words.length)
  words.forEach((word, index) => {
    const next = words[index + 1]?.count ?? word.count
    facts.push({
      id: `word_${index}`,
      kind: 'repeated_phrase',
      memberIds: [],
      value: word.count,
      detail: word.word,
      surpriseScore: Math.max(48, (chat.thinStats ? 96 : 88) - index * 7),
      context: {
        rank: index + 1,
        outOf: words.length,
        gap: word.count - next,
        average: round(wordAverage, 1),
        ratioToAverage: round(word.count / Math.max(1, wordAverage), 2),
        confidence: Math.min(100, 55 + word.count),
        humourScore: 91,
        visualScore: 98,
        magnitude: word.count - next > wordAverage * .5 ? 'wild' : word.count - next > wordAverage * .2 ? 'clear' : 'close'
      }
    })
  })

  ;(chat.topEmojis ?? []).forEach((item, index) => facts.push({
    id: `emoji_${index}`, kind: 'top_emoji', memberIds: [], value: item.count, detail: item.emoji,
    surpriseScore: Math.max(45, 82 - index * 6),
    context: { rank: index + 1, outOf: chat.topEmojis?.length ?? 0, confidence: 100, humourScore: 84, visualScore: 94 }
  }))
  if (chat.longestConversation) facts.push({
    id: 'longest_conversation', kind: 'longest_conversation', memberIds: [], value: chat.longestConversation.count,
    detail: readableDay(chat.longestConversation.date), surpriseScore: 78,
    context: { confidence: 100, humourScore: 80, visualScore: 96 }
  })
  if (chat.mediaPeak) facts.push({
    id: 'media_peak', kind: 'media_peak', memberIds: [], value: chat.mediaPeak.count,
    detail: readableDay(chat.mediaPeak.date), surpriseScore: 68, context: { confidence: 100, humourScore: 76, visualScore: 90 }
  })
  const topicFor = (date?: string) => chat.topicMoments?.find((moment) => moment.date === date)
  const topicFacts = [
    ['busiest_day_topic', chat.totals.busiestDay.date, 'what the busiest day was about'],
    ['longest_conversation_topic', chat.longestConversation?.date, 'what the longest chat run was about'],
    ['media_peak_topic', chat.mediaPeak?.date, 'what the busiest media day was about'],
    ['month_peak_topic', chat.topicMoments?.find((moment) => moment.date.length === 7)?.date, 'what the busiest month was about']
  ] as const
  topicFacts.forEach(([id, date, detail]) => {
    const topic = topicFor(date)
    if (topic) facts.push({ id, kind: 'topic_context', memberIds: [], value: topic.summary, detail, sourceExcerpt: topic.excerpt, terms: topic.terms, surpriseScore: 70, context: { confidence: 72, humourScore: 65, visualScore: 88 } })
  })
  const namedTopicDates = new Set(topicFacts.map(([, date]) => date).filter(Boolean))
  ;(chat.topicMoments ?? []).filter((moment) => !namedTopicDates.has(moment.date)).slice(0, 11).forEach((moment, index) => {
    facts.push({
      id: `year_context_${index}`,
      kind: 'topic_context',
      memberIds: [],
      value: moment.summary,
      detail: `representative context from ${readableDay(moment.date)}`,
      sourceExcerpt: moment.excerpt,
      surpriseScore: Math.max(58, 68 - index),
      context: { confidence: 70, humourScore: 68, visualScore: 82 }
    })
  })
  if (chat.laughMoment) facts.push({
    id: 'laugh_moment', kind: 'laugh_moment', memberIds: chat.laughMoment.memberId ? [chat.laughMoment.memberId] : [],
    value: chat.laughMoment.responders, detail: chat.laughMoment.text, replies: chat.laughMoment.replies, surpriseScore: 88,
    context: { confidence: 76, humourScore: 96, visualScore: 94, gap: chat.laughMoment.responders }
  })

  if (chat.chatType === 'dm') facts.push(...rhythmFacts(chat))

  const verdictIsPlaceholder = chat.verdict && (/^the final verdict is in/i.test(chat.verdict.title) || /smaller, honest deck/i.test(chat.verdict.blurb))
  if (chat.verdict && !verdictIsPlaceholder) facts.push({ id: 'verdict', kind: 'verdict', memberIds: [], value: chat.verdict.title, detail: chat.verdict.blurb, surpriseScore: 54, context: { confidence: 90, humourScore: 86, visualScore: 92 } })

  const boosts: Record<string, string[]> = {
    friends: ['night_activity', 'laugh_count', 'media_dropper', 'repeated_phrase'],
    study: ['conversation_starts', 'starter_share', 'busiest_day', 'repeated_phrase'],
    couple: ['fast_reply', 'slow_reply', 'longest_silence', 'laugh_rate'],
    upload: ['message_share', 'night_share', 'conversation_starts', 'longest_silence', 'repeated_phrase']
  }
  const boosted = facts.map((fact) => ({ ...fact, surpriseScore: Math.min(99, fact.surpriseScore + ((boosts[chat.sourceKind ?? 'upload'] ?? []).includes(fact.kind) ? 8 : 0)) }))
  const required = new Set(['chat_label', 'date_range', 'total_messages', 'total_words', 'total_members', 'media_count', 'avg_messages_day', 'active_days', 'emoji_count', 'top_emoji', 'repeated_phrase', 'busiest_day', 'longest_conversation', 'media_peak', 'topic_context', 'laugh_moment', 'verdict', 'thin_stats', ...rhythmKinds])
  const base = boosted.filter((fact) => required.has(fact.kind))
  // Reserve evidence for layouts that need an actual ranking. A global top-60
  // sort can otherwise drop every fast-reply fact and leave an empty card.
  const reservationPlan: [string, number][] = [
    ['member_messages', 5],
    ['fast_reply', 5],
    ['night_activity', 4],
    ['media_dropper', 4],
    ['conversation_starts', 4],
    ['laugh_count', 4]
  ]
  const reserved: Fact[] = []
  const reservedIds = new Set(base.map((fact) => fact.id))
  // Group layouts each cite their own leader, so those go in before the deeper rankings.
  const groupLeaders: [string, number][] = chat.chatType === 'group'
    ? ['member_messages', 'fast_reply', 'night_activity', 'media_dropper', 'conversation_starts', 'laugh_count', 'longest_silence', 'slow_reply', 'replies_received', 'voice_notes', 'link_count', 'conversation_continuations', 'avg_message_words', 'member_words', 'long_explanations', 'sorry_count', 'money_mentions', 'location_questions'].map((kind) => [kind, 1])
    : []
  for (const [kind, limit] of [...groupLeaders, ...reservationPlan]) {
    boosted
      .filter((fact) => fact.kind === kind && fact.value !== 0 && !reservedIds.has(fact.id))
      .sort((a, b) => (a.context?.rank ?? 999) - (b.context?.rank ?? 999) || b.surpriseScore - a.surpriseScore)
      .slice(0, limit)
      .forEach((fact) => { reserved.push(fact); reservedIds.add(fact.id) })
  }
  const capacity = Math.max(0, 60 - base.length)
  const keptReserved = reserved.slice(0, capacity)
  const keptIds = new Set([...base, ...keptReserved].map((fact) => fact.id))
  const candidates = boosted.filter((fact) => !keptIds.has(fact.id)).sort((a, b) => b.surpriseScore - a.surpriseScore)
  return [...base, ...keptReserved, ...candidates.slice(0, Math.max(0, capacity - keptReserved.length))]
}
