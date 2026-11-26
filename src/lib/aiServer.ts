let checked: Promise<boolean> | undefined

/**
 * Whether there is a server that can really run AI. A static host serves the app without one,
 * and nobody should be asked to share a chat, or have it sent, to something that is not there.
 */
export function aiServerAvailable() {
  checked ??= fetch('/api/health', { signal: AbortSignal.timeout?.(5000) })
    .then(async (response) => response.ok && (await response.json()).openai === true)
    .catch(() => false)
    .then((available) => { if (!available) checked = undefined; return available })
  return checked
}
