import type { Card, Fact, LayoutType, Member } from './types'

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
  media_dropper: { category: 'people', headline: '{{member:self}} drop media tire.', roast: 'Na {{value:self}} photos, videos or links enter from this phone.', savage: 'If media no enter chat, check whether {{member:self}} dey online.' },
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
  facts.filter((fact) => presentation[fact.kind] && fact.kind !== 'verdict' && !blockedKinds.has(fact.kind) && !(unkindForQuietMembers.has(fact.kind) && (fact.context?.activitySharePct ?? 100) < Math.max(3, 20 / memberCount))).forEach((fact) => byKind.set(fact.kind, [...(byKind.get(fact.kind) ?? []), fact]))
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

export function planCards(facts: Fact[], options: { maxCards?: number } = {}): Card[] {
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

export const redactTemplate = (template: string) => template.replace(/\{\{(?:value|detail|member):[^}]+\}\}/g, '▓▓▓▓▓')

export function validatePlannedCards(cards: Card[], facts: Fact[], members: Member[]) {
  const factIds = new Set(facts.map((fact) => fact.id))
  const names = members.map((member) => member.name.toLowerCase())
  return cards.every((card) => {
    const copy = `${card.headline} ${card.roast} ${card.savageRoast ?? ''}`
    return card.factIds.every((id) => factIds.has(id)) && !names.some((name) => card.headline.toLowerCase().includes(name)) && !/\d/.test(card.headline.replace(/\{\{[^}]+\}\}/g, '')) && !vagueCardCopy.test(copy)
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
