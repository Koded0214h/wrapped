export type AiMode = 'facts-only' | 'with-quotes'
export type PrivacyCopyMode = 'local-only' | 'ai-facts' | 'ai-quotes'
export type PaymentMode = 'free' | 'mock' | 'bachs'

const privacy = __PRIVACY_COPY_MODE__ as PrivacyCopyMode
const paymentMode = (['free', 'mock', 'bachs'] as const).includes(import.meta.env.VITE_PAYMENT_MODE as PaymentMode)
  ? import.meta.env.VITE_PAYMENT_MODE as PaymentMode
  : 'mock'

export const appConfig = {
  aiMode: (import.meta.env.VITE_AI_MODE || 'facts-only') as AiMode,
  aiPlanner: import.meta.env.VITE_AI_PLANNER === 'on',
  privacyCopyMode: privacy,
  telemetry: import.meta.env.VITE_TELEMETRY !== 'off',
  savageEnabled: import.meta.env.VITE_SAVAGE_ENABLED !== 'false',
  paymentMode,
  freeAccess: paymentMode === 'free'
}

export const privacyCopy = {
  short: privacy === 'local-only' ? 'Your chat never leaves your phone.' : privacy === 'ai-quotes' ? 'Counting happens on your phone. AI reads your messages, with names removed, only after you agree.' : 'Your messages stay on your phone. Only counts and common words are sent to write the cards.',
  processing: privacy === 'local-only' ? 'Everything is happening on this device.' : privacy === 'ai-quotes' ? 'Counting happens here. AI then reads the chat with names removed.' : 'Counting happens here. Only the results are sent to write your cards.'
}
