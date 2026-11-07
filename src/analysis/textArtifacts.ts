const invisibleMarks = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g

const mediaPlaceholder = /^<?\s*(?:image|video|audio|document|gif|sticker|media|contact(?: card)?)\s+omitted\s*>?$/i
const deletedPlaceholder = /^(?:this message was deleted|you deleted this message|waiting for this message\.?(?: this may take a while\.?)?)$/i
const editedPlaceholder = /^<?\s*this message was edited\s*>?$/i

export function normalizeExportText(value: string) {
  return value.replace(invisibleMarks, '').trim()
}

export function isExportPlaceholder(value: string) {
  const normalized = normalizeExportText(value)
  return mediaPlaceholder.test(normalized) || deletedPlaceholder.test(normalized) || editedPlaceholder.test(normalized)
}

export function isMediaPlaceholder(value: string) {
  return mediaPlaceholder.test(normalizeExportText(value))
}

export const vocabularyArtifactWords = new Set([
  'audio', 'contact', 'deleted', 'document', 'gif', 'image', 'media', 'message',
  'edited', 'omitted', 'sticker', 'video', 'waiting'
])
