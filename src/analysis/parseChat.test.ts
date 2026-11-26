import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { parseChat } from './parseChat'

const two = (value: number) => String(value).padStart(2, '0')
const chat = (format: (i: number, sender: string, text: string) => string, { senders = ['Ada', 'Bola'], count = 40, text = (() => 'see you tomorrow') as (i: number) => string } = {}) =>
  Array.from({ length: count }, (_, i) => format(i, senders[i % senders.length], text(i))).join('\n')
const android = (i: number, sender: string, text: string) => `${two(1 + Math.floor(i / 10))}/03/2025, 10:${two(i % 60)} - ${sender}: ${text}`
const file = (content: string | Uint8Array, name = 'chat.txt') => new File([content as BlobPart], name)
const parse = async (content: string | Uint8Array, name?: string, includeAiChunks = false) => (await parseChat(file(content, name), { includeAiChunks })).result
const total = <K extends 'mediaCount' | 'voiceNotes' | 'laughs' | 'nightMessages'>(result: Awaited<ReturnType<typeof parse>>, key: K) => result.members.reduce((sum, member) => sum + (member[key] ?? 0), 0)

describe('export formats', () => {
  it.each([
    ['dots', (i: number, s: string, t: string) => `05.03.25, 10:${two(i)} - ${s}: ${t}`],
    ['dashes', (i: number, s: string, t: string) => `05-03-2025 10:${two(i)} - ${s}: ${t}`],
    ['year first', (i: number, s: string, t: string) => `2025-03-05, 10:${two(i)} - ${s}: ${t}`],
    ['iOS dots', (i: number, s: string, t: string) => `[05.03.25, 10:${two(i)}:00] ${s}: ${t}`]
  ])('reads %s dates', async (_name, format) => {
    expect((await parse(chat(format))).range.start).toBe('5 Mar 2025')
  })

  it('reads ambiguous US dates as month first when that keeps the export in order', async () => {
    const result = await parse(chat((i, s, t) => `[3/${1 + Math.floor(i / 4)}/25, 9:${two(i)}:00 PM] ${s}: ${t}`))
    expect(result.range).toEqual({ start: '1 Mar 2025', end: '10 Mar 2025' })
  })

  it('applies a.m. and p.m.', async () => {
    expect(total(await parse(chat((i, s, t) => `05/03/2025, 12:${two(i)} a.m. - ${s}: ${t}`)), 'nightMessages')).toBe(40)
    expect(total(await parse(chat((i, s, t) => `05/03/2025, 2:${two(i)} p.m. - ${s}: ${t}`)), 'nightMessages')).toBe(0)
  })

  it('skips impossible dates instead of rolling them over', async () => {
    await expect(parse(chat((i, s, t) => `31/02/2025, 10:${two(i)} - ${s}: ${t}`))).rejects.toThrow('P-102')
  })

  it('keeps the local calendar day just after midnight', async () => {
    const result = await parse(chat((i, s, t) => `05/03/2025, 00:${two(i)} - ${s}: ${t}`))
    expect(result.totals.busiestDay.date).toBe('2025-03-05')
  })

  it('keeps members whose names contain system words', async () => {
    const result = await parse(chat(android, { senders: ['Joe Leftwich', 'Addedayo'] }))
    expect(result.members.map((member) => member.name)).toEqual(['Joe Leftwich', 'Addedayo'])
  })

  it('does not glue system lines onto the message above', async () => {
    const result = await parse(`${chat(android)}\n09/03/2025, 23:00 - Ada left\n09/03/2025, 23:01 - Ada changed the subject to "Trip: Lagos"\n[09/03/2025, 23:02] Trip: ‎Ada added Chidi`)
    expect(result.totals.words).toBe(120)
    expect(result.members).toHaveLength(2)
  })

  it('drops iOS group events but keeps typed messages that use the same words', async () => {
    const typed = chat((i, s, t) => `[05/03/2025, 10:${two(i)}:00] ${s}: ${t}`, { text: () => 'I left and added it: \u200eremoved' })
    const result = await parse(`${typed}\n[05/03/2025, 11:00:00] Chidi: \u200eAda added Chidi\n[05/03/2025, 11:01:00] Dayo: \u200eDayo pinned a message`)
    expect(result.totals.messages).toBe(40)
    expect(result.members).toHaveLength(2)
  })

  it('counts attached files as media and keeps their file names out of vocabulary', async () => {
    const bodies = ['IMG-20250301-WA0001.jpg (file attached)\nholiday', 'PTT-20250301-WA0002.opus (file attached)', '<attached: 00001-PHOTO.jpg>', '‎audio omitted', '<Media omitted>']
    const result = await parse(chat(android, { text: (i) => bodies[i % 5] }))
    expect(total(result, 'mediaCount')).toBe(40)
    expect(total(result, 'voiceNotes')).toBe(16)
    expect(result.topWords?.map((item) => item.word)).toEqual(['holiday'])
  })

  it('counts laughs without counting ordinary words', async () => {
    expect(total(await parse(chat(android, { text: () => 'the sheet is heeled, haa' })), 'laughs')).toBe(0)
    expect(total(await parse(chat(android, { text: () => 'LMFAO hahaha kikiki' })), 'laughs')).toBe(120)
  })

  it('picks the chat out of a zip that also holds another text file', async () => {
    const zip = zipSync({ 'notes.txt': strToU8('shopping list\nrice'), 'WhatsApp Chat with Ada.txt': strToU8(chat(android)) })
    expect((await parse(zip, 'export.zip')).totals.messages).toBe(40)
  })

  it('reads UTF-16 files', async () => {
    expect((await parse(new Uint8Array(Buffer.from(`﻿${chat(android)}`, 'utf16le')))).totals.messages).toBe(40)
  })

  it('redacts first names, short names and possessives before AI upload', async () => {
    const result = await parse(chat(android, { senders: ['Adaeze Obi', 'Bo', 'Chidi'], text: () => 'tell Adaeze and Bo about Obi’s book, it is boring' }), undefined, true)
    const sent = result.aiChunks!.map((chunk) => chunk.text).join('\n')
    expect(sent).not.toMatch(/\b(Adaeze|Obi|Bo|Chidi)\b/)
    expect(sent).toContain('book, it is boring')
    expect(sent).toContain('Person A')
  })
})

describe('very large chats', () => {
  it('samples AI input across the whole period but counts every message', async () => {
    const result = await parse(chat((i, s, t) => `${two(1 + Math.floor(i / 100))}/03/2025, 10:${two(i % 60)} - ${s}: ${t}`, { count: 1500, text: () => 'word '.repeat(700) }), undefined, true)
    const sent = result.aiChunks!
    expect(result.totals.messages).toBe(1500)
    expect(sent).toHaveLength(21)
    expect(sent.reduce((sum, chunk) => sum + chunk.text.length, 0)).toBeLessThan(4_000_000)
    expect(sent[0].text).toContain('[2025-03-01]')
    expect(sent.at(-1)!.text).toContain('[2025-03-15]')
  })
})
