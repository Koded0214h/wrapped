import { describe, expect, it } from 'vitest'
import { parseChat } from './parseChat'
import { computeFacts } from './computeFacts'
import { topicOf } from './topics'

const two = (value: number) => String(value).padStart(2, '0')

describe('what a busy moment was about', () => {
  it('reads across the whole busy day and the busiest month, with names hidden', async () => {
    const lines = Array.from({ length: 300 }, (_, i) => `05/03/2025, ${two(8 + Math.floor(i / 30))}:${two(i % 60)} - ${i % 2 ? 'Ada' : 'Bola'}: ${i < 20 ? 'morning breakfast gist' : i > 280 ? 'goodnight concert tickets' : 'Ada weekend wedding planning'}`)
    lines.push('02/04/2025, 10:00 - Ada: hello again weekend')
    const { result } = await parseChat(new File([lines.join('\n')], 'chat.txt'), { includeAiChunks: true })
    const facts = computeFacts({ ...result, sourceKind: 'upload' })
    const day = facts.find((fact) => fact.id === 'busiest_day_topic')!
    expect(day.sourceExcerpt).toContain('breakfast')
    expect(day.sourceExcerpt).toContain('concert')
    expect(day.sourceExcerpt!.length).toBeLessThanOrEqual(6000)
    expect(day.sourceExcerpt).not.toMatch(/\b(Ada|Bola)\b/)
    expect(facts.find((fact) => fact.id === 'month_peak_topic')?.sourceExcerpt).toBeTruthy()
  })

  it('shows nothing until AI has actually answered', () => {
    const topic = { id: 'busiest_day_topic', kind: 'topic_context', memberIds: [], value: 'This moment needs the AI context pass before it can be described honestly.', surpriseScore: 1 }
    expect(topicOf('busiest_day', [topic])).toBeUndefined()
    expect(topicOf('busiest_day', [{ ...topic, value: 'They planned a trip.' }])).toBe('They planned a trip.')
  })
})
