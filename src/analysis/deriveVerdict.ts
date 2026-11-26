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
      title: 'You Both Dey Reply',
      blurb: `Only ${shareGap} percentage points separate your messages, and replies take ${replyAverage} minutes on average. Both sides show up.`
    }
    if (nightPct >= 20) return {
      title: 'Midnight Gist Club',
      blurb: `${nightPct}% of your messages came after midnight. Sleep can wait.`
    }
    if (replyAverage > 0 && replyAverage <= 8) return {
      title: 'Sharp Sharp Replies',
      blurb: `Replies take ${replyAverage} minutes on average. Notifications no dey wait here.`
    }
    if (shareGap >= 25) return {
      title: 'One Person Types More',
      blurb: `${shareGap} percentage points separate your messages. One phone did most of the work.`
    }
    if (replyAverage >= 60) return {
      title: 'Slow Replies Sha',
      blurb: `Replies take ${replyAverage} minutes on average. Hot gist fit cool before the answer.`
    }
    return {
      title: 'Two-Person Gist',
      blurb: `${shareGap} percentage points separate your messages. Both phones still showed up.`
    }
  }

  if ((shares[0] ?? 0) >= 40) return {
    title: 'One Person Carries the Chat',
    blurb: `One person sent ${Math.round(shares[0])}% of all messages. Others dey try, but the gap is clear.`
  }
  if (nightPct >= 20) return {
    title: 'Midnight Typing Committee',
    blurb: `${nightPct}% of the messages came after midnight. Sleep couldn’t stop this group.`
  }
  if (laughPct >= 14) return {
    title: 'The Laughs Never Stop',
    blurb: `Laughs show up in ${laughPct}% of the chat. Every joke gets support, strong or not.`
  }
  if (mediaPct >= 20) return {
    title: 'Media Everywhere',
    blurb: `${mediaPct}% of the chat is photo, video or link. You no dey only type.`
  }
  return {
    title: 'Everybody Put Hand',
    blurb: `Nobody sent more than 40% of the messages. Everybody showed up.`
  }
}
