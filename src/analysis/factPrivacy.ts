import type { Fact } from './types'

/** The laugh moment quotes real messages. They stay on this device. */
export function withoutRawText(fact: Fact): Fact {
  const { sourceExcerpt: _sourceExcerpt, ...safe } = fact
  if (safe.kind !== 'laugh_moment') return safe
  const { detail: _detail, replies: _replies, ...rest } = safe
  return rest
}

export function factsForUpload(facts: Fact[], aiMode: 'facts-only' | 'with-quotes') {
  return facts.map((fact) => {
    const safe = withoutRawText(fact)
    return aiMode === 'with-quotes' && fact.sourceExcerpt ? { ...safe, sourceExcerpt: fact.sourceExcerpt } : safe
  })
}
