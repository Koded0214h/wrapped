import type { Card, Fact, LayoutType, Member } from './types'
import { isPendingContext, isTiedForFirst } from './fairness'

const blockedKinds = new Set(['health', 'religion', 'sexuality', 'ethnicity', 'finances', 'romance_group', 'explicit', 'harassment', 'quiet_member'])
const vagueCardCopy = /the final verdict is in|main character|\benergy\b|\bvibes?\b|\bchaos\b|\biconic\b|\bloud\b|understood the assignment|\beconomy\b|\bdepartment\b|\bmovement\b|\breceipts\b|\bevidence\b|\bcertified\b|\bplot twist\b|admin powers|carried the group/i

type Category = 'people' | 'rhythm' | 'chaos' | 'language' | 'totals'
type Presentation = { category: Category; headline: string; roast: string; savage: string }

const presentation: Record<string, Presentation> = {
  member_messages: { category: 'people', headline: '{{member:self}} type like say deadline dey.', roast: '{{value:self}} messages. This thumb no collect break.', savage: 'Even if chat close, {{member:self}} go still dey type.' },
  message_share: { category: 'people', headline: '{{member:self}} send pass everybody.', roast: 'For all the messages, na {{value:self}}% come from this phone.', savage: 'Others type too, but na {{member:self}} do the main work.' },
  fast_reply: { category: 'rhythm', headline: 'Before notification settle, {{member:self}} don reply.', roast: '{{value:self}} minutes na the average. This person no dey keep gist waiting.', savage: '{{member:self}} dey answer notification like attendance.' },
  slow_reply: { category: 'rhythm', headline: '{{member:self}} reply use long road.', roast: '{{value:self}} minutes na the average. If gist hot, e don cool small.', savage: 'Before {{member:self}} reply, everybody don change topic.' },
  longest_silence: { category: 'chaos', headline: '{{member:self}} comot for chat without notice.', roast: '{{value:self}} hours without message. Later, dem return like nothing happen.', savage: 'This one no be break. Na disappearance.' },
  conversation_starts: { category: 'people', headline: 'Na {{member:self}} dey wake this chat.', roast: '{{value:self}} times, na this person start fresh gist.', savage: 'Without {{member:self}}, plenty gist for die before e start.' },
  laugh_count: { category: 'people', headline: '{{member:self}} laugh give everybody morale.', roast: '{{value:self}} laughs. Even weak joke collect support.', savage: 'Any joke enter, {{member:self}} don ready to laugh.' },
  hard_to_impress: { category: 'people', headline: 'To make {{member:self}} laugh no easy.', roast: 'Na {{value:self}} laughs pass the test.', savage: '{{member:self}} check every joke before laughter fit enter.' },
  sorry_count: { category: 'people', headline: '{{member:self}} type “sorry” well well.', roast: 'Na {{value:self}} times. Apology plenty for here.', savage: 'Sorry finish, but another one still dey come.' },
  night_activity: { category: 'chaos', headline: 'When people dey sleep, {{member:self}} still dey type.', roast: '{{value:self}} messages after midnight. Sleep no win this battle.', savage: 'Bedtime no get authority over {{member:self}}.' },
  night_share: { category: 'chaos', headline: '{{member:self}} keep plenty message for midnight.', roast: '{{value:self}}% of the messages wey dem send enter after midnight.', savage: 'Daytime get small. Midnight collect the main typing.' },
  media_dropper: { category: 'people', headline: '{{member:self}} drop media tire.', roast: 'WhatsApp mark {{value:self}} media messages as omitted for this export.', savage: 'The files no follow export, but the media placeholders expose {{member:self}}.' },
  daily_presence: { category: 'rhythm', headline: '{{member:self}} no miss roll call.', roast: '{{value:self}} messages for every active day.', savage: 'No leave. No quiet week. Just steady typing.' },
  starter_share: { category: 'people', headline: 'Na {{member:self}} dey restart dead chat.', roast: '{{value:self}}% of fresh gist start from this person.', savage: 'Everybody wait. {{member:self}} press start.' },
  laugh_rate: { category: 'people', headline: '{{member:self}} laugh for almost everything.', roast: '{{value:self}} laughs for every hundred messages.', savage: 'Even joke wey bend still collect laugh.' },
  media_rate: { category: 'people', headline: '{{member:self}} prefer send file than type.', roast: '{{value:self}} media drops for every hundred messages.', savage: 'Typing na backup plan for this phone.' },
  repeated_phrase: { category: 'language', headline: 'This chat no let “{{detail:self}}” rest.', roast: '{{value:self}} times. Una really like this word.', savage: 'One word enter chat and una refuse free am.' },
  busiest_day: { category: 'chaos', headline: '{{detail:self}} na serious typing day.', roast: '{{value:self}} messages land that day. Everybody suddenly get time.', savage: 'Any other plan for that day suffer.' },
  total_words: { category: 'totals', headline: '{{value:self}} words enter this chat.', roast: 'Una type full book, but nobody arrange chapter.', savage: 'All this typing, yet some plan still need reminder.' },
  emoji_count: { category: 'totals', headline: '{{value:self}} emojis help una talk.', roast: 'Sometimes face better pass long explanation.', savage: 'Keyboard get letters, but una choose face.' },
  verdict: { category: 'totals', headline: '{{value:self}}', roast: '{{detail:self}}', savage: '{{detail:self}}' }
}

const familyByKind: Record<string, string> = {
  member_messages: 'participation', message_share: 'participation', daily_presence: 'participation',
  fast_reply: 'reply_speed', slow_reply: 'reply_speed',
  night_activity: 'night', night_share: 'night',
  laugh_count: 'laughs', laugh_rate: 'laughs', hard_to_impress: 'laughs',
  media_dropper: 'media', media_rate: 'media',
  conversation_starts: 'starts', starter_share: 'starts'
}

const comparisonKinds = new Set(['member_messages', 'message_share', 'fast_reply', 'slow_reply', 'laugh_count', 'media_dropper', 'laugh_rate', 'media_rate'])

function layoutFor(fact: Fact, memberCount: number): LayoutType {
  if (fact.kind === 'repeated_phrase') return 'wordCloud'
  if (fact.kind === 'longest_silence' || fact.kind === 'slow_reply' || fact.kind === 'busiest_day') return 'timeline'
  if (fact.kind === 'night_activity' || fact.kind === 'night_share') return 'heatmap'
  if (['conversation_starts', 'hard_to_impress', 'sorry_count', 'starter_share'].includes(fact.kind)) return 'award'
  if (comparisonKinds.has(fact.kind)) return memberCount === 2 ? 'versus' : 'leaderboard'
  if (fact.kind === 'verdict') return 'verdict'
  return 'bigNumber'
}

function storyScore(fact: Fact) {
  const context = fact.context
  const genericPenalty = ['total_words', 'emoji_count'].includes(fact.kind) ? 18 : 0
  const lowEvidencePenalty = (context?.confidence ?? 100) < 65 ? 16 : 0
  const magnitudeBonus = context?.magnitude === 'wild' ? 12 : context?.magnitude === 'clear' ? 5 : 0
  return fact.surpriseScore * .42 + (context?.humourScore ?? 60) * .27 + (context?.visualScore ?? 60) * .21 + (context?.confidence ?? 80) * .1 + magnitudeBonus - genericPenalty - lowEvidencePenalty
}

type Candidate = { primary: Fact; facts: Fact[]; layout: LayoutType; category: Category; family: string; score: number }

function buildCandidates(facts: Fact[]): Candidate[] {
  const memberFacts = facts.filter((fact) => fact.memberIds.length > 0)
  const memberCount = Math.max(1, ...memberFacts.map((fact) => fact.context?.outOf ?? 0))
  const unkindForQuietMembers = new Set(['slow_reply', 'longest_silence', 'hard_to_impress'])
  const byKind = new Map<string, Fact[]>()
  // No card for a zero, a shared first place, or a "disappearance" shorter than a day.
  const tiedKinds = new Set(facts.filter((fact) => fact.memberIds.length > 0 && isTiedForFirst(fact)).map((fact) => fact.kind))
  facts.filter((fact) => presentation[fact.kind] && fact.value !== 0 && !tiedKinds.has(fact.kind) && !(fact.kind === 'longest_silence' && Number(fact.value) < 24) && fact.kind !== 'verdict' && !blockedKinds.has(fact.kind) && !(unkindForQuietMembers.has(fact.kind) && (fact.context?.activitySharePct ?? 100) < Math.max(3, 20 / memberCount))).forEach((fact) => byKind.set(fact.kind, [...(byKind.get(fact.kind) ?? []), fact]))
  return [...byKind.entries()].map(([kind, kindFacts]) => {
    const ordered = [...kindFacts].sort((a, b) => (a.context?.rank ?? 99) - (b.context?.rank ?? 99) || storyScore(b) - storyScore(a))
    const primary = ordered[0]
    const layout = layoutFor(primary, memberCount)
    const cardFacts = layout === 'wordCloud' ? ordered.slice(0, 6) : layout === 'leaderboard' ? ordered.slice(0, 5) : layout === 'versus' ? ordered.slice(0, 2) : [primary]
    return { primary, facts: cardFacts, layout, category: presentation[kind].category, family: familyByKind[kind] ?? kind, score: storyScore(primary) }
  }).sort((a, b) => b.score - a.score)
}

function chooseCandidates(candidates: Candidate[], target: number) {
  const shocker = [...candidates].sort((a, b) => b.primary.surpriseScore - a.primary.surpriseScore || b.score - a.score)[0]
  const opener = candidates.find((candidate) => candidate !== shocker && candidate.family !== shocker?.family && candidate.layout !== shocker?.layout && candidate.category !== 'totals') ?? candidates.find((candidate) => candidate !== shocker && candidate.family !== shocker?.family && candidate.category !== 'totals') ?? candidates.find((candidate) => candidate !== shocker) ?? shocker
  const selected: Candidate[] = opener ? [opener] : []
  if (shocker && shocker !== opener) selected.push(shocker)
  const usedFamilies = new Set(selected.map((candidate) => candidate.family))
  const layoutCounts = new Map<LayoutType, number>()
  const categoryCounts = new Map<Category, number>()
  selected.forEach((candidate) => {
    layoutCounts.set(candidate.layout, (layoutCounts.get(candidate.layout) ?? 0) + 1)
    categoryCounts.set(candidate.category, (categoryCounts.get(candidate.category) ?? 0) + 1)
  })

  while (selected.length < target) {
    const next = candidates
      .filter((candidate) => !selected.includes(candidate) && !usedFamilies.has(candidate.family) && (layoutCounts.get(candidate.layout) ?? 0) < 2)
      .sort((a, b) => {
        const aPenalty = (categoryCounts.get(a.category) ?? 0) * 9 + (layoutCounts.get(a.layout) ?? 0) * 7
        const bPenalty = (categoryCounts.get(b.category) ?? 0) * 9 + (layoutCounts.get(b.layout) ?? 0) * 7
        return (b.score - bPenalty) - (a.score - aPenalty)
      })[0]
    if (!next) break
    selected.push(next)
    usedFamilies.add(next.family)
    layoutCounts.set(next.layout, (layoutCounts.get(next.layout) ?? 0) + 1)
    categoryCounts.set(next.category, (categoryCounts.get(next.category) ?? 0) + 1)
  }

  for (const candidate of candidates) {
    if (selected.length >= target) break
    if (selected.includes(candidate) || (layoutCounts.get(candidate.layout) ?? 0) >= 2) continue
    selected.push(candidate)
    layoutCounts.set(candidate.layout, (layoutCounts.get(candidate.layout) ?? 0) + 1)
  }
  return { selected, shocker, opener }
}

function cardFromCandidate(candidate: Candidate): Card {
  const spec = presentation[candidate.primary.kind]
  return { id: `card_${candidate.primary.id}`, layout: candidate.layout, factIds: candidate.facts.map((fact) => fact.id), headline: spec.headline, roast: spec.roast, savageRoast: spec.savage, locked: true }
}

export function planCards(facts: Fact[], options: { maxCards?: number; chatType?: 'group' | 'dm' } = {}): Card[] {
  if (options.chatType === 'group') return planGroupCards(facts)
  const safe = facts.filter((fact) => !blockedKinds.has(fact.kind))
  const thin = facts.some((fact) => fact.kind === 'thin_stats')
  const verdict = safe.find((fact) => fact.kind === 'verdict')
  const maxCards = Math.max(4, options.maxCards ?? 9)
  const candidateTarget = Math.max(2, maxCards - 1 - (verdict ? 1 : 0))
  const { selected, shocker, opener } = chooseCandidates(buildCandidates(safe), candidateTarget)
  const rest = selected.filter((candidate) => candidate !== opener && candidate !== shocker)
  const categoryOrder: Category[] = ['people', 'rhythm', 'chaos', 'language', 'totals']
  rest.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || b.score - a.score)
  const sequence = [opener, ...(shocker && shocker !== opener ? [shocker] : []), ...rest].filter(Boolean) as Candidate[]

  const cover: Card = {
    id: 'cover',
    layout: 'cover',
    factIds: ['chat_label', 'date_range', 'total_messages', ...(thin ? ['thin_stats'] : [])],
    headline: '{{value:chat_label}}',
    roast: thin ? 'Export short, so na only clear pattern enter this deck.' : 'This chat get pattern. We count only wetin the export show.',
    locked: false
  }
  const storyCards = sequence.map((candidate, index) => ({ ...cardFromCandidate(candidate), locked: index > 1 }))
  const closing = verdict ? [{ ...cardFromCandidate({ primary: verdict, facts: [verdict], layout: 'verdict', category: 'totals', family: 'verdict', score: storyScore(verdict) }), locked: true }] : []
  return [cover, ...storyCards, ...closing].slice(0, maxCards)
}

const groupLayouts = new Set<LayoutType>(['groupNumbers', 'yapLeaderboard', 'characterCast', 'groupAwards', 'socialGraph', 'plotTwist', 'groupLanguage', 'timeCapsule', 'companyRoast', 'dynamicDuo', 'replyRace', 'nightShift', 'mediaDesk', 'ghostWatch', 'laughTrack', 'conversationSpark', 'groupPulse', 'memoryVault', 'movieFinale', 'finalVerdict'])

function factsOf(facts: Fact[], kinds: string[], limit = Infinity) {
  return facts.filter((fact) => kinds.includes(fact.kind)).sort((a, b) => (a.context?.rank ?? 99) - (b.context?.rank ?? 99) || b.surpriseScore - a.surpriseScore).slice(0, limit)
}

function plotTwistCopy(fact?: Fact) {
  if (!fact) return { headline: 'The group gets busiest when normal people are sleeping.', roast: 'The timestamps made the allegation. We only arranged the slide.' }
  const copy: Record<string, [string, string]> = {
    night_share: ['{{member:self}} saves {{value:self}}% of their messages for after midnight.', 'The group has a night shift. Nobody submitted an application.'],
    night_activity: ['{{member:self}} sent {{value:self}} messages after midnight.', 'Apparently sleep was only a suggestion.'],
    starter_share: ['{{member:self}} starts {{value:self}}% of the fresh conversations.', 'Take this person away and the chat may need jumper cables.'],
    media_rate: ['{{member:self}} sends {{value:self}} media drops per hundred messages.', 'Typing is clearly the backup plan.'],
    avg_message_words: ['{{member:self}} averages {{value:self}} words every time they press send.', 'Not a message. A keynote address.'],
    replies_received: ['{{member:self}} pulled {{value:self}} replies from everybody else.', 'Not the loudest person. Still somehow the gravitational centre.'],
    longest_silence: ['{{member:self}} vanished for {{value:self}} hours, then returned.', 'No statement. No press conference. Just another message.']
  }
  const selected = copy[fact.kind] ?? ['{{member:self}} broke the group average by a suspicious margin.', '{{value:self}} is the number. The rest of us are still processing it.']
  return { headline: selected[0], roast: selected[1] }
}

export function planGroupCards(facts: Fact[]): Card[] {
  const ids = (items: Fact[]) => items.map((fact) => fact.id)
  const top = (kind: string) => factsOf(facts, [kind], 1)[0]
  const memberEvidence = facts.filter((fact) => fact.memberIds.length > 0)
  const plot = [...memberEvidence]
    .filter((fact) => ['night_share', 'night_activity', 'starter_share', 'media_rate', 'avg_message_words', 'replies_received', 'longest_silence'].includes(fact.kind) && fact.value !== 0)
    .sort((a, b) => (b.context?.magnitude === 'wild' ? 18 : b.context?.magnitude === 'clear' ? 8 : 0) + b.surpriseScore - ((a.context?.magnitude === 'wild' ? 18 : a.context?.magnitude === 'clear' ? 8 : 0) + a.surpriseScore))[0]
  const plotCopy = plotTwistCopy(plot)
  const cards: Card[] = [
    { id: 'group_01_numbers', layout: 'groupNumbers', factIds: ['chat_label', 'date_range', 'total_messages', 'total_members', 'total_words', 'media_count', 'avg_messages_day'].filter((id) => facts.some((fact) => fact.id === id)), headline: 'You people sent {{value:total_messages}} messages. Please seek help.', roast: 'A completely normal amount of communication, if nobody asks questions.', locked: false },
    { id: 'group_02_yap', layout: 'yapLeaderboard', factIds: ids(factsOf(facts, ['member_messages', 'member_words', 'avg_message_words'])), headline: 'The Yap Leaderboard', roast: 'Message count is volume. Word count is commitment. We checked both.', locked: false },
    { id: 'group_03_characters', layout: 'characterCast', factIds: ids(memberEvidence.filter((fact) => ['member_messages', 'fast_reply', 'night_activity', 'media_dropper', 'conversation_starts', 'voice_notes', 'avg_message_words'].includes(fact.kind))), headline: 'Everyone has a character', roast: 'Behaviour became casting. Nobody auditioned.', locked: false },
    { id: 'group_04_awards', layout: 'groupAwards', factIds: ids([top('longest_silence'), top('slow_reply'), top('conversation_starts'), top('long_explanations'), top('avg_message_words')].filter(Boolean) as Fact[]), headline: 'The Group Chat Awards', roast: 'The nominations came from the data. The final mess belongs to the voters.', locked: true },
    { id: 'group_05_social', layout: 'socialGraph', factIds: ids([top('conversation_starts'), top('replies_received'), top('conversation_continuations'), top('member_messages')].filter(Boolean) as Fact[]), headline: 'Who runs this group?', roast: 'Sending the most is one thing. Keeping everybody connected is another.', locked: true },
    { id: 'group_06_twist', layout: 'plotTwist', factIds: plot ? [plot.id] : ['busiest_day'].filter((id) => facts.some((fact) => fact.id === id)), headline: plotCopy.headline, roast: plotCopy.roast, locked: true },
    { id: 'group_07_language', layout: 'groupLanguage', factIds: ids(factsOf(facts, ['top_emoji', 'repeated_phrase', 'emoji_count'], 12)), headline: "The group's language", roast: 'Raw usage only. Common filler words and names no enter this list.', locked: true },
    { id: 'group_08_time', layout: 'timeCapsule', factIds: ['busiest_day', 'longest_conversation', 'media_peak', 'busiest_day_topic', 'longest_conversation_topic', 'media_peak_topic', ...ids(factsOf(facts, ['repeated_phrase'], 3))].filter((id) => facts.some((fact) => fact.id === id)), headline: 'The moments that defined us', roast: 'Dates matter only when we remember wetin una dey discuss.', locked: true },
    { id: 'group_09_company', layout: 'companyRoast', factIds: ids([top('conversation_starts'), top('sorry_count'), top('money_mentions'), top('location_questions'), top('long_explanations')].filter(Boolean) as Fact[]), headline: 'If this group were a company…', roast: 'Zero salary. Unlimited meetings. Astonishing staff retention.', locked: true },
    { id: 'group_10_duo', layout: 'dynamicDuo', factIds: ids(factsOf(facts, ['replies_received', 'conversation_continuations', 'member_messages'], 12)), headline: 'The dynamic duo', roast: 'Two people, one conversational relay race, absolutely no off switch.', locked: true },
    { id: 'group_11_reply', layout: 'replyRace', factIds: ids(factsOf(facts, ['fast_reply'], 7)), headline: 'The reply race', roast: 'Average time before a different person answered. Only members with enough real replies qualify.', locked: true },
    { id: 'group_12_night', layout: 'nightShift', factIds: ids(factsOf(facts, ['night_activity', 'night_share'], 12)), headline: 'The night shift', roast: 'The sun went down. The typing somehow became more urgent.', locked: true },
    { id: 'group_13_media', layout: 'mediaDesk', factIds: ids(factsOf(facts, ['media_dropper', 'link_count', 'voice_notes'], 15)), headline: 'The media department', roast: 'Why explain it when a screenshot, link or voice note can create three new questions?', locked: true },
    { id: 'group_14_ghost', layout: 'ghostWatch', factIds: ids(factsOf(facts, ['longest_silence', 'slow_reply'], 10)), headline: 'The vanishing act', roast: 'Last seen typing. Expected back whenever the topic has completely changed.', locked: true },
    { id: 'group_15_laugh', layout: 'laughTrack', factIds: ['laugh_moment', ...ids(factsOf(facts, ['laugh_count', 'laugh_rate'], 12))].filter((id) => facts.some((fact) => fact.id === id)), headline: 'The biggest laugh response', roast: 'Exports no include reaction counts, so we measured the laugh replies that followed.', locked: true },
    { id: 'group_16_spark', layout: 'conversationSpark', factIds: ids(factsOf(facts, ['conversation_starts', 'starter_share'], 12)), headline: 'Who keeps pressing start?', roast: 'Silence enters the room. This person immediately opens a new topic.', locked: true },
    { id: 'group_17_pulse', layout: 'groupPulse', factIds: ['busiest_day', 'avg_messages_day', 'active_days', 'total_messages'].filter((id) => facts.some((fact) => fact.id === id)), headline: 'The group pulse', roast: 'Mostly alive. Occasionally operating at emergency-broadcast levels.', locked: true },
    { id: 'group_18_memory', layout: 'memoryVault', factIds: ['busiest_day', 'longest_conversation', 'media_peak', ...ids(factsOf(facts, ['repeated_phrase', 'top_emoji'], 10))].filter((id) => facts.some((fact) => fact.id === id)), headline: 'The memory vault', roast: 'The defining topics, recurring jokes, important milestones, longest conversations and moments worth remembering.', locked: true },
    { id: 'group_19_movie', layout: 'movieFinale', factIds: ['chat_label', 'total_messages', 'total_members', 'verdict', 'busiest_day_topic', 'longest_conversation_topic', top('member_messages')?.id, ...ids(factsOf(facts, ['repeated_phrase'], 3))].filter((id): id is string => Boolean(id) && facts.some((fact) => fact.id === id)), headline: 'Our group chat: the movie', roast: '{{value:total_members}} people and {{value:total_messages}} messages built this story.', locked: true },
    { id: 'group_20_verdict', layout: 'finalVerdict', factIds: ['chat_label', 'total_messages', 'total_members', 'avg_messages_day', 'verdict', ...ids(factsOf(facts, ['repeated_phrase'], 1))].filter((id) => facts.some((fact) => fact.id === id)), headline: 'The final verdict', roast: 'A collection of individuals who should probably not be left unsupervised, but somehow make life considerably more entertaining.', locked: true }
  ]
  return cards
}

export const redactTemplate = (template: string) => template.replace(/\{\{(?:value|detail|member):[^}]+\}\}/g, '▓▓▓▓▓')

export function validatePlannedCards(cards: Card[], facts: Fact[], _members: Member[]) {
  const factIds = new Set(facts.map((fact) => fact.id))
  return cards.every((card) => {
    const copy = `${card.headline} ${card.roast} ${card.savageRoast ?? ''}`
    // These deterministic templates never receive member names. Comparing their
    // prose to real names causes false positives for short names such as "H" or
    // common-word display names. AI plans are guarded separately on the server,
    // where the model receives aliases instead of names.
    return card.factIds.every((id) => factIds.has(id)) && !/\d/.test(card.headline.replace(/\{\{[^}]+\}\}/g, '')) && (groupLayouts.has(card.layout) || !vagueCardCopy.test(copy))
  })
}

export function resolveTemplate(template: string, facts: Fact[], members: Member[], redacted = false) {
  const byId = new Map(facts.map((fact) => [fact.id, fact]))
  return template.replace(/\{\{(value|detail|member):([^}]+)\}\}/g, (_, field: string, requestedId: string) => {
    const fact = byId.get(requestedId === 'self' ? facts[0]?.id : requestedId)
    if (!fact) return redacted ? '▓▓▓▓' : '—'
    if (redacted) return field === 'detail' && fact.kind === 'busiest_day' ? '▓▓▓▓' : '▓▓▓▓▓'
    if (field === 'value') return typeof fact.value === 'number' ? new Intl.NumberFormat('en-GB').format(fact.value) : String(fact.value)
    if (field === 'detail') return fact.detail ?? '—'
    return members.find((member) => member.id === fact.memberIds[0])?.name ?? 'Someone'
  })
}
