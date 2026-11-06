import { describe, expect, it } from 'vitest'
import { isDisplayableMemberName, normalizeMemberName } from './memberNames'

describe('member name cleanup', () => {
  it('removes WhatsApp tilde prefixes and narrow spaces without truncating the name', () => {
    expect(normalizeMemberName('~\u202fH')).toBe('H')
    expect(normalizeMemberName('~ Adoyi Emmanuel')).toBe('Adoyi Emmanuel')
  })

  it('removes bots and sender labels that contain no usable name', () => {
    expect(isDisplayableMemberName('Meta AI')).toBe(false)
    expect(isDisplayableMemberName('~')).toBe(false)
    expect(isDisplayableMemberName('~\u202fH')).toBe(true)
  })
})
