import type { AnalysisResult, Card, Fact } from './types'
import { getSessionId } from '../lib/telemetry'

export async function planAnalysisWithAi(analysis: AnalysisResult, options: { signal?: AbortSignal } = {}): Promise<AnalysisResult> {
  const aiMode = analysis.aiMode ?? 'facts-only'
  const requestFacts = aiMode === 'with-quotes'
    ? analysis.facts
    : analysis.facts.map((fact) => { const { sourceExcerpt: _sourceExcerpt, ...safeFact } = fact; return safeFact })
  const response = await fetch('/api/cards/plan', {
    method: 'POST',
    signal: options.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ facts: requestFacts, chatChunks: aiMode === 'with-quotes' ? analysis.aiChunks : undefined, sessionId: getSessionId(), aiMode })
  })
  const result = await response.json() as { cards?: Card[]; contextUpdates?: { id: string; value: string }[]; semanticFacts?: Fact[]; fallback?: boolean; error?: string }
  if (!response.ok) throw new Error(String(result.error || 'A-503: AI card planning failed.'))
  const updates = new Map((result.contextUpdates ?? []).map((item) => [item.id, item.value]))
  const facts = [
    ...analysis.facts.map((fact) => { const { sourceExcerpt: _sourceExcerpt, ...safeFact } = fact; return updates.has(fact.id) ? { ...safeFact, value: updates.get(fact.id)! } : safeFact }),
    ...(result.semanticFacts ?? []).filter((fact) => fact.id && !analysis.facts.some((existing) => existing.id === fact.id))
  ]
  if (result.fallback || !result.cards?.length) return { ...analysis, aiChunks: undefined, facts, aiAttempted: true }

  const cover: Card = {
    id: 'cover',
    layout: 'cover',
    factIds: ['chat_label', 'date_range', 'total_messages'].filter((id) => facts.some((fact) => fact.id === id)),
    headline: '{{value:chat_label}}',
    roast: 'AI don read the moments wey you allow. Exact numbers still come from the export.',
    locked: false
  }
  const deterministicVerdict = analysis.cards.find((card) => card.layout === 'verdict' || card.layout === 'finalVerdict')
  const aiVerdict = result.cards.find((card) => card.layout === 'verdict')
  const aiInsights = result.cards.filter((card) => card.layout !== 'verdict').map((card) => ({ ...card, locked: false }))
  return {
    ...analysis,
    aiChunks: undefined,
    aiAttempted: true,
    planner: 'ai',
    facts,
    cards: [
      cover,
      ...aiInsights,
      ...(aiVerdict ? [{ ...aiVerdict, locked: false }] : deterministicVerdict ? [{ ...deterministicVerdict, locked: false }] : [])
    ]
  }
}
