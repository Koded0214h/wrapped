/// <reference lib="webworker" />
import { strFromU8, unzipSync } from 'fflate'
import type { AggregateChat, Member } from './types'
import { isExportPlaceholder, normalizeExportText, vocabularyArtifactWords } from './textArtifacts'
import { deriveVerdict } from './deriveVerdict'

type ParsedMessage = { ts: number; sender: string; text: string; hour: number; dateKey: string }
type Request = { file: File }

const systemLine = /joined|left|added|removed|security code|messages and calls are end-to-end encrypted|changed the subject|created group/i
const laughPattern = /😂|🤣|\blol\b|\blmao\b|ha{2,}|he{2,}/gi
const emojiPattern = /\p{Extended_Pictographic}/gu
const stopWords = new Set(['the','and','that','this','with','have','you','for','but','not','are','was','just','your','from','they','will','what','when','then','there','about','been','can','all','our','she','him','her','its','too','yes','okay','ok','like'])

function fail(code: string, message: string): never { throw new Error(`${code}: ${message}`) }

async function extractText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (/\.zip$/i.test(file.name)) {
    const entries = unzipSync(bytes)
    const textEntry = Object.entries(entries).find(([name]) => /\.txt$/i.test(name) && !name.startsWith('__MACOSX'))
    if (!textEntry) fail('P-104', 'This zip does not contain a .txt export. Export the chat again and choose Without media.')
    return strFromU8(textEntry[1])
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function detectDateOrder(lines: string[]) {
  for (const line of lines.slice(0, 2000)) {
    const match = line.match(/\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
    if (!match) continue
    if (Number(match[1]) > 12) return 'dmy'
    if (Number(match[2]) > 12) return 'mdy'
  }
  return 'dmy'
}

function parseTimestamp(dateText: string, timeText: string, order: string) {
  const [a, b, rawYear] = dateText.split('/').map(Number)
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  const day = order === 'dmy' ? a : b
  const month = (order === 'dmy' ? b : a) - 1
  const normalized = timeText.replace(/\u202f/g, ' ').trim()
  const parts = normalized.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i)
  if (!parts) return null
  let hour = Number(parts[1])
  const minute = Number(parts[2])
  if (parts[3]?.toUpperCase() === 'PM' && hour < 12) hour += 12
  if (parts[3]?.toUpperCase() === 'AM' && hour === 12) hour = 0
  const date = new Date(year, month, day, hour, minute)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseLines(text: string) {
  const lines = text.replace(/\r/g, '').split('\n')
  const dateOrder = detectDateOrder(lines)
  const messages: ParsedMessage[] = []
  let unknown = 0
  let format: 'android' | 'ios' | 'unknown' = 'unknown'
  let clock: '12h' | '24h' = '24h'
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const ios = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*([^\]]+)\]\s*([^:]+):\s?(.*)$/)
    const android = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(.+?)\s+-\s+([^:]+):\s?(.*)$/)
    const match = ios ?? android
    if (match) {
      format = ios ? 'ios' : 'android'
      if (/AM|PM/i.test(match[2])) clock = '12h'
      const date = parseTimestamp(match[1], match[2], dateOrder)
      if (!date || systemLine.test(match[3])) { unknown++; continue }
      messages.push({ ts: date.getTime(), sender: match[3].trim(), text: match[4], hour: date.getHours(), dateKey: date.toISOString().slice(0, 10) })
    } else if (messages.length && line.trim()) messages[messages.length - 1].text += `\n${line}`
    else if (line.trim()) unknown++
    if (index % 3000 === 0) postMessage({ type: 'progress', progress: { percent: Math.round(index / Math.max(1, lines.length) * 70), processed: index, total: lines.length, label: 'Reading messages' } })
  }
  return { messages: messages.slice(-60000), diagnostics: { format, clock, dateOrder, unknownPct: Math.round(unknown / Math.max(1, lines.length) * 1000) / 10, capped: messages.length > 60000, mediaPct: 0, languageHint: 'unknown' } }
}

function aggregate(parsed: ReturnType<typeof parseLines>): AggregateChat {
  const { messages, diagnostics } = parsed
  if (messages.length < 10) fail('P-102', `Only ${messages.length} messages were readable. This export is too short to build an honest story.`)
  const memberMap = new Map<string, Member & { replyTotal: number; replyCount: number; lastTs: number }>()
  const days = new Map<string, number>()
  const words = new Map<string, number>()
  let wordCount = 0, emojis = 0, mediaOmitted = 0
  messages.forEach((message, index) => {
    const id = `m_${Array.from(memberMap.keys()).indexOf(message.sender) + 1 || memberMap.size + 1}`
    const member = memberMap.get(message.sender) ?? { id, name: message.sender, messages: 0, sharePct: 0, avgReplyMins: 0, longestSilenceHrs: 0, starts: 0, laughs: 0, sorrys: 0, nightMessages: 0, mediaCount: 0, replyTotal: 0, replyCount: 0, lastTs: message.ts }
    member.messages++
    member.laughs += (message.text.match(laughPattern) ?? []).length
    member.sorrys += (message.text.match(/\b(sorry|my bad)\b/gi) ?? []).length
    if (message.hour < 5) member.nightMessages++
    const messageText = normalizeExportText(message.text)
    const isPlaceholder = isExportPlaceholder(messageText)
    if (isPlaceholder) { member.mediaCount++; mediaOmitted++ }
    member.longestSilenceHrs = Math.max(member.longestSilenceHrs, Math.round((message.ts - member.lastTs) / 3600000))
    member.lastTs = message.ts
    const previous = messages[index - 1]
    if (!previous || message.ts - previous.ts >= 6 * 3600000) member.starts++
    if (previous && previous.sender !== message.sender) {
      const gap = Math.min(360, Math.max(0, (message.ts - previous.ts) / 60000))
      member.replyTotal += gap; member.replyCount++
    }
    memberMap.set(message.sender, member)
    days.set(message.dateKey, (days.get(message.dateKey) ?? 0) + 1)
    emojis += (messageText.match(emojiPattern) ?? []).length
    for (const word of (isPlaceholder ? '' : messageText).toLowerCase().match(/[\p{L}']{3,}/gu) ?? []) {
      wordCount++
      if (!stopWords.has(word) && !vocabularyArtifactWords.has(word) && !systemLine.test(word)) words.set(word, (words.get(word) ?? 0) + 1)
    }
  })
  const sampledText = messages.slice(0, 2000).map((message) => message.text).join(' ')
  const letters = sampledText.match(/\p{L}/gu)?.length ?? 0
  const latinLetters = sampledText.match(/\p{Script=Latin}/gu)?.length ?? 0
  diagnostics.mediaPct = Math.round(mediaOmitted / Math.max(1, messages.length) * 1000) / 10
  diagnostics.languageHint = letters === 0 ? 'unknown' : latinLetters / letters > .8 ? 'latin' : latinLetters / letters < .4 ? 'mostly-non-latin' : 'mixed'
  const members = Array.from(memberMap.values()).map(({ replyTotal, replyCount, lastTs: _lastTs, ...member }) => ({ ...member, sharePct: Math.round(member.messages / messages.length * 1000) / 10, avgReplyMins: Math.round(replyTotal / Math.max(1, replyCount)) }))
  const busiest = [...days.entries()].sort((a, b) => b[1] - a[1])[0]
  const memberNameWords = new Set(Array.from(memberMap.keys()).flatMap((name) => normalizeExportText(name).toLowerCase().match(/[\p{L}']{3,}/gu) ?? []))
  const topWords = [...words.entries()].filter(([word]) => !memberNameWords.has(word)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => ({ word, count }))
  const first = new Date(messages[0].ts), last = new Date(messages.at(-1)!.ts)
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  postMessage({ type: 'progress', progress: { percent: 90, processed: messages.length, total: messages.length, label: 'Computing facts' } })
  return {
    chatType: members.length > 2 ? 'group' : 'dm', chatName: members.length > 2 ? 'Your group chat' : 'Your chat',
    range: { start: dateFormat.format(first), end: dateFormat.format(last) },
    totals: { messages: messages.length, words: wordCount, activeDays: days.size, emojis, busiestDay: { date: busiest?.[0] ?? '', count: busiest?.[1] ?? 0 } },
    members, topWords, sourceKind: 'upload', thinStats: messages.length < 200 || diagnostics.mediaPct > 70,
    verdict: deriveVerdict(members, messages.length)
  }
}

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    const text = await extractText(event.data.file)
    const parsed = parseLines(text)
    const result = aggregate(parsed)
    postMessage({ type: 'done', result, diagnostics: parsed.diagnostics })
  } catch (error) { postMessage({ type: 'error', message: error instanceof Error ? error.message : 'P-100: The export could not be read.' }) }
}
