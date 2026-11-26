import type { Member } from './types'
import { MIN_MESSAGES_FOR_HABIT, personalRoles } from './personalRole'

export type MemberArchetype = {
  title: string
  description: string
  emoji: string
}

type Role = MemberArchetype & { value: (member: Member) => number }

const roles: Role[] = [
  // First, so the person who sends the most stickers is cast as exactly that.
  { title: 'The Sticker Warrior', description: 'Why type when one sticker says it all?', emoji: '🥷', value: (m) => m.stickers ?? 0 },
  { title: 'The Voice Note Minister', description: 'Has a microphone and is not afraid to use all of it.', emoji: '🎙️', value: (m) => (m.voiceNotes ?? 0) * 20 + m.mediaCount },
  { title: 'The Midnight Philosopher', description: 'The deeper thoughts arrive after everybody should be asleep.', emoji: '🌙', value: (m) => m.nightMessages / Math.max(1, m.messages) * 100 },
  { title: 'The News Correspondent', description: 'If it happened online, this person has already dropped the link.', emoji: '🗞️', value: (m) => (m.linkCount ?? 0) * 10 + m.mediaCount },
  { title: 'The Walking Wikipedia', description: 'Every answer arrives with context, footnotes and another paragraph.', emoji: '🧠', value: (m) => (m.avgMessageWords ?? 0) * 12 + (m.explanationCount ?? 0) * 4 },
  { title: 'The Professional Instigator', description: 'Starts the conversation, lights the match and watches the notifications.', emoji: '⚡', value: (m) => m.starts * 3 },
  { title: 'The Group Therapist', description: 'Always in the replies when the room needs emotional tech support.', emoji: '🫶', value: (m) => m.sorrys * 4 + (m.repliesReceived ?? 0) / 5 },
  { title: 'The Silent Observer', description: 'Seen everything. Typed almost nothing. Knows far too much.', emoji: '👁️', value: (m) => 100 / Math.max(.5, m.sharePct) },
  { title: 'The Reply Sniper', description: 'The notification barely lands before the answer does.', emoji: '🎯', value: (m) => 1000 / Math.max(1, m.avgReplyMins) },
  { title: 'The Meme Distributor', description: 'Keeps the group supplied with essential visual research.', emoji: '🫡', value: (m) => m.mediaCount * 4 + m.laughs },
  { title: 'The Chief Apologist', description: 'Has “sorry” ready before the situation finishes loading.', emoji: '🙏', value: (m) => m.sorrys * 12 },
  { title: 'The Logistics Minister', description: 'Needs the location, the time and confirmation that everybody has left home.', emoji: '📍', value: (m) => (m.locationQuestions ?? 0) * 14 + m.starts },
  { title: 'The Finance Secretary', description: 'Somehow the conversation eventually arrives at money.', emoji: '🧾', value: (m) => (m.moneyMentions ?? 0) * 14 },
  { title: 'The Link Librarian', description: 'The group asks a question. A source appears immediately.', emoji: '🔗', value: (m) => (m.linkCount ?? 0) * 16 },
  { title: 'The Media Mogul', description: 'Photos, clips and screenshots are the preferred vocabulary.', emoji: '🎞️', value: (m) => m.mediaCount * 8 },
  { title: 'The Night Watch Commander', description: 'Keeps the chat operational while sensible people sleep.', emoji: '🦉', value: (m) => m.nightMessages * 5 },
  { title: 'The Conversation Resuscitator', description: 'Can restart a chat everybody else had already buried.', emoji: '⚡', value: (m) => m.starts * 5 + (m.continuations ?? 0) },
  { title: 'The Human Laugh Track', description: 'Makes every joke feel like it had a studio audience.', emoji: '😂', value: (m) => m.laughs * 5 },
  { title: 'The Paragraph Architect', description: 'Builds messages with an introduction, body and conclusion.', emoji: '🏗️', value: (m) => (m.explanationCount ?? 0) * 20 + (m.avgMessageWords ?? 0) },
  { title: 'The Thread Magnet', description: 'Says one thing and the replies immediately gather around it.', emoji: '🧲', value: (m) => (m.repliesReceived ?? 0) * 3 },
  { title: 'The Sequel Specialist', description: 'One message is never enough when five will complete the thought.', emoji: '➕', value: (m) => (m.continuations ?? 0) * 5 },
  { title: 'The Main Broadcaster', description: 'Treats the chat like a station with an extremely loyal audience.', emoji: '📡', value: (m) => m.messages * 2 + (m.words ?? 0) / 10 },
  { title: 'The Reaction Commissioner', description: 'Officially responsible for acknowledging the nonsense.', emoji: '🤣', value: (m) => m.laughs / Math.max(1, m.messages) * 1000 },
  { title: 'The Disappearing Act', description: 'Leaves for an era and returns without issuing a statement.', emoji: '🫥', value: (m) => m.longestSilenceHrs },
  { title: 'The Context Department', description: 'Never delivers a fact without the complete backstory.', emoji: '🧩', value: (m) => (m.avgMessageWords ?? 0) * 10 + (m.words ?? 0) / 100 }
]

// A headline role is one of a kind, so it has to be earned: some evidence, and enough messages to mean it.
function earns(role: Role, member: Member, value: number) {
  if (value <= 0) return false
  if (role.title === 'The Silent Observer') return true
  if (role.title === 'The Reply Sniper' && (member.avgReplyMins <= 0 || (member.replyCount ?? 5) < 5)) return false
  return member.messages >= MIN_MESSAGES_FOR_HABIT
}

export function assignArchetypes(members: Member[]) {
  const assigned = new Map<string, MemberArchetype>()
  const usedTitles = new Set<string>()
  const pairs = roles.flatMap((role, roleIndex) => {
    const values = members.map(role.value)
    const maximum = Math.max(1, ...values)
    return members.flatMap((member, memberIndex) => earns(role, member, values[memberIndex]) ? [{ role, member, score: values[memberIndex] / maximum * 100 + (roles.length - roleIndex) * .01 }] : [])
  }).sort((a, b) => b.score - a.score)

  for (const pair of pairs) {
    if (assigned.has(pair.member.id) || usedTitles.has(pair.role.title)) continue
    assigned.set(pair.member.id, { title: pair.role.title, description: pair.role.description, emoji: pair.role.emoji })
    usedTitles.add(pair.role.title)
  }

  // Everyone else is described by their own numbers.
  const personal = personalRoles(members)
  for (const member of members) if (!assigned.has(member.id)) assigned.set(member.id, personal(member))
  return assigned
}
