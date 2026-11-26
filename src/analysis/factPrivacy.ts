import type { Fact } from './types'

/** The laugh moment's detail is a real message. It stays in memory on this device. */
export function withoutRawText(fact: Fact): Fact {
  const { sourceExcerpt: _sourceExcerpt, ...safe } = fact
  if (safe.kind !== 'laugh_moment') return safe
  const { detail: _detail, ...rest } = safe
  return rest
}

export function factsForUpload(facts: Fact[], aiMode: 'facts-only' | 'with-quotes') {
  return facts.map((fact) => {
    const safe = withoutRawText(fact)
    return aiMode === 'with-quotes' && fact.sourceExcerpt ? { ...safe, sourceExcerpt: fact.sourceExcerpt } : safe
  })
}
