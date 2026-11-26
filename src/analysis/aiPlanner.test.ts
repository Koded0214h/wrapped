import { describe, expect, it } from 'vitest'
import { addFindings } from './aiPlanner'
import type { Card, Fact } from './types'

const card = (id: string, layout: Card['layout'], factIds: string[]): Card => ({ id, layout, factIds, headline: id, roast: '', locked: true })

describe('AI on a group deck', () => {
  it('keeps every group card and slots AI findings in before the finale', () => {
    const facts: Fact[] = [{ id: 'semantic_0', kind: 'running_joke', memberIds: [], value: 'x', surpriseScore: 1 }, { id: 'total_messages', kind: 'total_messages', memberIds: [], value: 1, surpriseScore: 1 }]
    const deck = [card('numbers', 'groupNumbers', []), card('movie', 'movieFinale', []), card('final', 'finalVerdict', [])]
    const planned = [card('joke', 'quote', ['semantic_0']), card('repeat', 'bigNumber', ['total_messages'])]
    expect(addFindings(deck, planned, facts).map((item) => item.id)).toEqual(['numbers', 'joke', 'movie', 'final'])
  })
})
