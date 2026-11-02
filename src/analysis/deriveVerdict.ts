import type { Member } from './types'

export function deriveVerdict(members: Member[], totalMessages: number) {
  const total = Math.max(1, totalMessages)
  const shares = members.map((member) => member.sharePct).sort((a, b) => b - a)
  const shareGap = Math.round(Math.abs((shares[0] ?? 0) - (shares[1] ?? 0)))
  const replyTimes = members.map((member) => member.avgReplyMins).filter((value) => value > 0)
  const replyAverage = replyTimes.length ? Math.round(replyTimes.reduce((sum, value) => sum + value, 0) / replyTimes.length) : 0
  const nightPct = Math.round(members.reduce((sum, member) => sum + member.nightMessages, 0) / total * 100)
  const laughPct = Math.round(members.reduce((sum, member) => sum + member.laughs, 0) / total * 100)
  const mediaPct = Math.round(members.reduce((sum, member) => sum + member.mediaCount, 0) / total * 100)

  if (members.length <= 2) {
    if (shareGap <= 12 && replyAverage > 0 && replyAverage <= 15) return {
      title: 'Mutual Notification Society',
      blurb: `Only ${shareGap} percentage points split the conversation, with replies averaging ${replyAverage} minutes. Properly two-sided.`
    }
    if (nightPct >= 20) return {
      title: 'The After-Hours Hotline',
      blurb: `${nightPct}% of the conversation happened after midnight. Apparently, sleep could wait.`
    }
    if (replyAverage > 0 && replyAverage <= 8) return {
      title: 'The Rapid Response Unit',
      blurb: `Replies averaged ${replyAverage} minutes. Neither notification was left to wonder.`
    }
    if (shareGap >= 25) return {
      title: 'One Types, One Reacts',
      blurb: `${shareGap} percentage points separated both sides. The typing workload was not equally distributed.`
    }
    if (replyAverage >= 60) return {
      title: 'Slow-Burn Correspondence',
      blurb: `Replies averaged ${replyAverage} minutes. This chat believes anticipation builds character.`
    }
    return {
      title: 'Two-Person Gist Department',
      blurb: `${shareGap} percentage points separated both sides. Different energy, same notification economy.`
    }
  }

  if ((shares[0] ?? 0) >= 40) return {
    title: 'One Mic, Many Listeners',
    blurb: `The busiest member carried ${Math.round(shares[0])}% of the chat. Everyone else brought supporting vocals.`
  }
  if (nightPct >= 20) return {
    title: 'The Midnight Committee',
    blurb: `${nightPct}% of the messages arrived after midnight. Sensible hours were never invited.`
  }
  if (laughPct >= 14) return {
    title: 'Certified Comedy Department',
    blurb: `Laughs appeared in ${laughPct}% of the chat. The group has its own unpaid writers’ room.`
  }
  if (mediaPct >= 20) return {
    title: 'The Receipts Department',
    blurb: `${mediaPct}% of the chat was media. Nobody makes a claim here without supporting evidence.`
  }
  return {
    title: 'The Daily Gist Desk',
    blurb: `No single member crossed 40% of the conversation. The chaos was impressively collaborative.`
  }
}
