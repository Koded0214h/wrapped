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
  moneyMentions?: number
  locationQuestions?: number
  explanationCount?: number
}

export type LayoutType = 'bigNumber' | 'leaderboard' | 'versus' | 'quote' | 'timeline' | 'award' | 'wordCloud' | 'heatmap' | 'verdict' | 'cover'
  | 'groupNumbers' | 'yapLeaderboard' | 'characterCast' | 'groupAwards' | 'socialGraph'
  | 'plotTwist' | 'groupLanguage' | 'timeCapsule' | 'companyRoast' | 'dynamicDuo'
  | 'replyRace' | 'nightShift' | 'mediaDesk' | 'ghostWatch' | 'laughTrack' | 'conversationSpark'
  | 'groupPulse' | 'memoryVault' | 'movieFinale' | 'finalVerdict'

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
}

export type Card = {
  id: string
  layout: LayoutType
  factIds: string[]
  headline: string
  roast: string
  savageRoast?: string
  locked: boolean
}

export type AnalysisResult = {
  schemaVersion?: number
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
  topicMoments?: { date: string; terms: string[]; summary: string }[]
  laughMoment?: { text: string; memberId: string; responses: number; responders: number; date: string }
  verdict?: { title: string; blurb: string }
  sourceKind?: 'friends' | 'study' | 'couple' | 'upload'
  thinStats?: boolean
}
