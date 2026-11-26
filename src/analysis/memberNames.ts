import type { Member } from './types'

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

const phoneNumber = /^\+?[\d\s().-]{7,}$/

export type DisplayMember = Member & { short: string }

/** Names as they may appear on a shareable card, with a short form that stays unambiguous. */
export function toDisplayMembers(members: Member[], hideNames: boolean): DisplayMember[] {
  const shown = members.filter((member) => isDisplayableMemberName(member.name))
  if (hideNames) return shown.map((member, index) => ({ ...member, name: `Member ${index + 1}`, short: `Member ${index + 1}` }))
  const named = shown.map((member) => {
    const name = normalizeMemberName(member.name)
    // An unsaved contact shows up as a full phone number. Never print that on a card.
    if (phoneNumber.test(name)) { const ending = `…${name.replace(/\D/g, '').slice(-4)}`; return { ...member, name: `Number ending ${ending}`, short: ending } }
    return { ...member, name, short: name.split(' ')[0] }
  })
  const count = (values: string[]) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>())
  const firsts = count(named.map((member) => member.short))
  const withInitial = named.map((member) => {
    const second = member.name.split(' ')[1]
    return (firsts.get(member.short) ?? 0) > 1 && second ? { ...member, short: `${member.short} ${[...second][0]}.` } : member
  })
  const repeated = count(withInitial.map((member) => member.short))
  return withInitial.map((member) => (repeated.get(member.short) ?? 0) > 1 ? { ...member, short: member.name } : member)
}
