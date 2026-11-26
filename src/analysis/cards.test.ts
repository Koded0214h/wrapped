import { describe, expect, it } from 'vitest'
import { toDisplayMembers } from './memberNames'
import { clearWinner, qualifiesForReplyRank } from './fairness'
import { computeFacts } from './computeFacts'
import { planCards } from './planCards'
import { parseChat } from './parseChat'
import type { Member } from './types'

const member = (name: string, extra: Partial<Member> = {}): Member => ({ id: name, name, messages: 10, sharePct: 50, avgReplyMins: 5, longestSilenceHrs: 1, starts: 1, laughs: 0, sorrys: 0, nightMessages: 0, mediaCount: 0, ...extra })
const two = (value: number) => String(value).padStart(2, '0')
const chat = async (senders: string[], count: number) => (await parseChat(new File([Array.from({ length: count }, (_, i) => `01/03/2025, ${two(10 + Math.floor(i / 60))}:${two(i % 60)} - ${senders[i % senders.length]}: see you tomorrow`).join('\n')], 'chat.txt'))).result

describe('names on cards', () => {
  it('keeps hidden names distinct', () => {
    expect(toDisplayMembers([member('Ada'), member('Bola')], true).map((item) => item.short)).toEqual(['Member 1', 'Member 2'])
  })
  it('tells repeated first names apart and masks phone numbers', () => {
    const shown = toDisplayMembers([member('Ada Obi'), member('Ada Eze'), member('+234 801 234 5678')], false)
    expect(shown.map((item) => item.short)).toEqual(['Ada O.', 'Ada E.', '…5678'])
    expect(JSON.stringify(shown.map((item) => item.name))).not.toContain('801')
  })
})

describe('winners', () => {
  it('names nobody for a zero or a tie', () => {
    expect(clearWinner([1, 1], (value) => value)).toBeUndefined()
    expect(clearWinner([0, 0], (value) => value)).toBeUndefined()
    expect(clearWinner([1, 3], (value) => value)).toBe(3)
  })
  it('does not rank someone who barely replied as the fastest', () => {
    expect(qualifiesForReplyRank(member('Quiet', { replyCount: 0, avgReplyMins: 0 }), 100)).toBe(false)
  })
  it('builds no direct-chat card out of a zero or an even split', async () => {
    const facts = computeFacts({ ...(await chat(['Ada', 'Bola'], 200)), sourceKind: 'upload' })
    const cited = planCards(facts, { chatType: 'dm' }).filter((card) => !['cover', 'verdict', 'wordCloud'].includes(card.layout)).map((card) => facts.find((fact) => fact.id === card.factIds[0])!)
    expect(cited.filter((fact) => fact.value === 0)).toEqual([])
    expect(cited.filter((fact) => fact.kind === 'message_share')).toEqual([])
  })
  it('records who actually answers whom', async () => {
    const result = await chat(['Ada', 'Bola', 'Ada', 'Bola', 'Chidi'], 100)
    expect(result.members[0].topPartnerId).toBe(result.members[1].id)
  })
})
