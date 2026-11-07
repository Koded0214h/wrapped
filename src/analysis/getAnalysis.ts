import groupData from '../data/mockGroup.json'
import dmData from '../data/mockDm.json'
import studyData from '../data/mockStudy.json'
import type { AggregateChat, AnalysisResult, ChatType } from './types'
import { computeFacts } from './computeFacts'
import { planCards, validatePlannedCards } from './planCards'
import { parseExport } from './parseExport'
import type { ParserDiagnostics } from './parseExport'
import { ANALYSIS_SCHEMA_VERSION } from './analysisCache'

export type MockChatId = 'friends' | 'study' | 'couple'
export type AnalysisProgress = { percent: number; processed: number; total: number; label: string }
const yieldToScreen = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function asAggregate(raw: unknown, sourceKind: AggregateChat['sourceKind']): AggregateChat {
  return { ...(raw as AggregateChat), sourceKind }
}

export async function getAnalysis(type: ChatType, options: { mock?: MockChatId; file?: File; aiMode?: 'facts-only' | 'with-quotes'; signal?: AbortSignal; onProgress?: (progress: AnalysisProgress) => void; onDiagnostics?: (diagnostics: ParserDiagnostics) => void } = {}): Promise<AnalysisResult> {
  let aggregate: AggregateChat
  if (options.file) aggregate = await parseExport(options.file, { includeAiChunks: options.aiMode === 'with-quotes', signal: options.signal, onProgress: options.onProgress, onDiagnostics: options.onDiagnostics })
  else if (options.mock === 'study') aggregate = asAggregate(studyData, 'study')
  else if (options.mock === 'couple') aggregate = asAggregate(dmData, 'couple')
  else if (options.mock === 'friends') aggregate = asAggregate(groupData, 'friends')
  else throw new Error('U-202: No chat file was received. Please choose the export again.')

  options.onProgress?.({ percent: 94, processed: aggregate.totals.messages, total: aggregate.totals.messages, label: 'Finding the strongest patterns' })
  await yieldToScreen()
  const facts = computeFacts(aggregate)
  options.onProgress?.({ percent: 97, processed: aggregate.totals.messages, total: aggregate.totals.messages, label: 'Building your card story' })
  await yieldToScreen()
  const cards = planCards(facts, { maxCards: aggregate.thinStats ? 6 : 9, chatType: aggregate.chatType })
  options.onProgress?.({ percent: 99, processed: aggregate.totals.messages, total: aggregate.totals.messages, label: 'Checking every card' })
  await yieldToScreen()
  if (!validatePlannedCards(cards, facts, aggregate.members)) throw new Error('K-402: Card plan failed validation')
  return { schemaVersion: ANALYSIS_SCHEMA_VERSION, chatType: aggregate.chatType, chatName: aggregate.chatName, range: aggregate.range, totals: aggregate.totals, members: aggregate.members, facts, cards, planner: 'deterministic', aiChunks: aggregate.aiChunks }
}
