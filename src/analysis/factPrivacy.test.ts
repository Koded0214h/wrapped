import { describe, expect, it } from 'vitest'
import { factsForUpload } from './factPrivacy'
import type { Fact } from './types'

const facts: Fact[] = [
  { id: 'laugh_moment', kind: 'laugh_moment', memberIds: [], value: 3, detail: 'a real message', replies: [{ memberId: 'm_1', text: 'a real message back' }], surpriseScore: 1 },
  { id: 'busiest_day_topic', kind: 'topic_context', memberIds: [], value: 'x', sourceExcerpt: 'Person A: a real message', surpriseScore: 1 }
]

describe('what leaves the device', () => {
  it('carries no message text in facts-only mode', () => {
    expect(JSON.stringify(factsForUpload(facts, 'facts-only'))).not.toContain('a real message')
  })
  it('carries only the redacted excerpt after opting in', () => {
    const sent = factsForUpload(facts, 'with-quotes')
    expect(sent[0].detail).toBeUndefined()
    expect(sent[0].replies).toBeUndefined()
    expect(sent[1].sourceExcerpt).toContain('Person A')
  })
})
