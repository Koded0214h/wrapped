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
      title: 'Both of Una Dey Reply',
      blurb: `Na only ${shareGap} percentage points separate una messages, and reply dey take ${replyAverage} minutes on average. Both sides put hand.`
    }
    if (nightPct >= 20) return {
      title: 'Midnight No Get Gate',
      blurb: `${nightPct}% of the messages enter after midnight. Sleep wait while una continue gist.`
    }
    if (replyAverage > 0 && replyAverage <= 8) return {
      title: 'Sharp Sharp Reply',
      blurb: `Reply dey take ${replyAverage} minutes on average. Notification no dey wait for this chat.`
    }
    if (shareGap >= 25) return {
      title: 'One Person Type Pass',
      blurb: `${shareGap} percentage points separate una messages. One phone do plenty of the typing.`
    }
    if (replyAverage >= 60) return {
      title: 'Reply Wey Take Time',
      blurb: `Reply dey take ${replyAverage} minutes on average. Any hot gist fit cool before answer land.`
    }
    return {
      title: 'Two-Person Gist',
      blurb: `${shareGap} percentage points separate una messages. Both phones still show for the chat.`
    }
  }

  if ((shares[0] ?? 0) >= 40) return {
    title: 'One Person Type Pass Everybody',
    blurb: `The person wey send pass everybody get ${Math.round(shares[0])}% of all messages. Others still type, but gap dey.`
  }
  if (nightPct >= 20) return {
    title: 'Midnight Typing Committee',
    blurb: `${nightPct}% of the messages enter after midnight. Sleep no fit stop this group.`
  }
  if (laughPct >= 14) return {
    title: 'Laugh No Dey Finish',
    blurb: `Laugh show for ${laughPct}% of the chat. Una dey encourage joke, whether e strong or not.`
  }
  if (mediaPct >= 20) return {
    title: 'Media Full Ground',
    blurb: `${mediaPct}% of the chat na photo, video or link. Una no dey use only text talk.`
  }
  return {
    title: 'Everybody Put Hand',
    blurb: `Na everybody type. Nobody pass 40% of all messages for the group.`
  }
}
