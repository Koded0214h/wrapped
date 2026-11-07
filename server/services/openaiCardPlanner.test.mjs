import { describe, expect, it, vi } from 'vitest'
import { createOpenAICardPlannerService } from './openaiCardPlanner.mjs'

describe('OpenAI card planner service', () => {
  it('uses the Responses API with server-side auth and strict structured output', async () => {
    const fetchImpl = vi.fn(async (_url, init) => ({
      ok: true,
      json: async () => ({
        model: 'gpt-5.6-sol',
        usage: { input_tokens: 120, output_tokens: 80 },
        output: [{ content: [{ type: 'output_text', text: JSON.stringify({ cards: [{ id: 'one' }] }) }] }]
      }),
      init
    }))
    const service = createOpenAICardPlannerService({ apiKey: 'test-key', fetchImpl })
    const result = await service.generate({
      systemPrompt: 'Return JSON.',
      prompt: 'Facts: []',
      schema: { type: 'object', properties: { cards: { type: 'array' } }, required: ['cards'], additionalProperties: false }
    })

    expect(result).toMatchObject({ cards: [{ id: 'one' }], tokensIn: 120, tokensOut: 80, model: 'gpt-5.6-sol' })
    const [url, init] = fetchImpl.mock.calls[0]
    const request = JSON.parse(init.body)
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(init.headers.authorization).toBe('Bearer test-key')
    expect(request).toMatchObject({ model: 'gpt-5.6-sol', store: false, reasoning: { effort: 'low' } })
    expect(request.text.format).toMatchObject({ type: 'json_schema', strict: true, name: 'chat_wrapped_card_plan' })
  })

  it('fails clearly when the server key is missing', async () => {
    const service = createOpenAICardPlannerService({ apiKey: '' })
    await expect(service.generate({ systemPrompt: '', prompt: '', schema: {} })).rejects.toThrow('A-500')
  })
})
