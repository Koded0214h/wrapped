const botNames = new Set(['meta ai', 'whatsapp', 'whatsapp business'])

export function normalizeMemberName(value: string) {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/^~[\s\u00a0\u202f]*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isDisplayableMemberName(value: string) {
  const normalized = normalizeMemberName(value)
  return /[\p{L}\p{N}]/u.test(normalized) && !botNames.has(normalized.toLocaleLowerCase())
}
