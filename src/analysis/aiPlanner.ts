import type { AnalysisResult, Card, Fact } from './types'
import { getPurchaseId } from '../lib/purchaseId'
import { factsForUpload } from './factPrivacy'

const MAX_FINDING_CARDS = 5

export function addFindings(deck: Card[], planned: Card[], facts: Fact[]) {
  const findings = new Set(facts.filter((fact) => fact.id.startsWith('semantic_') || fact.kind === 'topic_context').map((fact) => fact.id))
  const extras = planned.filter((card) => card.layout !== 'verdict' && card.factIds.some((id) => findings.has(id))).slice(0, MAX_FINDING_CARDS).map((card) => ({ ...card, locked: false }))
  const finale = deck.findIndex((card) => card.layout === 'movieFinale' || card.layout === 'verdict')
  const at = finale < 0 ? deck.length : finale
  return [...deck.slice(0, at), ...extras, ...deck.slice(at)]
}

export async function planAnalysisWithAi(analysis: AnalysisResult, options: { signal?: AbortSignal } = {}): Promise<AnalysisResult> {
  const aiMode = analysis.aiMode ?? 'facts-only'
  const requestFacts = factsForUpload(analysis.facts, aiMode)
  // Give up eventually. A timeout is not a cancel, so callers fall back to the local deck.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('A-508: AI planning took too long.', 'TimeoutError')), 5 * 60000)
  const cancel = () => controller.abort(new DOMException('Cancelled', 'AbortError'))
  options.signal?.addEventListener('abort', cancel, { once: true })
  if (options.signal?.aborted) cancel()
  const response = await fetch('/api/cards/plan', {
    method: 'POST',
    signal: controller.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ facts: requestFacts, chatChunks: aiMode === 'with-quotes' ? analysis.aiChunks : undefined, sessionId: getPurchaseId(), aiMode })
  }).finally(() => { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel) })
  const result = await response.json() as { cards?: Card[]; contextUpdates?: { id: string; value: string }[]; semanticFacts?: Fact[]; fallback?: boolean; error?: string }
  if (!response.ok) throw new Error(String(result.error || 'A-503: AI card planning failed.'))
  const updates = new Map((result.contextUpdates ?? []).map((item) => [item.id, item.value]))
  const facts = [
    ...analysis.facts.map((fact) => { const { sourceExcerpt: _sourceExcerpt, ...safeFact } = fact; return updates.has(fact.id) ? { ...safeFact, value: updates.get(fact.id)! } : safeFact }),
    ...(result.semanticFacts ?? []).filter((fact) => fact.id && !analysis.facts.some((existing) => existing.id === fact.id))
  ]
  if (result.fallback || !result.cards?.length) return { ...analysis, aiChunks: undefined, facts, aiAttempted: true }

  // Every chat keeps its own deck. AI adds the cards built on things it found in the messages.
  return { ...analysis, aiChunks: undefined, aiAttempted: true, planner: 'ai', facts, cards: addFindings(analysis.cards, result.cards, facts) }
}
