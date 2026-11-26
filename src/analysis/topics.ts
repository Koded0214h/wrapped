import { isPendingContext } from './fairness'
import type { Fact } from './types'

const topicFor: Record<string, string> = { busiest_day: 'busiest_day_topic', longest_conversation: 'longest_conversation_topic', media_peak: 'media_peak_topic', month_series: 'month_peak_topic' }

/** What AI said was being talked about at the moment a fact measures, when it has said anything. */
export function topicOf(factId: string | undefined, facts: Fact[]) {
  const topic = facts.find((fact) => fact.id === topicFor[factId ?? ''])
  return topic && !isPendingContext(topic.value) ? String(topic.value) : undefined
}
