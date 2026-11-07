import { describe, expect, it } from 'vitest'
import { isExportPlaceholder, isMediaPlaceholder, normalizeExportText, vocabularyArtifactWords } from './textArtifacts'

describe('export placeholder filtering', () => {
  it.each([
    '<Media omitted>',
    'image omitted',
    '\u200eSticker omitted',
    'video omitted',
    'This message was deleted',
    '<This message was edited>'
  ])('recognises %s as export metadata', (value) => {
    expect(isExportPlaceholder(value)).toBe(true)
  })

  it('counts only actual media placeholders as media activity', () => {
    expect(isMediaPlaceholder('\u200eSticker omitted')).toBe(true)
    expect(isMediaPlaceholder('This message was deleted')).toBe(false)
    expect(isMediaPlaceholder('<This message was edited>')).toBe(false)
  })

  it('does not remove genuine chat vocabulary', () => {
    expect(isExportPlaceholder('bro create the model')).toBe(false)
    expect(vocabularyArtifactWords.has('omitted')).toBe(true)
    expect(vocabularyArtifactWords.has('sticker')).toBe(true)
    expect(vocabularyArtifactWords.has('model')).toBe(false)
    expect(normalizeExportText('\u200ekoded')).toBe('koded')
  })
})
