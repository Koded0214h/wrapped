export type ChatType = 'group' | 'dm'

export type Member = {
  id: string
  name: string
  messages: number
  sharePct: number
  avgReplyMins: number
  longestSilenceHrs: number
  starts: number
  laughs: number
  sorrys: number
  nightMessages: number
  mediaCount: number
  words?: number
  avgMessageWords?: number
  longestMessageWords?: number
  repliesReceived?: number
  replyCount?: number
  continuations?: number
  linkCount?: number
  voiceNotes?: number
  stickers?: number
  moneyMentions?: number
  locationQuestions?: number
  explanationCount?: number
  topPartnerId?: string
  topPartnerReplies?: number
}

export type LayoutType = 'bigNumber' | 'leaderboard' | 'versus' | 'quote' | 'timeline' | 'award' | 'wordCloud' | 'heatmap' | 'verdict' | 'cover'
  | 'groupNumbers' | 'yapLeaderboard' | 'characterCast' | 'groupAwards' | 'socialGraph'
  | 'plotTwist' | 'groupLanguage' | 'timeCapsule' | 'companyRoast' | 'dynamicDuo'
  | 'replyRace' | 'nightShift' | 'mediaDesk' | 'ghostWatch' | 'laughTrack' | 'conversationSpark'
  | 'groupPulse' | 'memoryVault' | 'movieFinale' | 'finalVerdict'
  | 'highlights' | 'split' | 'monthly' | 'hourly' | 'quietGap' | 'emojiBoard' | 'calls'

export type FactContext = {
  rank?: number
  outOf?: number
  gap?: number
  average?: number
  ratioToAverage?: number
  sharePct?: number
  activitySharePct?: number
  confidence?: number
  humourScore?: number
  visualScore?: number
  magnitude?: 'close' | 'clear' | 'wild'
}

export type Fact = {
  id: string
  kind: string
  memberIds: string[]
  value: number | string
  detail?: string
  surpriseScore: number
  context?: FactContext
  sourceExcerpt?: string
  series?: { label: string; value: number }[]
  /** Real messages. Like the quoted message, these never leave the device. */
  replies?: LaughReply[]
}

export type LaughReply = { memberId: string; text: string }

export type Card = {
  id: string
  layout: LayoutType
  factIds: string[]
  headline: string
  roast: string
  savageRoast?: string
  locked: boolean
}

export type CallStats = { voice: number; video: number; missed: number; minutes: number }

export type Rhythm = {
  months: { month: string; count: number }[]
  hours: number[]
  weekdays: number[]
  longestStreak: number
  quietGap?: { days: number; from: string; to: string }
  calls?: CallStats
}

export type AnalysisResult = {
  schemaVersion?: number
  aiMode?: 'facts-only' | 'with-quotes'
  aiAttempted?: boolean
  aiChunks?: { id: string; text: string }[]
  chatType: ChatType
  chatName: string
  range: { start: string; end: string }
  totals: {
    messages: number
    words: number
    activeDays: number
    emojis: number
    busiestDay: { date: string; count: number }
  }
  members: Member[]
  facts: Fact[]
  cards: Card[]
  planner?: 'deterministic' | 'ai'
}

export type AggregateChat = Omit<AnalysisResult, 'facts' | 'cards'> & {
  nightOwl?: { peakHour: number; topMemberId: string; nightMessageCount: number }
  naija?: { abeg: number; wahala: number; omo: number; nawa: number; sha: number }
  topWords?: { word: string; count: number }[]
  topEmojis?: { emoji: string; count: number }[]
  longestConversation?: { date: string; count: number; durationMins: number }
  mediaPeak?: { date: string; count: number }
  topicMoments?: { date: string; terms: string[]; summary: string; excerpt?: string }[]
  laughMoment?: { text: string; memberId: string; responses: number; responders: number; date: string; replies?: LaughReply[] }
  verdict?: { title: string; blurb: string }
  sourceKind?: 'friends' | 'study' | 'couple' | 'upload'
  thinStats?: boolean
  rhythm?: Rhythm
}
