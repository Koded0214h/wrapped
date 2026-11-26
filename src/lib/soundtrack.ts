/** One optional track, dropped into public/audio. Without it the app stays silent. */
export const SOUNDTRACK_URL = '/audio/soundtrack.mp3'

export async function hasSoundtrack() {
  try {
    const response = await fetch(SOUNDTRACK_URL, { method: 'HEAD' })
    // A missing file can come back as the app's own page with status 200, so check the type.
    return response.ok && (response.headers.get('content-type') ?? '').startsWith('audio/')
  } catch { return false }
}

export async function loadSoundtrack(context: BaseAudioContext) {
  const response = await fetch(SOUNDTRACK_URL)
  return context.decodeAudioData(await response.arrayBuffer())
}
