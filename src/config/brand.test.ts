import { describe, expect, it } from 'vitest'
import { brand } from './brand'

describe('brand safety', () => {
  it('does not use a platform trademark as the product identity', () => {
    expect(brand.productName).not.toMatch(/whatsapp/i)
    expect(brand.domain).not.toMatch(/whatsapp/i)
  })
})
