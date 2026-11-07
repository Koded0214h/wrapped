/// <reference lib="webworker" />
import { strFromU8, unzipSync } from 'fflate'
import type { AggregateChat, Member } from './types'
import { isExportPlaceholder, isMediaPlaceholder, normalizeExportText, vocabularyArtifactWords } from './textArtifacts'
import { deriveVerdict } from './deriveVerdict'
import { isDisplayableMemberName, normalizeMemberName } from './memberNames'

type ParsedMessage = { ts: number; sender: string; text: string; hour: number; dateKey: string }
type Request = { file: File; includeAiChunks?: boolean }

const systemLine = /joined|left|added|removed|security code|messages and calls are end-to-end encrypted|changed the subject|created group/i
const systemMessage = /messages and calls are end-to-end encrypted|security code changed|created (?:this )?group|changed the (?:group )?(?:subject|description|icon)|turned on disappearing messages|turned off disappearing messages/i
const laughPattern = /😂|🤣|\blol\b|\blmao\b|ha{2,}|he{2,}/gi
const emojiPattern = /\p{Extended_Pictographic}/gu
const stopWords = new Set([
  'the','and','that','this','with','have','you','for','but','not','are','was','just','your','from','they','will','what','when','then','there','about','been','can','all','our','she','him','her','its','too','yes','okay','ok','like',
  'dey','don','sha','make','one','na','no','get','got','come','know','say','still','even','also','really','maybe','well','thing','things','people','person','guy','guys','una','dem','abi','abeg','sef','oya','omo','wetin','wey','fit','wan','want','yeah','yep','oh','ah','lol','lmao','im'
])
const unsafeSnippet = /(?:https?:\/\/|www\.|\+?\d[\d\s().-]{7,}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:nude|nudes|sex|porn|suicide|kill yourself|rape)\b)/i

function safeSnippet(text: string) {
  const normalized = normalizeExportText(text).replace(/\s+/g, ' ').trim()
  if (normalized.length < 4 || unsafeSnippet.test(normalized) || isExportPlaceholder(normalized)) return undefined
  return normalized.length > 150 ? `${normalized.slice(0, 147).trim()}…` : normalized
}

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
  const parts = normalized.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i)
  if (!parts) return null
  let hour = Number(parts[1])
  const minute = Number(parts[2])
  const second = Number(parts[3] ?? 0)
  if (parts[4]?.toUpperCase() === 'PM' && hour < 12) hour += 12
  if (parts[4]?.toUpperCase() === 'AM' && hour === 12) hour = 0
  const date = new Date(year, month, day, hour, minute, second)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseLines(text: string) {
  const lines = text.replace(/\r/g, '').split('\n')
  const dateOrder = detectDateOrder(lines)
  const messages: ParsedMessage[] = []
  let unknown = 0
  let acceptingContinuation = false
  let format: 'android' | 'ios' | 'unknown' = 'unknown'
  let clock: '12h' | '24h' = '24h'
  for (let index = 0; index < lines.length; index++) {
    // WhatsApp prefixes many exported lines (especially media placeholders)
    // with invisible direction marks. Strip them before matching the timestamp.
    const line = normalizeExportText(lines[index])
    const ios = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*([^\]]+)\]\s*([^:]+):\s?(.*)$/)
    const android = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(.+?)\s+-\s+([^:]+):\s?(.*)$/)
    const match = ios ?? android
    if (match) {
      format = ios ? 'ios' : 'android'
      if (/AM|PM/i.test(match[2])) clock = '12h'
      const date = parseTimestamp(match[1], match[2], dateOrder)
      const sender = normalizeMemberName(match[3])
      if (!date || systemLine.test(sender) || systemMessage.test(match[4]) || !isDisplayableMemberName(sender)) { unknown++; acceptingContinuation = false; continue }
      messages.push({ ts: date.getTime(), sender, text: match[4], hour: date.getHours(), dateKey: date.toISOString().slice(0, 10) })
      acceptingContinuation = true
    } else if (acceptingContinuation && messages.length && line.trim()) messages[messages.length - 1].text += `\n${line}`
    else if (line.trim()) unknown++
    if (index % 3000 === 0) postMessage({ type: 'progress', progress: { percent: 12 + Math.round(index / Math.max(1, lines.length) * 58), processed: index, total: lines.length, label: 'Reading messages' } })
  }
  return { messages, diagnostics: { format, clock, dateOrder, unknownPct: Math.round(unknown / Math.max(1, lines.length) * 1000) / 10, capped: false, mediaPct: 0, languageHint: 'unknown' } }
}

function aggregate(parsed: ReturnType<typeof parseLines>, includeAiChunks = false): AggregateChat {
  const { messages, diagnostics } = parsed
  if (messages.length < 10) fail('P-102', `Only ${messages.length} messages were readable. This export is too short to build an honest story.`)
  postMessage({ type: 'progress', progress: { percent: 72, processed: 0, total: messages.length, label: 'Counting chat patterns' } })
  const memberMap = new Map<string, Member & { replyTotal: number; lastTs: number }>()
  const days = new Map<string, number>()
  const mediaDays = new Map<string, number>()
  const words = new Map<string, number>()
  const wordsByDay = new Map<string, Map<string, number>>()
  const emojiCounts = new Map<string, number>()
  const sessions: { date: string; count: number; start: number; end: number }[] = []
  let currentSession: { date: string; count: number; start: number; end: number } | undefined
  let wordCount = 0, emojis = 0, mediaOmitted = 0
  messages.forEach((message, index) => {
    if (index % 3000 === 0) postMessage({ type: 'progress', progress: { percent: 72 + Math.round(index / Math.max(1, messages.length) * 18), processed: index, total: messages.length, label: 'Counting chat patterns' } })
    const id = `m_${Array.from(memberMap.keys()).indexOf(message.sender) + 1 || memberMap.size + 1}`
    const member = memberMap.get(message.sender) ?? { id, name: message.sender, messages: 0, sharePct: 0, avgReplyMins: 0, longestSilenceHrs: 0, starts: 0, laughs: 0, sorrys: 0, nightMessages: 0, mediaCount: 0, words: 0, avgMessageWords: 0, longestMessageWords: 0, repliesReceived: 0, replyCount: 0, continuations: 0, linkCount: 0, voiceNotes: 0, moneyMentions: 0, locationQuestions: 0, explanationCount: 0, replyTotal: 0, lastTs: message.ts }
    member.messages++
    member.laughs += (message.text.match(laughPattern) ?? []).length
    member.sorrys += (message.text.match(/\b(sorry|my bad)\b/gi) ?? []).length
    if (message.hour < 5) member.nightMessages++
    const messageText = normalizeExportText(message.text)
    const isPlaceholder = isExportPlaceholder(messageText)
    if (isMediaPlaceholder(messageText)) {
      member.mediaCount++; mediaOmitted++
      mediaDays.set(message.dateKey, (mediaDays.get(message.dateKey) ?? 0) + 1)
      if (/audio|voice/i.test(messageText)) member.voiceNotes = (member.voiceNotes ?? 0) + 1
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
    days.set(message.dateKey, (days.get(message.dateKey) ?? 0) + 1)
    const messageEmojis = messageText.match(emojiPattern) ?? []
    emojis += messageEmojis.length
    messageEmojis.forEach((emoji) => emojiCounts.set(emoji, (emojiCounts.get(emoji) ?? 0) + 1))
    const messageWords = (isPlaceholder ? '' : messageText).toLowerCase().match(/[\p{L}']+/gu) ?? []
    member.words = (member.words ?? 0) + messageWords.length
    member.longestMessageWords = Math.max(member.longestMessageWords ?? 0, messageWords.length)
    wordCount += messageWords.length
    for (const word of messageWords.filter((word) => word.length >= 3)) {
      if (!stopWords.has(word) && !vocabularyArtifactWords.has(word) && !systemLine.test(word)) {
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
  const busiest = [...days.entries()].sort((a, b) => b[1] - a[1])[0]
  const memberNameWords = new Set(Array.from(memberMap.keys()).flatMap((name) => normalizeExportText(name).toLowerCase().match(/[\p{L}']{3,}/gu) ?? []))
  const topWords = [...words.entries()].filter(([word]) => !memberNameWords.has(word)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => ({ word, count }))
  const topEmojis = [...emojiCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emoji, count]) => ({ emoji, count }))
  const longest = [...sessions].sort((a, b) => b.count - a.count)[0]
  const mediaPeak = [...mediaDays.entries()].sort((a, b) => b[1] - a[1])[0]
  const knownNames = [...memberMap.keys()].map(normalizeMemberName).filter((name) => name.length >= 3).sort((a, b) => b.length - a.length)
  const redactKnownNames = (text: string) => knownNames.reduce((safe, name) => safe.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'Member'), text)
  const aliasLetters = (index: number) => { let value = '', number = index + 1; while (number > 0) { number--; value = String.fromCharCode(65 + number % 26) + value; number = Math.floor(number / 26) } return value }
  const speakerAliases = new Map([...memberMap.keys()].map((name, index) => [name, `Person ${aliasLetters(index)}`]))
  const topicTerms = (date?: string) => [...(wordsByDay.get(date ?? '')?.entries() ?? [])].filter(([word]) => !memberNameWords.has(word)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([word]) => word)
  const topicSummary = (date: string, terms: string[]) => {
    const dayMessages = messages.filter((message) => message.dateKey === date)
    const candidates = dayMessages.map((message, index) => {
      const snippet = safeSnippet(message.text)
      const normalized = normalizeExportText(message.text).toLocaleLowerCase()
      const matches = terms.reduce((count, term) => count + (normalized.includes(term) ? 1 : 0), 0)
      return { index, snippet, matches }
    }).filter((candidate): candidate is { index: number; snippet: string; matches: number } => Boolean(candidate.snippet)).sort((a, b) => b.matches - a.matches || b.snippet.length - a.snippet.length)
    const lead = candidates[0]
    if (!lead) return { summary: 'There was not enough safe readable text to explain this moment.', excerpt: undefined }
    const windowStart = Math.max(0, lead.index - 4)
    const excerpt = dayMessages.slice(windowStart, windowStart + 18).map((message) => {
      const snippet = safeSnippet(message.text)
      return snippet ? `${speakerAliases.get(message.sender) ?? 'Someone'}: ${redactKnownNames(snippet)}` : undefined
    }).filter(Boolean).join('\n').slice(0, 1600)
    return {
      summary: 'This moment needs the AI context pass before it can be described honestly.',
      excerpt: excerpt || undefined
    }
  }
  const peakByMonth = new Map<string, [string, number]>()
  for (const entry of days.entries()) {
    const month = entry[0].slice(0, 7)
    if (!peakByMonth.has(month) || entry[1] > peakByMonth.get(month)![1]) peakByMonth.set(month, entry)
  }
  const monthPeaks = [...peakByMonth.values()].sort((a, b) => a[0].localeCompare(b[0]))
  const sampleCount = Math.min(12, monthPeaks.length)
  const sampledMonths = Array.from({ length: sampleCount }, (_, index) => monthPeaks[Math.round(index * Math.max(0, monthPeaks.length - 1) / Math.max(1, sampleCount - 1))]?.[0]).filter((date): date is string => Boolean(date))
  const topicDates = [...new Set([busiest?.[0], longest?.date, mediaPeak?.[0], ...sampledMonths].filter((date): date is string => Boolean(date)))].slice(0, 15)
  const topicMoments = topicDates.map((date) => { const terms = topicTerms(date); return { date, terms, ...topicSummary(date, terms) } }).filter((moment) => moment.terms.length && moment.excerpt)
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
      const safeText = redactPii(redactKnownNames(normalizeExportText(message.text))).replace(/\s+/g, ' ').trim().slice(0, 4000)
      if (!safeText) continue
      const line = `${message.dateKey === currentDate ? '' : `[${message.dateKey}]\n`}${speakerAliases.get(message.sender) ?? 'Someone'}: ${safeText}\n`
      if (chunk.length + line.length > 160000) flush()
      if (message.dateKey !== currentDate) { chunk += `[${message.dateKey}]\n`; currentDate = message.dateKey }
      chunk += `${speakerAliases.get(message.sender) ?? 'Someone'}: ${safeText}\n`
    }
    flush()
  }
  let laughMoment: AggregateChat['laughMoment']
  let laughScore = 0
  for (let index = 0; index < messages.length; index++) {
    const snippet = safeSnippet(messages[index].text)
    if (!snippet) continue
    let responses = 0
    const responders = new Set<string>()
    for (let next = index + 1; next < Math.min(messages.length, index + 13); next++) {
      if (messages[next].ts - messages[index].ts > 20 * 60000) break
      if (messages[next].sender === messages[index].sender) continue
      const laughs = (messages[next].text.match(laughPattern) ?? []).length
      if (laughs) { responses += laughs; responders.add(messages[next].sender) }
    }
    const score = responders.size * 5 + responses
    if (responders.size >= 2 && score > laughScore) {
      laughScore = score
      laughMoment = { text: snippet, memberId: memberMap.get(messages[index].sender)?.id ?? '', responses, responders: responders.size, date: messages[index].dateKey }
    }
  }
  const first = new Date(messages[0].ts), last = new Date(messages.at(-1)!.ts)
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  postMessage({ type: 'progress', progress: { percent: 92, processed: messages.length, total: messages.length, label: 'Finishing chat totals' } })
  return {
    chatType: members.length > 2 ? 'group' : 'dm', chatName: members.length > 2 ? 'Your group chat' : 'Your chat',
    range: { start: dateFormat.format(first), end: dateFormat.format(last) },
    totals: { messages: messages.length, words: wordCount, activeDays: days.size, emojis, busiestDay: { date: busiest?.[0] ?? '', count: busiest?.[1] ?? 0 } },
    members, topWords, topEmojis, topicMoments, laughMoment, aiChunks: includeAiChunks ? aiChunks : undefined,
    longestConversation: longest ? { date: longest.date, count: longest.count, durationMins: Math.max(1, Math.round((longest.end - longest.start) / 60000)) } : undefined,
    mediaPeak: mediaPeak ? { date: mediaPeak[0], count: mediaPeak[1] } : undefined,
    sourceKind: 'upload', thinStats: messages.length < 200 || diagnostics.mediaPct > 70,
    verdict: deriveVerdict(members, messages.length)
  }
}

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    postMessage({ type: 'progress', progress: { percent: 4, processed: 0, total: 0, label: 'Opening export' } })
    const text = await extractText(event.data.file)
    postMessage({ type: 'progress', progress: { percent: 10, processed: 0, total: 0, label: 'Export opened' } })
    const parsed = parseLines(text)
    const result = aggregate(parsed, event.data.includeAiChunks)
    postMessage({ type: 'done', result, diagnostics: parsed.diagnostics })
  } catch (error) { postMessage({ type: 'error', message: error instanceof Error ? error.message : 'P-100: The export could not be read.' }) }
}
