import type { Fact, Member } from './types'

/** A reply average from a handful of replies is noise, and zero replies is not "instant". */
export function qualifiesForReplyRank(member: Member, totalMessages: number) {
  return (member.replyCount ?? Infinity) >= (totalMessages >= 5000 ? 20 : 5)
}

/** The single clear leader, or nothing when the top score is zero or shared. */
export function clearWinner<T>(items: T[], score: (item: T) => number): T | undefined {
  const [first, second] = [...items].sort((a, b) => score(b) - score(a))
  if (!first || score(first) <= 0 || (second && score(second) === score(first))) return undefined
  return first
}

export const isTiedForFirst = (fact: Fact) => fact.context?.rank === 1 && (fact.context.outOf ?? 0) > 1 && fact.context.gap === 0

export const isPendingContext = (value: unknown) => /needs the AI context pass|not enough safe readable text/i.test(String(value))
