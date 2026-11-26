import { describe, expect, it } from 'vitest'
import { assignArchetypes } from './assignArchetypes'
import { personalRoles } from './personalRole'
import { parseChat } from './parseChat'
import type { Member } from './types'

const member = (id: string, extra: Partial<Member> = {}): Member => ({ id, name: id, messages: 40, sharePct: 10, avgReplyMins: 5, longestSilenceHrs: 1, starts: 0, laughs: 0, sorrys: 0, nightMessages: 0, mediaCount: 0, avgMessageWords: 8, ...extra })

describe('characters for everyone else', () => {
  const group = [member('owl', { nightMessages: 20 }), member('plain'), member('terse', { avgMessageWords: 2 }), member('once', { messages: 1, nightMessages: 1 })]

  it('names the habit and shows the real numbers', () => {
    const role = personalRoles(group)
    expect(role(group[0]).description).toBe('20 of 40 messages landed after midnight.')
    expect(role(group[2]).description).toContain('2 words per message')
    expect(role(group[1]).description).toContain('40 messages')
  })

  it('does not read a habit into a single message', () => {
    expect(personalRoles(group)(group[3]).description).toContain('One message')
  })

  it('hands out no headline role without evidence', () => {
    const titles = [...assignArchetypes([member('a'), member('b')]).values()].map((item) => item.title)
    expect(titles).not.toContain('The Finance Secretary')
    expect(titles).not.toContain('The Chief Apologist')
  })
})

describe('stickers', () => {
  it('casts the biggest sticker sender as the Sticker Warrior and the rest by their own count', () => {
    const group = [member('warrior', { stickers: 30, mediaCount: 30 }), member('soldier', { stickers: 12, mediaCount: 12 }), member('plain'), member('plain2'), member('plain3')]
    expect(assignArchetypes(group).get('warrior')?.title).toBe('The Sticker Warrior')
    expect(personalRoles(group)(group[1]).description).toContain('12 stickers')
  })

  it('counts stickers from iPhone lines and attached sticker files only', async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `[05/03/2025, 10:${String(i).padStart(2, '0')}:00] ${i % 2 ? 'Ada' : 'Bola'}: \u200e${['sticker omitted', '<attached: 00001-STICKER-2025.webp>', 'image omitted'][i % 3]}`)
    const { result } = await parseChat(new File([lines.join('\n')], 'chat.txt'))
    expect(result.members.reduce((sum, item) => sum + (item.stickers ?? 0), 0)).toBe(20)
  })
})
