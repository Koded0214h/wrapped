import { isPendingContext } from './fairness'
import type { Fact } from './types'

const topicFor: Record<string, string> = { busiest_day: 'busiest_day_topic', longest_conversation: 'longest_conversation_topic', media_peak: 'media_peak_topic', month_series: 'month_peak_topic' }

/** What a moment was about: what AI said, or without AI, the words that kept coming up then. */
export function contextOf(fact?: Fact) {
  if (!fact) return undefined
  if (!isPendingContext(fact.value)) return String(fact.value)
  return fact.terms && fact.terms.length >= 2 ? `Kept coming up: ${fact.terms.slice(0, 3).join(', ')}` : undefined
}

/** What was being talked about at the moment a fact measures, when anything can be said. */
export function topicOf(factId: string | undefined, facts: Fact[]) {
  return contextOf(facts.find((fact) => fact.id === topicFor[factId ?? '']))
}
