const invisibleMarks = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g

const mediaPlaceholder = /^<?\s*(?:image|video note|video|audio|document|gif|sticker|media|contact(?: card)?)\s+omitted\s*>?$/i
// Exports made "with media": "IMG-1.jpg (file attached)" on Android, "<attached: 1-PHOTO.jpg>" on iOS.
const attachedFile = /^(?:(.+?\.\w{2,5}) \(file attached\)|<attached:\s*([^>]+)>)$/i
const voiceFile = /(?:^ptt-|-audio-|\.opus$)/i
const deletedPlaceholder = /^(?:this message was deleted|you deleted this message|waiting for this message\.?(?: this may take a while\.?)?)$/i
const editedPlaceholder = /^<?\s*this message was edited\s*>?$/i

export function normalizeExportText(value: string) {
  return value.replace(invisibleMarks, '').trim()
}

export function readMedia(value: string) {
  const [first = '', ...rest] = normalizeExportText(value).split('\n')
  const line = normalizeExportText(first)
  const file = line.match(attachedFile)
  if (!file && !mediaPlaceholder.test(line)) return undefined
  const name = file?.[1] ?? file?.[2] ?? ''
  return {
    // "<Media omitted>" does not say what was sent, so it never counts as a voice note.
    voice: file ? voiceFile.test(name.trim()) : /audio|voice/i.test(line),
    caption: rest.join('\n').replace(/\s*<this message was edited>$/i, '').trim()
  }
}

export function isExportPlaceholder(value: string) {
  const normalized = normalizeExportText(value)
  return mediaPlaceholder.test(normalized) || attachedFile.test(normalized) || deletedPlaceholder.test(normalized) || editedPlaceholder.test(normalized)
}

export function isMediaPlaceholder(value: string) {
  return readMedia(value) !== undefined
}

export const vocabularyArtifactWords = new Set([
  'audio', 'contact', 'deleted', 'document', 'gif', 'image', 'media', 'message',
  'edited', 'omitted', 'sticker', 'video', 'waiting'
])
