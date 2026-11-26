import { describe, expect, it } from 'vitest'
import { getAnalysis } from './getAnalysis'
import { planGroupCards, redactTemplate, resolveTemplate, validatePlannedCards } from './planCards'
import { computeFacts } from './computeFacts'
import type { AggregateChat } from './types'
import { deriveVerdict } from './deriveVerdict'
import { characterStyleFor } from '../components/MemberCharacter'
import { assignArchetypes } from './assignArchetypes'

describe('dynamic card planning', () => {
  it('never silently substitutes demo data when an upload is missing', async () => {
    await expect(getAnalysis('group')).rejects.toThrow('U-202')
  })
  it('produces visibly different sequences for the three mock chats', async () => {
    const friends = await getAnalysis('group', { mock: 'friends' })
    const study = await getAnalysis('group', { mock: 'study' })
    const couple = await getAnalysis('dm', { mock: 'couple' })
    const sequence = (result: typeof friends) => result.cards.map((card) => `${card.layout}:${card.factIds[0]}`).join('|')
    const layoutSequence = (result: typeof friends) => result.cards.map((card) => card.layout).join('|')
    expect(new Set([sequence(friends), sequence(study), sequence(couple)]).size).toBe(3)
    expect(layoutSequence(friends)).toBe(layoutSequence(study))
    expect(layoutSequence(friends)).not.toBe(layoutSequence(couple))
    expect(friends.cards.map((card) => card.layout)).toEqual(['groupNumbers', 'yapLeaderboard', 'characterCast', 'groupAwards', 'socialGraph', 'plotTwist', 'groupLanguage', 'timeCapsule', 'companyRoast', 'dynamicDuo', 'replyRace', 'nightShift', 'mediaDesk', 'ghostWatch', 'laughTrack', 'conversationSpark', 'groupPulse', 'memoryVault', 'movieFinale', 'finalVerdict'])
    for (const result of [friends, study, couple]) {
      expect(result.facts.length).toBeGreaterThanOrEqual(40)
      expect(result.cards.length).toBeGreaterThanOrEqual(8)
      expect(result.cards.length).toBeLessThanOrEqual(result.chatType === 'group' ? 20 : 16)
      expect(result.cards[0].layout).toBe(result.chatType === 'group' ? 'groupNumbers' : 'cover')
      expect(result.cards.at(-1)?.layout).toBe(result.chatType === 'group' ? 'finalVerdict' : 'verdict')
      expect(result.cards[0].locked).toBe(false)
      expect(result.cards[1].locked).toBe(false)
      expect(result.cards.filter((card) => !card.locked).length).toBe(3)
      expect(new Set(result.cards.slice(0, 3).map((card) => card.layout)).size).toBe(3)
      expect(new Set(result.cards.slice(2).map((card) => card.layout)).size).toBeGreaterThanOrEqual(5)
      expect(result.cards.some((card) => card.layout === 'quote')).toBe(false)
      for (const layout of new Set(result.cards.map((card) => card.layout))) expect(result.cards.filter((card) => card.layout === layout).length).toBeLessThanOrEqual(2)
      if (result.chatType === 'dm') expect(result.cards.slice(2, 6).some((card) => card.factIds.some((id) => ['total_words', 'emoji_count', 'busiest_day'].includes(id)))).toBe(false)
    }
    expect(couple.cards.some((card) => card.layout === 'versus')).toBe(true)
    expect(friends.cards.find((card) => card.layout === 'groupAwards')?.factIds).toContain('longest_silence_segun')
  })

  it('adds storytelling context to facts instead of ranking raw values alone', async () => {
    const result = await getAnalysis('group', { mock: 'friends' })
    const topMessages = result.facts.find((fact) => fact.id === 'member_messages_zainab')
    expect(result.facts.length).toBeGreaterThanOrEqual(40)
    expect(result.facts.length).toBeLessThanOrEqual(60)
    expect(topMessages?.context).toMatchObject({ rank: 1, outOf: 7, activitySharePct: 25.1 })
    expect(topMessages?.context?.gap).toBeGreaterThan(0)
    expect(topMessages?.context?.confidence).toBeGreaterThan(80)
    expect(topMessages?.context?.humourScore).toBeGreaterThan(0)
    expect(topMessages?.context?.visualScore).toBeGreaterThan(0)
  })

  it('keeps card copy in direct Pidgin and gives members stable distinct characters', async () => {
    const result = await getAnalysis('group', { mock: 'friends' })
    const vague = /\b(energy|vibes?|chaos|evidence|receipts|iconic|economy|department|certified)\b/i
    const pidgin = /\b(na|dey|don|una|wey|dem|fit|am|no)\b/i
    for (const card of result.cards.filter((card) => !['groupNumbers','yapLeaderboard','characterCast','groupAwards','socialGraph','plotTwist','groupLanguage','timeCapsule','companyRoast','dynamicDuo','replyRace','nightShift','mediaDesk','ghostWatch','laughTrack','conversationSpark','groupPulse','memoryVault','movieFinale','finalVerdict'].includes(card.layout))) {
      const referenced = card.factIds.map((id) => result.facts.find((fact) => fact.id === id)!).filter(Boolean)
      const copy = `${resolveTemplate(card.headline, referenced, result.members)} ${resolveTemplate(card.roast, referenced, result.members)}`
      expect(copy).not.toMatch(vague)
      expect(copy).toMatch(pidgin)
    }
    const styles = result.members.map((member) => JSON.stringify(characterStyleFor(member.id)))
    expect(new Set(styles).size).toBeGreaterThanOrEqual(Math.min(4, result.members.length))
    expect(characterStyleFor(result.members[0].id)).toEqual(characterStyleFor(result.members[0].id))
    const archetypes = [...assignArchetypes(result.members).values()].map((item) => item.title)
    expect(new Set(archetypes).size).toBe(result.members.length)
    expect(archetypes).not.toContain('The Reliable Regular')
  })

  it('gives everyone in a large group a character built from their own numbers', () => {
    const members = Array.from({ length: 250 }, (_, index) => ({
      id: `large_${index}`, name: `Member ${index}`, messages: index + 1, sharePct: .4,
      avgReplyMins: 5, longestSilenceHrs: index, starts: index % 8, laughs: index % 12,
      sorrys: 0, nightMessages: index % 20, mediaCount: index % 6
    }))
    const archetypes = assignArchetypes(members)
    expect(archetypes.size).toBe(members.length)
    // Headline roles stay one of a kind; habits further down may be shared.
    // At least the headline roles that this data supports are handed out once each.
    expect(new Set([...archetypes.values()].map((item) => item.title)).size).toBeGreaterThan(12)
    expect([...archetypes.values()].some((item) => item.description.startsWith('Showed up with'))).toBe(true)
    expect([...archetypes.values()].some((item) => /No duplicate casting/.test(item.description))).toBe(false)
  })

  it('keeps locked templates free of resolved names and values', async () => {
    const result = await getAnalysis('group', { mock: 'friends' })
    for (const card of result.cards.filter((item) => item.locked)) {
      const redacted = redactTemplate(card.headline)
      const resolved = resolveTemplate(card.headline, card.factIds.map((id) => result.facts.find((fact) => fact.id === id)!), result.members)
      if (/\{\{/.test(card.headline)) {
        expect(redacted).toContain('▓')
        expect(redacted).not.toBe(resolved)
      }
      for (const member of result.members) expect(redacted).not.toContain(member.name)
    }
  })

  it('does not reject deterministic cards when a short display name appears inside normal prose', async () => {
    const result = await getAnalysis('group', { mock: 'friends' })
    const members = result.members.map((member, index) => index === 0 ? { ...member, name: 'H' } : member)
    expect(validatePlannedCards(planGroupCards(result.facts), result.facts, members)).toBe(true)
  })

  it('rejects placeholder verdicts and derives an evidence-based closing verdict', () => {
    const upload: AggregateChat = {
      chatType: 'dm', chatName: 'Your chat', sourceKind: 'upload', thinStats: true,
      range: { start: '1 Jan 2026', end: '2 Jan 2026' },
      totals: { messages: 20, words: 80, activeDays: 2, emojis: 3, busiestDay: { date: '1 Jan 2026', count: 14 } },
      members: [
        { id: 'm_1', name: 'Member A', messages: 11, sharePct: 55, avgReplyMins: 4, longestSilenceHrs: 3, starts: 2, laughs: 2, sorrys: 0, nightMessages: 1, mediaCount: 0 },
        { id: 'm_2', name: 'Member B', messages: 9, sharePct: 45, avgReplyMins: 6, longestSilenceHrs: 5, starts: 1, laughs: 1, sorrys: 0, nightMessages: 0, mediaCount: 0 }
      ],
      verdict: { title: 'The final verdict is in...', blurb: 'A smaller, honest deck from a short export.' }
    }
    expect(computeFacts(upload).some((fact) => fact.kind === 'verdict')).toBe(false)
    const verdict = deriveVerdict(upload.members, upload.totals.messages)
    expect(verdict.title).toBe('You Both Dey Reply')
    expect(verdict.blurb).toContain('10 percentage points')
    upload.verdict = verdict
    const facts = computeFacts(upload)
    expect(facts.some((fact) => fact.kind === 'verdict')).toBe(true)
  })
})
