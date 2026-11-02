export type AiMode = 'facts-only' | 'with-quotes'
export type PrivacyCopyMode = 'local-only' | 'ai-facts' | 'ai-quotes'

const privacy = __PRIVACY_COPY_MODE__ as PrivacyCopyMode

export const appConfig = {
  aiMode: (import.meta.env.VITE_AI_MODE || 'facts-only') as AiMode,
  aiPlanner: import.meta.env.VITE_AI_PLANNER === 'on',
  privacyCopyMode: privacy,
  telemetry: import.meta.env.VITE_TELEMETRY !== 'off',
  savageEnabled: import.meta.env.VITE_SAVAGE_ENABLED !== 'false'
}

export const privacyCopy = {
  short: privacy === 'local-only' ? 'Your chat never leaves your phone.' : privacy === 'ai-quotes' ? 'Selected excerpts may be sent only after you opt in.' : 'Message text stays on your phone. Only computed facts may be sent for card planning.',
  processing: privacy === 'local-only' ? 'Everything is happening on this device.' : privacy === 'ai-quotes' ? 'Parsing stays here. Quote sharing requires your permission.' : 'Parsing stays here. Card planning can use computed facts only.',
  paywall: privacy === 'local-only' ? 'Processed entirely on your phone.' : 'No raw message text is sent for card planning.'
}
