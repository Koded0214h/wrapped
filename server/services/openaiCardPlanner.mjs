const DEFAULT_MODEL = 'gpt-5.6-sol'
const DEFAULT_REASONING_EFFORT = 'low'
const allowedEfforts = new Set(['none', 'low', 'medium', 'high', 'xhigh', 'max'])

function responseText(result) {
  if (typeof result?.output_text === 'string') return result.output_text
  return (result?.output ?? [])
    .flatMap((item) => item?.content ?? [])
    .filter((content) => content?.type === 'output_text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('')
}

export function createOpenAICardPlannerService(options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL
  const configuredEffort = options.reasoningEffort ?? process.env.OPENAI_REASONING_EFFORT ?? DEFAULT_REASONING_EFFORT
  const reasoningEffort = allowedEfforts.has(configuredEffort) ? configuredEffort : DEFAULT_REASONING_EFFORT
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    model,
    async generate({ systemPrompt, prompt, schema }) {
      if (!apiKey) throw new Error('A-500: OpenAI is not configured.')
      const started = Date.now()
      const response = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          instructions: systemPrompt,
          input: prompt,
          reasoning: { effort: reasoningEffort },
          text: {
            format: {
              type: 'json_schema',
              name: 'chat_wrapped_card_plan',
              strict: true,
              schema
            }
          },
          max_output_tokens: 6000,
          store: false
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(`A-503: ${String(result?.error?.message || 'OpenAI request failed').slice(0, 120)}`)

      const raw = responseText(result)
      if (!raw) throw new Error('A-504: OpenAI returned no card plan.')
      let parsed
      try { parsed = JSON.parse(raw) } catch { throw new Error('A-505: OpenAI returned invalid card JSON.') }

      return {
        data: parsed,
        cards: Array.isArray(parsed?.cards) ? parsed.cards : [],
        tokensIn: Number(result?.usage?.input_tokens || 0),
        tokensOut: Number(result?.usage?.output_tokens || 0),
        latencyMs: Date.now() - started,
        model: String(result?.model || model)
      }
    }
  }
}
