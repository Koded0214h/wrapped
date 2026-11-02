import type { Card, Fact, LayoutType, Member } from './types'

const blockedKinds = new Set(['health', 'religion', 'sexuality', 'ethnicity', 'finances', 'romance_group', 'explicit', 'harassment'])

const presentation: Record<string, { layout: LayoutType; headline: string; roast: string; savage: string }> = {
  member_messages: { layout: 'leaderboard', headline: '{{member:self}} turned this chat into a podcast.', roast: 'One thumb. Endless episodes.', savage: '{{member:self}} would text an empty room.' },
  message_share: { layout: 'bigNumber', headline: 'Every {{value:self}}% of the gist leads back to {{member:self}}.', roast: 'Main-character data usage.', savage: 'A one-person broadcast station.' },
  fast_reply: { layout: 'versus', headline: '{{member:self}} replies before the notification can breathe.', roast: '{{value:self}} minutes. Very available behaviour.', savage: 'Phone permanently in hand.' },
  slow_reply: { layout: 'timeline', headline: '{{member:self}} lets a reply marinate for {{value:self}} minutes.', roast: 'Seen it. Considered it. Eventually replied.', savage: 'Carrier pigeon energy.' },
  longest_silence: { layout: 'timeline', headline: '{{member:self}} disappeared for {{value:self}} hours.', roast: 'Then returned without an explanation. Elite confidence.', savage: 'Entered witness protection.' },
  conversation_starts: { layout: 'bigNumber', headline: '{{member:self}} rescued the chat {{value:self}} times.', roast: 'The unpaid social secretary deserves flowers.', savage: 'Without them, this chat is a museum.' },
  laugh_count: { layout: 'versus', headline: '{{member:self}} brought the laugh track.', roast: '{{value:self}} laughs. A very supportive audience.', savage: 'Laughing is the full-time job.' },
  hard_to_impress: { layout: 'quote', headline: 'Making {{member:self}} laugh is an achievement.', roast: 'Only {{value:self}} laughs made it past quality control.', savage: 'Joy remains under investigation.' },
  sorry_count: { layout: 'award', headline: 'The apology bouquet goes to {{member:self}}.', roast: '{{value:self}} sorrys. Growth, or repeat offences?', savage: 'The apology department stays open.' },
  night_activity: { layout: 'heatmap', headline: 'At bedtime, {{member:self}} chose gist.', roast: '{{value:self}} night messages. Sleep never stood a chance.', savage: 'Insomnia became a personality.' },
  media_dropper: { layout: 'award', headline: '{{member:self}} came with receipts.', roast: '{{value:self}} drops. The archive is complete.', savage: 'A human forwarding service.' },
  quiet_member: { layout: 'bigNumber', headline: 'We checked attendance. {{member:self}} was technically here.', roast: 'Quiet luxury, but make it a group chat.', savage: 'Contributes mostly profile pictures.' },
  reply_gap: { layout: 'timeline', headline: 'A reply from {{member:self}} needs patience.', roast: '{{value:self}} minutes. Character development for everyone.', savage: 'A reply should not need a sequel.' },
  daily_presence: { layout: 'heatmap', headline: '{{member:self}} clocked in for gist every day.', roast: '{{value:self}} messages daily. No annual leave taken.', savage: 'The attendance is slightly concerning.' },
  repeated_phrase: { layout: 'wordCloud', headline: '“{{detail:self}}” did overtime in this chat.', roast: '{{value:self}} appearances. At this point, it deserves admin rights.', savage: 'One word carried the entire conversation.' },
  busiest_day: { layout: 'bigNumber', headline: '{{detail:self}} became a full group meeting.', roast: '{{value:self}} messages landed. Nobody had anywhere else to be.', savage: 'Productivity left the chat.' },
  total_words: { layout: 'bigNumber', headline: '{{value:self}} words of evidence.', roast: 'A pocket-sized novel with no editor.', savage: 'All that typing and the plans still failed.' },
  emoji_count: { layout: 'bigNumber', headline: '{{value:self}} emojis did the emotional labour.', roast: 'Words clocked out early.', savage: 'Punctuation lost its job.' },
  verdict: { layout: 'verdict', headline: '{{value:self}}', roast: '{{detail:self}}', savage: '{{detail:self}}' }
}

function cardFromFact(fact: Fact, index: number): Card {
  const spec = presentation[fact.kind] ?? { layout: 'quote' as LayoutType, headline: '{{member:self}} changed the chat.', roast: 'The evidence speaks.', savage: 'The evidence is loud.' }
  return { id: `card_${fact.id}`, layout: spec.layout, factIds: [fact.id], headline: spec.headline, roast: spec.roast, savageRoast: spec.savage, locked: index > 1 }
}

export function planCards(facts: Fact[], options: { maxCards?: number } = {}): Card[] {
  const safe = facts.filter((fact) => !blockedKinds.has(fact.kind) && presentation[fact.kind])
  const thin = facts.some((fact) => fact.kind === 'thin_stats')
  const verdict = safe.find((fact) => fact.kind === 'verdict')
  const cover: Card = { id: 'cover', layout: 'cover', factIds: ['chat_label', 'date_range', 'total_messages', ...(thin ? ['thin_stats'] : [])], headline: '{{value:chat_label}}', roast: thin ? 'Tiny export. Loud personalities. Only the receipts we can prove.' : 'We read the totals. Yes, all of them.', locked: false }
  const numbers: Card = { id: 'numbers', layout: 'bigNumber', factIds: ['total_messages', 'total_words', 'active_days', 'emoji_count'], headline: '{{value:total_messages}} messages of evidence.', roast: thin ? 'Small chat. Strong evidence.' : 'That is a serious amount of gist.', locked: false }
  const target = Math.max(1, (options.maxCards ?? 9) - 2 - (verdict ? 1 : 0))
  const genericKinds = new Set(['total_words', 'emoji_count', 'busiest_day'])
  const ranked = [...safe].filter((fact) => !['chat_label', 'date_range', 'total_messages', 'active_days', 'verdict'].includes(fact.kind)).sort((a, b) => {
    const genericPenalty = Number(genericKinds.has(a.kind)) - Number(genericKinds.has(b.kind))
    return genericPenalty || b.surpriseScore - a.surpriseScore
  })
  const selected: Fact[] = []
  const usedLayouts = new Set<LayoutType>()
  const usedMembers = new Set<string>()
  while (selected.length < target) {
    const next = ranked
      .filter((fact) => !selected.some((item) => item.kind === fact.kind) && !usedLayouts.has(presentation[fact.kind].layout))
      .sort((a, b) => {
        const aFresh = a.memberIds.some((id) => !usedMembers.has(id)) ? 1 : 0
        const bFresh = b.memberIds.some((id) => !usedMembers.has(id)) ? 1 : 0
        return (b.surpriseScore + bFresh * 8) - (a.surpriseScore + aFresh * 8)
      })[0]
    if (!next) break
    selected.push(next)
    usedLayouts.add(presentation[next.kind].layout)
    next.memberIds.forEach((id) => usedMembers.add(id))
  }
  for (const fact of ranked) {
    if (selected.length === target) break
    if (selected.some((item) => item.kind === fact.kind)) continue
    selected.push(fact)
  }
  const planned = selected.map((fact, index) => {
    const card = cardFromFact(fact, index + 2)
    if (card.layout === 'leaderboard' || card.layout === 'versus' || card.layout === 'wordCloud') card.factIds = ranked.filter((item) => item.kind === fact.kind).slice(0, card.layout === 'leaderboard' ? 5 : card.layout === 'wordCloud' ? 6 : 2).map((item) => item.id)
    return card
  })
  const closing = verdict ? [{ ...cardFromFact(verdict, planned.length + 2), locked: true }] : []
  const cards = [cover, numbers, ...planned, ...closing]
  const shockerId = selected.sort((a, b) => b.surpriseScore - a.surpriseScore)[0]?.id
  return cards.map((card) => card.factIds.includes(shockerId) ? { ...card, locked: false } : card)
}

export const redactTemplate = (template: string) => template.replace(/\{\{(?:value|detail|member):[^}]+\}\}/g, '▓▓▓▓▓')

export function validatePlannedCards(cards: Card[], facts: Fact[], members: Member[]) {
  const factIds = new Set(facts.map((fact) => fact.id))
  const names = members.map((member) => member.name.toLowerCase())
  return cards.every((card) => card.factIds.every((id) => factIds.has(id)) && !names.some((name) => card.headline.toLowerCase().includes(name)) && !/\d/.test(card.headline.replace(/\{\{[^}]+\}\}/g, '')))
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
