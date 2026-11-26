import { describe, expect, it } from 'vitest'
import { buildRhythm, readCall } from './rhythm'
import { getAnalysis } from './getAnalysis'
import { parseChat } from './parseChat'
import { computeFacts } from './computeFacts'
import { planCards, validatePlannedCards } from './planCards'

const two = (value: number) => String(value).padStart(2, '0')

describe('calendar patterns', () => {
  it('finds the streak, the quiet gap and silent months', () => {
    const rhythm = buildRhythm(new Map([['2025-01-30', 1], ['2025-01-31', 1], ['2025-02-01', 1], ['2025-04-05', 4]]), Array(24).fill(0))
    expect(rhythm.longestStreak).toBe(3)
    expect(rhythm.quietGap).toEqual({ days: 62, from: '2025-02-01', to: '2025-04-05' })
    expect(rhythm.months.map((item) => item.count)).toEqual([2, 1, 0, 4])
  })

  it('reads WhatsApp call lines and nothing that merely mentions a call', () => {
    expect(readCall('Voice call, 1 hr 5 min')).toEqual({ kind: 'voice', missed: false, seconds: 3900 })
    expect(readCall('Missed video call')).toEqual({ kind: 'video', missed: true, seconds: 0 })
    expect(readCall('voice call, 5 minutes abeg')).toBeUndefined()
    expect(readCall('I missed voice call from mum')).toBeUndefined()
  })

  it('builds every calendar card for a direct chat that has the evidence', async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `[${two(1 + Math.floor(i / 10))}/0${i < 100 ? 3 : 5}/2025, ${two(8 + i % 9)}:${two(i % 60)}:00] ${i % 3 ? 'Ada' : 'Bola'}: see you \u{1F602}\u{1F525}\u{1F60D}`)
    lines.push('[25/05/2025, 20:00:00] Ada: \u200eVoice call, 12 min', '[25/05/2025, 21:00:00] Bola: \u200eMissed video call')
    const { result } = await parseChat(new File([lines.join('\n')], 'chat.txt'))
    expect(result.totals.messages).toBe(200)
    expect(result.rhythm?.calls).toEqual({ voice: 1, video: 0, missed: 1, minutes: 12 })
    const facts = computeFacts({ ...result, sourceKind: 'upload' })
    const cards = planCards(facts, { chatType: 'dm', maxCards: 9 })
    expect(cards.map((card) => card.layout)).toEqual(expect.arrayContaining(['highlights', 'split', 'monthly', 'hourly', 'quietGap', 'emojiBoard', 'calls']))
    expect(cards.at(-1)?.layout).toBe('verdict')
    expect(validatePlannedCards(cards, facts, result.members)).toBe(true)
  })

  it('shows them in the sample couple chat and leaves group decks alone', async () => {
    expect((await getAnalysis('dm', { mock: 'couple' })).cards.map((card) => card.layout)).toContain('calls')
    expect((await getAnalysis('group', { mock: 'friends' })).cards).toHaveLength(20)
  })
})
