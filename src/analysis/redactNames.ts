import { normalizeMemberName } from './memberNames'

// Words that appear inside saved contact names but identify nobody.
const connectors = new Set(['of', 'the', 'and', 'de', 'da', 'my', 'is', 'to', 'in', 'on', 'at'])
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replaces every full sender name, and every part of it, with "Member". */
export function createNameRedactor(names: string[]) {
  const terms = new Set<string>()
  for (const raw of names) {
    const name = normalizeMemberName(raw)
    if (name.length >= 2) terms.add(name.toLocaleLowerCase())
    for (const part of name.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []) {
      const term = part.toLocaleLowerCase()
      if (term.length >= 2 && !connectors.has(term) && !/^\d+$/.test(term)) terms.add(term)
    }
  }
  if (!terms.size) return (text: string) => text
  const alternatives = [...terms].sort((a, b) => b.length - a.length).map(escape).join('|')
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{M}\\p{N}])`, 'giu')
  return (text: string) => text.replace(pattern, 'Member')
}
