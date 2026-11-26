import type { Member } from '../analysis/types'
import type { MemberArchetype } from './assignArchetypes'

/** Below this, a habit is a coincidence, so the character only says how often they showed up. */
export const MIN_MESSAGES_FOR_HABIT = 10

type Habit = {
  titles: string[]
  emoji: string
  count: (member: Member) => number
  /** How much of this habit per message, for comparing with the rest of the group. */
  rate: (member: Member) => number
  minimum: number
  describe: (member: Member, count: number) => string
}

const per = (count: (member: Member) => number) => (member: Member) => count(member) / Math.max(1, member.messages)
const words = (member: Member) => member.avgMessageWords ?? 0
const habit = (titles: string[], emoji: string, count: Habit['count'], minimum: number, describe: Habit['describe']): Habit => ({ titles, emoji, count, rate: per(count), minimum, describe })

const habits: Habit[] = [
  habit(['The Sticker Foot Soldier', 'The Sticker Specialist', 'The Reaction Sticker Person'], '🪖', (m) => m.stickers ?? 0, 3, (m, n) => `${n} stickers in ${m.messages} messages. The sticker army never sleeps.`),
  habit(['The After-Hours Regular', 'The 2AM Contributor', 'The Night Shift Volunteer'], '🌙', (m) => m.nightMessages, 3, (m, n) => `${n} of ${m.messages} messages landed after midnight.`),
  habit(['The Show-and-Tell Person', 'The Gallery Curator', 'The Picture Speaker'], '📸', (m) => m.mediaCount - (m.stickers ?? 0), 3, (m, n) => `${n} of ${m.messages} messages were media. Why type when you can show?`),
  habit(['The Hype Audience', 'The Easy Laugh', 'The Gist Cheerleader'], '😂', (m) => m.laughs, 3, (m, n) => `Laughed in ${n} of ${m.messages} messages. Every joke gets support.`),
  habit(['The Link Plug', 'The Source Provider'], '🔗', (m) => m.linkCount ?? 0, 3, (_, n) => `${n} links shared. If it’s online, it lands here.`),
  habit(['The Gist Igniter', 'The Conversation Opener'], '🔥', (m) => m.starts, 3, (_, n) => `Opened fresh gist ${n} times after the chat went quiet.`),
  habit(['The Reply Magnet', 'The Talking Point'], '🧲', (m) => m.repliesReceived ?? 0, 5, (_, n) => `People answered straight after them ${n} times.`),
  habit(['The Location Checker', 'The Attendance Officer'], '📍', (m) => m.locationQuestions ?? 0, 2, (_, n) => `Asked where people dey ${n} times.`),
  habit(['The Peace Ambassador', 'The Soft Landing'], '🕊️', (m) => m.sorrys, 3, (_, n) => `Said sorry ${n} times. No long wahala.`),
  { titles: ['The Full Gist Giver', 'The Detail Person', 'The Long-Form Writer'], emoji: '📝', count: words, rate: words, minimum: 12, describe: (_, n) => `About ${Math.round(n)} words every time they press send.` }
]

const cameos: { upTo: number; titles: string[]; emoji: string; describe: (messages: number) => string }[] = [
  { upTo: 1, titles: ['The One-Time Cameo', 'The Single Appearance'], emoji: '🎬', describe: () => 'One message in this whole export. Short scene, but it’s on record.' },
  { upTo: 4, titles: ['The Special Guest', 'The Surprise Appearance'], emoji: '✨', describe: (n) => `Showed up with ${n} messages. Rare, like public holiday.` },
  { upTo: MIN_MESSAGES_FOR_HABIT - 1, titles: ['The Occasional Visitor', 'The Pop-In Person'], emoji: '👋', describe: (n) => `${n} messages. Passes through, greets the matter, moves on.` }
]

const allRounder = ['The Steady Presence', 'The All-Rounder', 'The Balanced One', 'The Everyday Voice']

function hash(value: string) {
  let result = 2166136261
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619)
  return result >>> 0
}
const pick = (titles: string[], member: Member) => titles[hash(member.id) % titles.length]

/** A character for one person, from what they did. Several people can share a habit. */
export function personalRoles(members: Member[]) {
  const shortWords = members.reduce((sum, member) => sum + words(member) * member.messages, 0) / Math.max(1, members.reduce((sum, member) => sum + member.messages, 0))
  const totalMessages = Math.max(1, members.reduce((sum, member) => sum + member.messages, 0))
  const averages = habits.map((item) => members.reduce((sum, member) => sum + item.rate(member) * member.messages, 0) / totalMessages)

  return (member: Member): MemberArchetype => {
    const cameo = cameos.find((item) => member.messages <= item.upTo)
    if (cameo) return { title: pick(cameo.titles, member), emoji: cameo.emoji, description: cameo.describe(member.messages) }

    // Their most unusual habit: furthest above what is normal for this group.
    const standout = habits
      .map((item, index) => ({ item, count: item.count(member), lift: item.rate(member) / Math.max(1e-9, averages[index]) }))
      .filter((entry) => entry.count >= entry.item.minimum && entry.lift >= 1.25)
      .sort((a, b) => b.lift - a.lift)[0]
    if (standout) return { title: pick(standout.item.titles, member), emoji: standout.item.emoji, description: standout.item.describe(member, standout.count) }

    if (words(member) > 0 && words(member) <= shortWords * .7) return { title: pick(['The Straight-To-The-Point', 'The Few Words Specialist'], member), emoji: '🎯', description: `About ${Math.round(words(member)) || 1} words per message. No wasted data.` }
    return { title: pick(allRounder, member), emoji: '🤝', description: `${member.messages} messages, and no single habit take over. A bit of everything.` }
  }
}
