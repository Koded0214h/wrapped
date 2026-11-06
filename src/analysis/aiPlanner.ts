import type { AnalysisResult, Card } from './types'
import { getSessionId } from '../lib/telemetry'

export async function planAnalysisWithAi(analysis: AnalysisResult): Promise<AnalysisResult> {
  const response = await fetch('/api/cards/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ facts: analysis.facts, sessionId: getSessionId() })
  })
  const result = await response.json() as { cards?: Card[]; fallback?: boolean; error?: string }
  if (!response.ok) throw new Error(String(result.error || 'A-503: AI card planning failed.'))
  if (result.fallback || !result.cards?.length) return analysis

  const deterministicVerdict = analysis.cards.find((card) => card.layout === 'verdict')
  const aiVerdict = result.cards.find((card) => card.layout === 'verdict')
  const aiInsights = result.cards.filter((card) => card.layout !== 'verdict').map((card) => ({ ...card, locked: false }))
  return {
    ...analysis,
    planner: 'ai',
    cards: [
      ...analysis.cards.slice(0, 2).map((card) => ({ ...card, locked: false })),
      ...aiInsights,
      ...(aiVerdict ? [{ ...aiVerdict, locked: false }] : deterministicVerdict ? [{ ...deterministicVerdict, locked: false }] : [])
    ]
  }
}
