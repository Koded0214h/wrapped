import { strFromU8, unzipSync } from 'fflate'
import type { AggregateChat, Member } from './types'
import { isExportPlaceholder, normalizeExportText, readMedia, vocabularyArtifactWords } from './textArtifacts'
import { deriveVerdict } from './deriveVerdict'
import { isDisplayableMemberName, normalizeMemberName } from './memberNames'
import { createNameRedactor } from './redactNames'
import { buildRhythm, readCall, totalCalls } from './rhythm'

type ParsedMessage = { ts: number; sender: string; text: string; hour: number; dateKey: string }

// A system line that quotes a subject with a colon in it looks like "sender: text".
const systemSender = /messages and calls are end-to-end encrypted|\bcreated (?:this |the )?group\b|\bchanged (?:the (?:subject|group name|group description)|this group)/i
// iOS files system events under a sender and marks them with a leading direction mark.
const iosSystemBody = /(?:\b(?:added|removed|left|joined using|created (?:this )?group|changed (?:the|this|their)|pinned a message)\b|end-to-end encrypted)/i
const systemWords = new Set(['joined', 'left', 'added', 'removed'])
const systemMessage = /messages and calls are end-to-end encrypted|security code changed|created (?:this )?group|changed the (?:group )?(?:subject|description|icon)|turned on disappearing messages|turned off disappearing messages/i
const laughPattern = /😂|🤣|\b(?:lol(?:ol)*|lmf?ao+|rofl|a?(?:ha|he){2,}h?|k{4,}|(?:ki){3,}|(?:ke){3,})\b/gi
// 21 chunks of up to 160k characters stays under the server's AI_MAX_CHAT_CHARS default.
const MAX_AI_CHUNKS = 21
const isLaugh = (text: string) => text.search(laughPattern) >= 0
// Laughter with a few words around it ("omo 😂") is a reaction, never the joke being laughed at.
const isReaction = (text: string) => isLaugh(text) && (text.replace(laughPattern, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0) <= 3
const emojiPattern = /\p{Extended_Pictographic}/gu
const stopWords = new Set([
  'the','and','that','this','with','have','you','for','but','not','are','was','just','your','from','they','will','what','when','then','there','about','been','can','all','our','she','him','her','its','too','yes','okay','ok','like',
  'dey','don','sha','make','one','na','no','get','got','come','know','say','still','even','also','really','maybe','well','thing','things','people','person','guy','guys','una','dem','abi','abeg','sef','oya','omo','wetin','wey','fit','wan','want','yeah','yep','oh','ah','lol','lmao','im'
])
const unsafeSnippet = /(?:https?:\/\/|www\.|\+?\d[\d\s().-]{7,}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:nude|nudes|sex|porn|suicide|kill yourself|rape)\b)/i

function safeSnippet(text: string) {
  const normalized = normalizeExportText(readMedia(text)?.caption ?? text).replace(/\s+/g, ' ').trim()
  if (normalized.length < 4 || unsafeSnippet.test(normalized) || isExportPlaceholder(normalized)) return undefined
  return normalized.length > 150 ? `${normalized.slice(0, 147).trim()}…` : normalized
}

// Replies are often just "😂", so short is fine here. Unsafe content still is not quoted.
function replySnippet(text: string) {
  const normalized = normalizeExportText(readMedia(text)?.caption ?? text).replace(/\s+/g, ' ').trim()
  if (!normalized || unsafeSnippet.test(normalized) || isExportPlaceholder(normalized)) return undefined
  const characters = [...normalized]
  return characters.length > 60 ? `${characters.slice(0, 57).join('').trim()}…` : normalized
}

type Progress = { percent: number; processed: number; total: number; label: string }
let report: (progress: Progress) => void = () => {}

function fail(code: string, message: string): never { throw new Error(`${code}: ${message}`) }

function decodeText(bytes: Uint8Array) {
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8'
  return new TextDecoder(encoding).decode(bytes)
}

const headerCount = (text: string) => text.split('\n', 200).filter((line) => readHeader(normalizeExportText(line))).length

async function extractText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!/\.zip$/i.test(file.name)) return decodeText(bytes)
  // Only inflate text files; media can be hundreds of megabytes.
  const entries = Object.entries(unzipSync(bytes, { filter: (entry) => /\.txt$/i.test(entry.name) && !entry.name.startsWith('__MACOSX') }))
  if (!entries.length) fail('P-104', 'This zip does not contain a .txt export. Export the chat again and choose Without media.')
  // A shared .txt attachment can sit beside the chat, so pick the file that reads most like one.
  const candidates = entries.map(([name, content]) => { const text = decodeText(content); return { text, score: headerCount(text) + (/(?:^|\/)_chat\.txt$|whatsapp chat/i.test(name) ? 1000 : 0), size: content.length } })
  return candidates.sort((a, b) => b.score - a.score || b.size - a.size)[0].text
}

const DATE = String.raw`(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2}))`
const TIME = String.raw`(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[ap]\.?\s?m\.?)?)`
const iosHeader = new RegExp(String.raw`^\[${DATE},?\s+${TIME}\]\s*(.*)$`, 'i')
const androidHeader = new RegExp(String.raw`^${DATE},?\s+${TIME}\s+[-–]\s+(.*)$`, 'i')

function readHeader(line: string) {
  const ios = line.match(iosHeader)
  const match = ios ?? line.match(androidHeader)
  return match ? { format: ios ? 'ios' as const : 'android' as const, date: match[1], time: match[2], rest: match[3] } : undefined
}

type DateOrder = 'dmy' | 'mdy' | 'ymd'

function dateParts(dateText: string, order: DateOrder) {
  const [a, b, c] = dateText.split(/[./-]/).map(Number)
  if (/^\d{4}/.test(dateText)) return { year: a, month: b, day: c }
  const year = c < 100 ? 2000 + c : c
  return order === 'mdy' ? { year, month: a, day: b } : { year, month: b, day: a }
}

function detectDateOrder(dates: string[]): DateOrder {
  if (dates.length && /^\d{4}/.test(dates[0])) return 'ymd'
  for (const date of dates) {
    const [first, second] = date.split(/[./-]/).map(Number)
    if (first > 12 && second <= 12) return 'dmy'
    if (second > 12 && first <= 12) return 'mdy'
  }
  // Every date is ambiguous. Exports are chronological, so prefer the reading
  // that goes backwards least often and covers the shorter span.
  const rate = (order: DateOrder) => {
    let backwards = 0, previous = 0, min = Infinity, max = -Infinity
    for (const date of dates) {
      const { year, month, day } = dateParts(date, order)
      const stamp = Date.UTC(year, month - 1, day)
      if (stamp < previous) backwards++
      previous = stamp; min = Math.min(min, stamp); max = Math.max(max, stamp)
    }
    return { backwards, span: max - min }
  }
  const dmy = rate('dmy'), mdy = rate('mdy')
  return mdy.backwards < dmy.backwards || (mdy.backwards === dmy.backwards && mdy.span < dmy.span) ? 'mdy' : 'dmy'
}

function parseTimestamp(dateText: string, timeText: string, order: DateOrder) {
  const { year, month, day } = dateParts(dateText, order)
  const parts = timeText.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(?:([ap])\.?\s?m\.?)?/i)
  if (!parts) return null
  let hour = Number(parts[1])
  const minute = Number(parts[2])
  const second = Number(parts[3] ?? 0)
  const meridiem = parts[4]?.toLowerCase()
  if (meridiem === 'p' && hour < 12) hour += 12
  if (meridiem === 'a' && hour === 12) hour = 0
  if (hour > 23 || minute > 59 || second > 59) return null
  const date = new Date(year, month - 1, day, hour, minute, second)
  // Date() rolls 31 February into March, so check it kept what we asked for.
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

// The calendar day where the chat happened. toISOString() would shift it to UTC.
const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function parseLines(text: string) {
  const lines = text.replace(/\r/g, '').split('\n')
  const headers = lines.map((line) => readHeader(normalizeExportText(line)))
  const dateOrder = detectDateOrder(headers.flatMap((header) => header ? [header.date] : []))
  const messages: ParsedMessage[] = []
  const calls: NonNullable<ReturnType<typeof readCall>>[] = []
  let unknown = 0
  let acceptingContinuation = false
  let format: 'android' | 'ios' | 'unknown' = 'unknown'
  let clock: '12h' | '24h' = '24h'
  for (let index = 0; index < lines.length; index++) {
    // WhatsApp prefixes many exported lines (especially media placeholders)
    // with invisible direction marks. Strip them before matching the timestamp.
    const line = normalizeExportText(lines[index])
    const header = headers[index]
    if (header) {
      format = header.format
      if (/[ap]\.?\s?m/i.test(header.time)) clock = '12h'
      // A timestamped line without "sender: " is a system event, never part of the message above.
      const body = header.rest.match(/^([^:]+):(?:\s(.*))?$/)
      const date = parseTimestamp(header.date, header.time, dateOrder)
      const sender = body ? normalizeMemberName(body[1]) : ''
      const rawText = body?.[2] ?? ''
      const system = !body || systemSender.test(sender) || (/^\u200e?\[[^\]]+\][^:]*:\s*\u200e/.test(lines[index]) && iosSystemBody.test(rawText) && !readMedia(rawText))
      const call = date && !system ? readCall(normalizeExportText(rawText)) : undefined
      if (!date || system || !isDisplayableMemberName(sender)) { unknown++; acceptingContinuation = false }
      // A call is something that happened, not something typed.
      else if (call) { calls.push(call); acceptingContinuation = false }
      else {
        messages.push({ ts: date.getTime(), sender, text: rawText, hour: date.getHours(), dateKey: localDay(date) })
        acceptingContinuation = true
      }
    } else if (acceptingContinuation && messages.length && line.trim()) messages[messages.length - 1].text += `\n${line}`
    else if (line.trim()) unknown++
    if (index % 3000 === 0) report({ percent: 12 + Math.round(index / Math.max(1, lines.length) * 58), processed: index, total: lines.length, label: 'Reading messages' })
  }
  return { messages, calls, diagnostics: { format, clock, dateOrder, unknownPct: Math.round(unknown / Math.max(1, lines.length) * 1000) / 10, capped: false, mediaPct: 0, languageHint: 'unknown' } }
}

function aggregate(parsed: ReturnType<typeof parseLines>, includeAiChunks = false): AggregateChat {
  const { messages, calls, diagnostics } = parsed
  if (messages.length < 10) fail('P-102', `Only ${messages.length} messages were readable. This export is too short to build an honest story.`)
  report({ percent: 72, processed: 0, total: messages.length, label: 'Counting chat patterns' })
  const memberMap = new Map<string, Member & { replyTotal: number; lastTs: number }>()
  const days = new Map<string, number>()
  const mediaDays = new Map<string, number>()
  const words = new Map<string, number>()
  const wordsByDay = new Map<string, Map<string, number>>()
  const emojiCounts = new Map<string, number>()
  const sessions: { date: string; count: number; start: number; end: number }[] = []
  let currentSession: { date: string; count: number; start: number; end: number } | undefined
  let wordCount = 0, emojis = 0, mediaOmitted = 0
  const exchanges = new Map<string, Map<string, number>>()
  messages.forEach((message, index) => {
    if (index % 3000 === 0) report({ percent: 72 + Math.round(index / Math.max(1, messages.length) * 18), processed: index, total: messages.length, label: 'Counting chat patterns' })
    const id = `m_${Array.from(memberMap.keys()).indexOf(message.sender) + 1 || memberMap.size + 1}`
    const member = memberMap.get(message.sender) ?? { id, name: message.sender, messages: 0, sharePct: 0, avgReplyMins: 0, longestSilenceHrs: 0, starts: 0, laughs: 0, sorrys: 0, nightMessages: 0, mediaCount: 0, words: 0, avgMessageWords: 0, longestMessageWords: 0, repliesReceived: 0, replyCount: 0, continuations: 0, linkCount: 0, voiceNotes: 0, moneyMentions: 0, locationQuestions: 0, explanationCount: 0, replyTotal: 0, lastTs: message.ts }
    member.messages++
    // One laughing message is one laugh, however many emojis are in it.
    if (isLaugh(message.text)) member.laughs++
    member.sorrys += (message.text.match(/\b(sorry|my bad)\b/gi) ?? []).length
    if (message.hour < 5) member.nightMessages++
    const media = readMedia(message.text)
    // For media, only the caption (if any) is something the person typed.
    const messageText = media ? media.caption : normalizeExportText(message.text).replace(/\s*<this message was edited>$/i, '')
    const isPlaceholder = isExportPlaceholder(messageText)
    if (media) {
      member.mediaCount++; mediaOmitted++
      mediaDays.set(message.dateKey, (mediaDays.get(message.dateKey) ?? 0) + 1)
      if (media.voice) member.voiceNotes = (member.voiceNotes ?? 0) + 1
      if (media.sticker) member.stickers = (member.stickers ?? 0) + 1
    }
    member.linkCount = (member.linkCount ?? 0) + (messageText.match(/https?:\/\/|www\./gi) ?? []).length
    member.moneyMentions = (member.moneyMentions ?? 0) + (messageText.match(/\b(money|cash|price|cost|pay|paid|payment|debt|budget|naira)\b|[₦$£€]\s?\d/gi) ?? []).length
    member.locationQuestions = (member.locationQuestions ?? 0) + (messageText.match(/\b(where (are|is|you)|where you dey|location|send (your )?location|how far)\b/gi) ?? []).length
    if ((messageText.match(/[\p{L}']+/gu) ?? []).length >= 35) member.explanationCount = (member.explanationCount ?? 0) + 1
    member.longestSilenceHrs = Math.max(member.longestSilenceHrs, Math.round((message.ts - member.lastTs) / 3600000))
    member.lastTs = message.ts
    const previous = messages[index - 1]
    if (!previous || message.ts - previous.ts >= 6 * 3600000) member.starts++
    if (!currentSession || !previous || message.ts - previous.ts >= 6 * 3600000) {
      currentSession = { date: message.dateKey, count: 1, start: message.ts, end: message.ts }
      sessions.push(currentSession)
    } else {
      currentSession.count++
      currentSession.end = message.ts
    }
    if (previous && previous.sender !== message.sender) {
      const gap = Math.min(360, Math.max(0, (message.ts - previous.ts) / 60000))
      member.replyTotal += gap; member.replyCount = (member.replyCount ?? 0) + 1
      const previousMember = memberMap.get(previous.sender)
      if (previousMember) previousMember.repliesReceived = (previousMember.repliesReceived ?? 0) + 1
    } else if (previous && previous.sender === message.sender && message.ts - previous.ts < 15 * 60000) {
      member.continuations = (member.continuations ?? 0) + 1
    }
    memberMap.set(message.sender, member)
    if (previous && previous.sender !== message.sender && message.ts - previous.ts < 6 * 3600000) {
      for (const [from, to] of [[message.sender, previous.sender], [previous.sender, message.sender]]) {
        const partners = exchanges.get(from) ?? new Map<string, number>()
        partners.set(to, (partners.get(to) ?? 0) + 1)
        exchanges.set(from, partners)
      }
    }
    days.set(message.dateKey, (days.get(message.dateKey) ?? 0) + 1)
    const messageEmojis = messageText.match(emojiPattern) ?? []
    emojis += messageEmojis.length
    messageEmojis.forEach((emoji) => emojiCounts.set(emoji, (emojiCounts.get(emoji) ?? 0) + 1))
    const messageWords = (isPlaceholder ? '' : messageText).toLowerCase().match(/[\p{L}']+/gu) ?? []
    member.words = (member.words ?? 0) + messageWords.length
    member.longestMessageWords = Math.max(member.longestMessageWords ?? 0, messageWords.length)
    wordCount += messageWords.length
    for (const word of messageWords.filter((word) => word.length >= 3)) {
      if (!stopWords.has(word) && !vocabularyArtifactWords.has(word) && !systemWords.has(word)) {
        words.set(word, (words.get(word) ?? 0) + 1)
        const dayWords = wordsByDay.get(message.dateKey) ?? new Map<string, number>()
        dayWords.set(word, (dayWords.get(word) ?? 0) + 1)
        wordsByDay.set(message.dateKey, dayWords)
      }
    }
  })
  const sampledText = messages.slice(0, 2000).map((message) => message.text).join(' ')
  const letters = sampledText.match(/\p{L}/gu)?.length ?? 0
  const latinLetters = sampledText.match(/\p{Script=Latin}/gu)?.length ?? 0
  diagnostics.mediaPct = Math.round(mediaOmitted / Math.max(1, messages.length) * 1000) / 10
  diagnostics.languageHint = letters === 0 ? 'unknown' : latinLetters / letters > .8 ? 'latin' : latinLetters / letters < .4 ? 'mostly-non-latin' : 'mixed'
  const members = Array.from(memberMap.values()).map(({ replyTotal, lastTs: _lastTs, ...member }) => ({ ...member, sharePct: Math.round(member.messages / messages.length * 1000) / 10, avgReplyMins: Math.round(replyTotal / Math.max(1, member.replyCount ?? 0) * 10) / 10, avgMessageWords: Math.round((member.words ?? 0) / Math.max(1, member.messages) * 10) / 10 }))
  for (const member of members) {
    const best = [...(exchanges.get(member.name)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]
    if (best) { member.topPartnerId = memberMap.get(best[0])?.id; member.topPartnerReplies = best[1] }
  }
  const busiest = [...days.entries()].sort((a, b) => b[1] - a[1])[0]
  const memberNameWords = new Set(Array.from(memberMap.keys()).flatMap((name) => normalizeExportText(name).toLowerCase().match(/[\p{L}']{3,}/gu) ?? []))
  const topWords = [...words.entries()].filter(([word]) => !memberNameWords.has(word)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => ({ word, count }))
  const topEmojis = [...emojiCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emoji, count]) => ({ emoji, count }))
  const longest = [...sessions].sort((a, b) => b.count - a.count)[0]
  const mediaPeak = [...mediaDays.entries()].sort((a, b) => b[1] - a[1])[0]
  const redactKnownNames = createNameRedactor([...memberMap.keys()])
  const aliasLetters = (index: number) => { let value = '', number = index + 1; while (number > 0) { number--; value = String.fromCharCode(65 + number % 26) + value; number = Math.floor(number / 26) } return value }
  const speakerAliases = new Map([...memberMap.keys()].map((name, index) => [name, `Person ${aliasLetters(index)}`]))
  // `period` is a day (YYYY-MM-DD) or a whole month (YYYY-MM).
  const wordsIn = (period: string) => {
    if (period.length > 7) return wordsByDay.get(period) ?? new Map<string, number>()
    const totals = new Map<string, number>()
    for (const [day, counts] of wordsByDay) if (day.startsWith(period)) for (const [word, count] of counts) totals.set(word, (totals.get(word) ?? 0) + count)
    return totals
  }
  const topicTerms = (period: string) => [...wordsIn(period).entries()].filter(([word]) => !memberNameWords.has(word)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([word]) => word)
  const topicSummary = (date: string, terms: string[]) => {
    const dayMessages = messages.filter((message) => message.dateKey.startsWith(date))
    const candidates = dayMessages.map((message, index) => {
      const snippet = safeSnippet(message.text)
      const normalized = normalizeExportText(message.text).toLocaleLowerCase()
      const matches = terms.reduce((count, term) => count + (normalized.includes(term) ? 1 : 0), 0)
      return { index, snippet, matches }
    }).filter((candidate): candidate is { index: number; snippet: string; matches: number } => Boolean(candidate.snippet)).sort((a, b) => b.matches - a.matches || b.snippet.length - a.snippet.length)
    const lead = candidates[0]
    if (!lead) return { summary: 'There was not enough safe readable text to explain this moment.', excerpt: undefined }
    // One window of a busy day says little, so read from the start, middle, end and the busiest talking point.
    const last = Math.max(0, dayMessages.length - 20)
    const starts = [0, Math.round(last / 3), Math.round(last * 2 / 3), last, Math.max(0, lead.index - 4)]
    const picked = [...new Set(starts.flatMap((start) => Array.from({ length: 20 }, (_, offset) => start + offset)))].filter((index) => index < dayMessages.length).sort((a, b) => a - b)
    const lines = picked.flatMap((index) => {
      const snippet = safeSnippet(dayMessages[index].text)
      return snippet ? [`${speakerAliases.get(dayMessages[index].sender) ?? 'Someone'}: ${redactKnownNames(snippet)}`] : []
    })
    // Too long: thin evenly instead of cutting off the end of the day.
    const every = Math.max(1, Math.ceil(lines.join('\n').length / 6000))
    const excerpt = lines.filter((_, index) => index % every === 0).join('\n').slice(0, 6000)
    return {
      summary: 'This moment needs the AI context pass before it can be described honestly.',
      excerpt: excerpt || undefined
    }
  }
  const hours = Array.from({ length: 24 }, () => 0)
  for (const message of messages) hours[message.hour]++
  const rhythm = buildRhythm(days, hours, totalCalls(calls))
  const peakByMonth = new Map<string, [string, number]>()
  for (const entry of days.entries()) {
    const month = entry[0].slice(0, 7)
    if (!peakByMonth.has(month) || entry[1] > peakByMonth.get(month)![1]) peakByMonth.set(month, entry)
  }
  const monthPeaks = [...peakByMonth.values()].sort((a, b) => a[0].localeCompare(b[0]))
  const sampleCount = Math.min(12, monthPeaks.length)
  const sampledMonths = Array.from({ length: sampleCount }, (_, index) => monthPeaks[Math.round(index * Math.max(0, monthPeaks.length - 1) / Math.max(1, sampleCount - 1))]?.[0]).filter((date): date is string => Boolean(date))
  const topicDates = [...new Set([busiest?.[0], longest?.date, mediaPeak?.[0], ...sampledMonths].filter((date): date is string => Boolean(date)))].slice(0, 15)
  const peakMonth = rhythm.months.length >= 2 ? [...rhythm.months].sort((a, b) => b.count - a.count)[0].month : undefined
  const topicMoments = [...(peakMonth ? [peakMonth] : []), ...topicDates].map((date) => { const terms = topicTerms(date); return { date, terms, ...topicSummary(date, terms) } }).filter((moment) => moment.terms.length && moment.excerpt)
  const aiChunks: { id: string; text: string }[] = []
  if (includeAiChunks) {
    const redactPii = (text: string) => text
      .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
      .replace(/\+?\d[\d\s().-]{7,}/g, '[phone]')
    const unsafeContent = /\b(?:nude|nudes|porn|suicide|kill yourself|rape)\b/i
    let chunk = '', chunkIndex = 0, currentDate = ''
    const flush = () => { if (chunk.trim()) aiChunks.push({ id: `chunk_${chunkIndex++}`, text: chunk.trim() }); chunk = ''; currentDate = '' }
    for (const message of messages) {
      if (isExportPlaceholder(message.text) || unsafeContent.test(message.text)) continue
      const typed = readMedia(message.text)?.caption ?? message.text
      const safeText = redactPii(redactKnownNames(normalizeExportText(typed))).replace(/\s+/g, ' ').trim().slice(0, 4000)
      if (!safeText) continue
      const line = `${message.dateKey === currentDate ? '' : `[${message.dateKey}]\n`}${speakerAliases.get(message.sender) ?? 'Someone'}: ${safeText}\n`
      if (chunk.length + line.length > 160000) flush()
      if (message.dateKey !== currentDate) { chunk += `[${message.dateKey}]\n`; currentDate = message.dateKey }
      chunk += `${speakerAliases.get(message.sender) ?? 'Someone'}: ${safeText}\n`
    }
    flush()
    // Counts always use every message. Only what AI reads is sampled, evenly across the period.
    if (aiChunks.length > MAX_AI_CHUNKS) {
      const sampled = Array.from({ length: MAX_AI_CHUNKS }, (_, index) => aiChunks[Math.round(index * (aiChunks.length - 1) / (MAX_AI_CHUNKS - 1))])
      aiChunks.splice(0, aiChunks.length, ...sampled)
    }
  }
  // The export does not say what a laugh replied to. Credit each one to the closest earlier
  // message from someone else, a few minutes back at most, and to nothing else.
  const laughedAt = new Map<number, { people: Set<string>; replies: number; from: ParsedMessage[] }>()
  messages.forEach((reply, index) => {
    if (!isLaugh(reply.text)) return
    // Walk past other people's reactions, so a pile-on still reaches the message that caused it.
    for (let back = index - 1; back >= Math.max(0, index - 40); back--) {
      const target = messages[back]
      if (reply.ts - target.ts > 3 * 60000) return
      if (target.sender === reply.sender || isReaction(target.text)) continue
      const entry = laughedAt.get(back) ?? { people: new Set<string>(), replies: 0, from: [] }
      // One quoted reply per person.
      if (!entry.people.has(reply.sender)) entry.from.push(reply)
      entry.people.add(reply.sender); entry.replies++
      laughedAt.set(back, entry)
      return
    }
  })
  let laughMoment: AggregateChat['laughMoment']
  let laughScore = 0
  for (const [index, { people, replies, from }] of laughedAt) {
    // If that closest message was a photo or unsafe to quote, there is no moment to show.
    const snippet = safeSnippet(messages[index].text)
    const score = people.size * 100 + replies
    if (!snippet || people.size < 2 || score <= laughScore) continue
    laughScore = score
    laughMoment = { text: snippet, memberId: memberMap.get(messages[index].sender)?.id ?? '', responses: replies, responders: people.size, date: messages[index].dateKey, replies: from.flatMap((reply) => {
      const text = replySnippet(reply.text)
      return text ? [{ memberId: memberMap.get(reply.sender)?.id ?? '', text }] : []
    }).slice(0, 3) }
  }
  const first = new Date(messages[0].ts), last = new Date(messages.at(-1)!.ts)
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  report({ percent: 92, processed: messages.length, total: messages.length, label: 'Finishing chat totals' })
  return {
    chatType: members.length > 2 ? 'group' : 'dm', chatName: members.length > 2 ? 'Your group chat' : 'Your chat',
    range: { start: dateFormat.format(first), end: dateFormat.format(last) },
    totals: { messages: messages.length, words: wordCount, activeDays: days.size, emojis, busiestDay: { date: busiest?.[0] ?? '', count: busiest?.[1] ?? 0 } },
    rhythm, members, topWords, topEmojis, topicMoments, laughMoment, aiChunks: includeAiChunks ? aiChunks : undefined,
    longestConversation: longest ? { date: longest.date, count: longest.count, durationMins: Math.max(1, Math.round((longest.end - longest.start) / 60000)) } : undefined,
    mediaPeak: mediaPeak ? { date: mediaPeak[0], count: mediaPeak[1] } : undefined,
    sourceKind: 'upload', thinStats: messages.length < 200 || diagnostics.mediaPct > 70,
    verdict: deriveVerdict(members, messages.length)
  }
}

export async function parseChat(file: File, options: { includeAiChunks?: boolean; onProgress?: (progress: Progress) => void } = {}) {
  report = options.onProgress ?? (() => {})
  report({ percent: 4, processed: 0, total: 0, label: 'Opening export' })
  const text = await extractText(file)
  report({ percent: 10, processed: 0, total: 0, label: 'Export opened' })
  const parsed = parseLines(text)
  return { result: aggregate(parsed, options.includeAiChunks), diagnostics: parsed.diagnostics }
}
