import { useMemo, useState } from 'react'
import { Activity, Award as AwardIcon, BarChart3, BookHeart, BriefcaseBusiness, ChevronLeft, ChevronRight, Clock3, Clapperboard, Crown, Flame, Ghost, Images, Languages, Laugh, MessageCircle, MoonStar, Network, PartyPopper, Quote as QuoteIcon, RadioTower, Search, Sparkles, TimerReset, Trophy, Users, Vote, X, Zap } from 'lucide-react'
import type { Card, Fact, LayoutType, Member } from '../analysis/types'
import { resolveTemplate } from '../analysis/planCards'
import { assignArchetypes } from '../analysis/assignArchetypes'
import { toDisplayMembers, type DisplayMember } from '../analysis/memberNames'
import { clearWinner, isPendingContext, qualifiesForReplyRank } from '../analysis/fairness'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { MemberCharacter } from '../components/MemberCharacter'
import { brand } from '../config/brand'
import { CountUp, EmojiRain, StillContext, useStill } from './motion'
import { topicOf } from '../analysis/topics'
import { TopicNote } from './TopicNote'
import { Calls, EmojiBoard, Highlights, Hourly, Monthly, QuietGap, Split } from './RhythmLayouts'

// What the viewer picked inside a card, so a saved image shows the same thing.
export type CardView = Record<string, unknown>
type Props = { card: Card; facts: Fact[]; members: Member[]; savage: boolean; hideNames: boolean; preview?: boolean; watermark?: boolean; view?: CardView; onView?: (key: string, value: unknown) => void }
type LayoutProps = Omit<Props, 'members'> & { members: DisplayMember[]; referenced: Fact[]; headline: string; roast: string }

function useView<T>({ view, onView }: LayoutProps, key: string, initial: T) {
  const [value, setValue] = useState<T>((view?.[key] as T | undefined) ?? initial)
  return [value, (next: T) => { setValue(next); onView?.(key, next) }] as const
}
const format = (value: string | number) => typeof value === 'number' ? new Intl.NumberFormat('en-GB').format(value) : value
const fillerWords = new Set(['dey','don','sha','make','one','na','get','come','know','say','just','like','still','even','thing','people','una','dem','abi','abeg','sef','oya','omo','wetin','wey','fit','wan','yeah','okay','lol','lmao','im'])

const memberFor = (fact: Fact | undefined, members: Member[]) => members.find((member) => member.id === fact?.memberIds[0])

function Cover({ headline, referenced, roast, members }: LayoutProps) {
  const total = referenced.find((fact) => fact.kind === 'total_messages')
  const range = referenced.find((fact) => fact.kind === 'date_range')
  return <div className="slide slide--cover"><div className="slide__topline"><span>CHAT WRAPPED</span><PartyPopper /></div><div className="cover__title"><h2>{headline}</h2><p>{range?.value}</p></div><div className="cover__characters" aria-label="People inside this chat">{members.slice(0, 8).map((member) => <MemberCharacter key={member.id} member={member} size="md" />)}{members.length > 8 && <b>+{members.length - 8}</b>}</div><div className="cover__count"><strong><CountUp value={total?.value ?? 0} /></strong><span>messages.<br />Na wetin export show be this.</span></div><div className="cover__stamp">{roast}</div></div>
}
function BigNumber({ headline, referenced, roast, members }: LayoutProps) {
  const featured = memberFor(referenced[0], members)
  return <div className={`slide slide--numbers ${referenced.length === 1 ? 'slide--single-number' : ''}`}><div className="slide__topline"><span>NA THE NUMBER BE THIS</span><MessageCircle /></div>{featured && <div className="slide-person"><MemberCharacter member={featured} size="md" /><span>{featured.name}</span></div>}<h2>{headline}</h2><div className="number-grid">{referenced.slice(0,4).map((fact) => <div key={fact.id}><strong><CountUp value={fact.value} /></strong><span>{fact.detail ?? fact.kind.replaceAll('_',' ')}</span></div>)}</div><p className="slide__roast">{roast}</p></div>
}
function Leaderboard({ headline, referenced, roast, members }: LayoutProps) {
  const ordered = [...referenced].sort((a, b) => (a.context?.rank ?? 99) - (b.context?.rank ?? 99))
  const maximum = Math.max(1, ...ordered.map((fact) => Number(fact.value) || 0))
  return <div className="slide slide--rank"><div className="slide__topline"><span>WHO DO AM PASS</span><Crown /></div><h2>{headline}</h2><div className="leaderboard">{ordered.map((fact,i) => { const member = memberFor(fact, members); return <div key={fact.id}><b>{i+1}</b>{member ? <MemberCharacter member={member} size="xs" /> : <span /> }<span>{member?.name ?? 'Member'}</span><i><em style={{width:`${Math.max(8, (Number(fact.value) || 0) / maximum * 100)}%`}} /></i><strong>{format(fact.value)}</strong></div> })}</div><p className="slide__roast">{roast}</p></div>
}
function Versus({ headline, referenced, roast, members }: LayoutProps) {
  const ordered = [...referenced].sort((a, b) => (a.context?.rank ?? 99) - (b.context?.rank ?? 99)).slice(0, 2)
  return <div className="slide slide--rank"><div className="slide__topline"><span>TWO OF DEM</span><Zap /></div><h2>{headline}</h2><div className="duel">{ordered.map((fact,i)=>{ const member = memberFor(fact, members); return <div className={i===0?'is-winner':''} key={fact.id}>{member && <MemberCharacter member={member} size="md" />}<span>{member?.name ?? 'Member'}</span><strong>{format(fact.value)}</strong><small>{fact.detail}</small></div> })}</div><p className="slide__roast">{roast}</p></div>
}
function Quote({ headline, referenced, roast }: LayoutProps) { const fact=referenced[0]; const isContext=fact?.kind==='topic_context'||['recurring_theme','running_joke','shared_habit','group_dynamic','memorable_moment'].includes(fact?.kind??''); return <div className="slide slide--quote"><div className="slide__topline"><span>WETIN REALLY HAPPEN</span><QuoteIcon /></div><div className="quote-mark">“</div><h2>{headline}</h2><div className={isContext ? 'quote-story' : 'quote-detail'}>{isContext?fact?.value:fact?.detail}</div><p className="slide__roast">{roast}</p></div> }
function Timeline({ headline, referenced, roast, members, facts }: LayoutProps) {
  const fact = referenced[0]
  const featured = memberFor(fact, members)
  const evidenceWidth = Math.min(100, Math.max(8, (fact?.context?.ratioToAverage ?? 1) * 50))
  return <div className="slide slide--timeline"><div className="slide__topline"><span>HOW E TAKE HAPPEN</span><Clock3 /></div>{featured && <div className="slide-person"><MemberCharacter member={featured} size="md" /><span>{featured.name}</span></div>}<h2>{headline}</h2><div className="timeline-line"><i aria-hidden="true"><em style={{ width: `${evidenceWidth}%` }} /></i><b>{format(fact?.value ?? 0)}</b><span>{fact?.detail}</span></div><TopicNote label="WETIN UNA DEY TALK" text={topicOf(fact?.id, facts)} /><p className="slide__roast">{roast}</p></div>
}
function Award({ headline, referenced, roast, members }: LayoutProps) { const featured = memberFor(referenced[0], members); return <div className="slide slide--awards"><div className="slide__topline"><span>AWARD DON LAND</span><AwardIcon /></div><div className="trophy">{featured ? <MemberCharacter member={featured} size="lg" /> : <Trophy />}</div><h2>{headline}</h2><div className="award-card"><strong>{referenced[0]?.detail}</strong><span>{format(referenced[0]?.value ?? 0)}</span></div><p className="slide__roast">{roast}</p></div> }
function WordCloud({ headline, referenced, roast }: LayoutProps) {
  const maximum = Math.max(1, ...referenced.map((fact) => Number(fact.value) || 0))
  return <div className="slide slide--phrases">
    <div className="slide__topline"><span>WORDS WEY NO REST</span><Flame /></div>
    <h2>{headline}</h2>
    <ol className="phrase-chart" aria-label="Words wey dem use pass">
      {referenced.map((fact, index) => {
        const value = Number(fact.value) || 0
        return <li key={fact.id}>
          <div className="phrase-chart__label"><span><b>{index + 1}</b>{fact.detail}</span><strong>{format(fact.value)}</strong></div>
          <div className="phrase-chart__track" aria-hidden="true"><i style={{ width: `${Math.max(8, value / maximum * 100)}%` }} /></div>
        </li>
      })}
    </ol>
    <p className="slide__roast">{roast}</p>
  </div>
}
function Heatmap({ headline, referenced, roast, members }: LayoutProps) {
  const fact = referenced[0]
  const featured = memberFor(fact, members)
  const share = fact?.context?.sharePct ?? (fact?.kind === 'night_share' ? Number(fact.value) : 0)
  const filled = Math.round(Math.min(100, Math.max(0, share)) / 100 * 28)
  return <div className="slide slide--night"><div className="slide__topline"><span>AFTER MIDNIGHT</span><MoonStar /></div><h2>{headline}</h2><div className="heatmap" role="img" aria-label={`${format(share)} percent of this person messages enter after midnight`}>{Array.from({length:28},(_,i)=><i key={i} data-filled={i < filled} />)}</div><div className="night__receipt">{featured && <MemberCharacter member={featured} size="md" />}<span>{featured?.name ?? 'The chat'}</span><strong>{format(fact?.value ?? 0)}</strong><small>{format(share)}% enter after midnight</small></div><p className="slide__roast">{roast}</p></div>
}
function Verdict({ headline, roast, members }: LayoutProps) { return <div className="slide slide--verdict"><div className="slide__topline"><span>WETIN THIS CHAT BE</span><PartyPopper /></div><div className="verdict__seal">CHAT TYPE</div><h2>{headline}</h2><p>{roast}</p><div className="verdict__members">{members.slice(0,7).map((member)=><MemberCharacter key={member.id} member={member} size="md" />)}</div><div className="verdict__cta">Run your own for <strong>{brand.domain}</strong></div></div> }

const topMember = (members: DisplayMember[], score: (member: Member) => number) => [...members].sort((a, b) => score(b) - score(a))[0]
const shortName = (member: DisplayMember | undefined) => member?.short ?? '—'
const hoursOrDays = (hours: number) => hours < 48 ? `${format(hours)} hours` : `${format(Math.round(hours / 24))} days`

function GroupNumbers({ headline, referenced, roast, members }: LayoutProps) {
  const byKind = new Map(referenced.map((fact) => [fact.kind, fact]))
  const stats = [
    ['People', byKind.get('total_members')?.value ?? members.length],
    ['Words', byKind.get('total_words')?.value ?? 0],
    ['Media', byKind.get('media_count')?.value ?? members.reduce((sum, member) => sum + member.mediaCount, 0)],
    ['Per day', byKind.get('avg_messages_day')?.value ?? 0]
  ]
  return <div className="slide group-card group-card--numbers">
    <div className="group-kicker"><span>01</span><span>The group in numbers</span><Sparkles /></div>
    <div className="numbers-marquee" aria-hidden="true"><span>MESSAGES · MESSAGES · MESSAGES ·</span></div>
    <h2>{headline}</h2>
    <div className="numbers-hero"><strong><CountUp value={byKind.get('total_messages')?.value ?? 0} /></strong><span>messages<br />and counting</span></div>
    <div className="group-stat-grid">{stats.map(([label, value]) => <div key={String(label)}><strong><CountUp value={value} /></strong><span>{label}</span></div>)}</div>
    <div className="group-foot"><div className="avatar-stack">{members.slice(0, 6).map((member) => <MemberCharacter key={member.id} member={member} size="sm" />)}</div><p>{roast}</p></div>
  </div>
}

type YapMetric = 'messages' | 'words' | 'length'
function YapLeaderboard(props: LayoutProps) {
  const { roast, members } = props
  const [metric, setMetric] = useView<YapMetric>(props, 'metric', 'words')
  const metricValue = (member: Member) => metric === 'messages' ? member.messages : metric === 'words' ? (member.words ?? 0) : (member.avgMessageWords ?? 0)
  const ordered = [...members].sort((a, b) => metricValue(b) - metricValue(a)).slice(0, 6)
  const max = Math.max(1, ...ordered.map(metricValue))
  const winner = clearWinner(members, metricValue)
  return <div className="slide group-card group-card--yap">
    <div className="group-kicker"><span>02</span><span>The yap leaderboard</span><Crown /></div>
    <div className="yap-crown"><Crown /><small>{winner ? 'The undisputed yap champion' : 'Too close to call'}</small><strong>{winner ? shortName(winner) : 'A tie'}</strong></div>
    <div className="metric-switch" role="tablist" aria-label="Leaderboard metric">{([['messages','Messages'],['words','Words'],['length','Avg. length']] as [YapMetric,string][]).map(([id,label]) => <button key={id} role="tab" aria-selected={metric===id} className={metric===id?'is-active':''} onClick={() => setMetric(id)}>{label}</button>)}</div>
    <ol className="yap-list">{ordered.map((member, index) => <li key={member.id}><b>{index + 1}</b><MemberCharacter member={member} size="xs" /><span>{shortName(member)}<i><em style={{ width: `${Math.max(7, metricValue(member) / max * 100)}%` }} /></i></span><strong>{format(metricValue(member))}</strong></li>)}</ol>
    <p className="group-caption">{roast}</p>
  </div>
}

function CharacterCast(props: LayoutProps) {
  const { members, roast } = props
  const [active, setActive] = useView(props, 'active', 0)
  const [query, setQuery] = useState('')
  const member = members[active] ?? members[0]
  const archetypes = useMemo(() => assignArchetypes(members), [members])
  const { title, description, emoji } = archetypes.get(member.id)!
  const go = (direction: number) => setActive((active + direction + members.length) % members.length)
  const matches = query.trim() ? members.map((item, index) => ({ item, index })).filter(({ item }) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 4) : []
  const choose = (index: number) => { setActive(index); setQuery('') }
  return <div className="slide group-card group-card--character">
    <div className="group-kicker"><span>03</span><span>Everyone has a character</span><Users /></div>
    <div className="character-search">
      <Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find your card by name" aria-label="Find your character card by name" autoComplete="off" />
      {query && <button onClick={() => setQuery('')} aria-label="Clear name search"><X /></button>}
      {query && <div className="character-search__results" role="listbox" aria-label="Matching group members">{matches.length ? matches.map(({ item, index }) => <button key={item.id} role="option" onClick={() => choose(index)}><MemberCharacter member={item} size="xs" /><span><strong>{item.name}</strong><small>{archetypes.get(item.id)?.title}</small></span></button>) : <p>No matching name. Try another spelling.</p>}</div>}
    </div>
    <div className="character-stage"><div className="character-card-shadow" /><div className="character-dossier"><span className="character-emoji">{emoji}</span><MemberCharacter member={member} size="lg" /><small>Cast member {active + 1} of {members.length}</small><h2>{title}</h2><strong>{member.name}</strong><p>{description}</p><div className="character-receipts"><span>{format(member.messages)} messages</span><span>{format(member.nightMessages)} after midnight</span></div></div></div>
    <div className="character-controls"><button onClick={() => go(-1)} aria-label="Previous member"><ChevronLeft /></button><div>{members.map((item, index) => <button key={item.id} className={index === active ? 'is-active' : ''} onClick={() => setActive(index)} aria-label={`Show ${item.name}`} />)}</div><button onClick={() => go(1)} aria-label="Next member"><ChevronRight /></button></div>
    <p className="group-caption">{roast}</p>
  </div>
}

function GroupAwards(props: LayoutProps) {
  const { members, roast } = props
  const awards = useMemo(() => {
    const total = members.reduce((sum, member) => sum + member.messages, 0)
    const award = (label: string, pool: DisplayMember[], score: (member: Member) => number, evidence: (member: Member) => string) => {
      const member = clearWinner(pool, score)
      return member ? [{ label, member, evidence: evidence(member) }] : []
    }
    // Only awards somebody clearly earned: no zero scores, no shared first place.
    return [
      ...award('Win the war with stickers alone', members, (member) => member.stickers ?? 0, (member) => `Sticker Warrior · ${format(member.stickers ?? 0)} stickers`),
      ...award('Disappear & return like nothing happened', members, (member) => member.longestSilenceHrs >= 24 ? member.longestSilenceHrs : 0, (member) => `${hoursOrDays(member.longestSilenceHrs)} away`),
      ...award('Turn the chat into a podcast', members, (member) => member.voiceNotes ?? 0, (member) => `${format(member.voiceNotes ?? 0)} voice notes`),
      ...award('Start something in the group', members, (member) => member.starts, (member) => `${format(member.starts)} conversations started`),
      ...award('Leave everybody waiting', members.filter((member) => qualifiesForReplyRank(member, total)), (member) => member.avgReplyMins, (member) => `${format(member.avgReplyMins)} min average reply`),
      ...award('Send the longest explanation', members, (member) => member.longestMessageWords ?? 0, (member) => `${format(member.longestMessageWords ?? 0)} words in one message`)
    ]
  }, [members])
  const [selected, setSelected] = useView(props, 'selected', 0)
  const [votes, setVotes] = useView<Record<number, number>>(props, 'votes', {})
  const [voted, setVoted] = useState(false)
  const award = awards[selected] ?? awards[0]
  const vote = () => { if (!voted) { setVotes({ ...votes, [selected]: (votes[selected] ?? 0) + 1 }); setVoted(true) } }
  return <div className="slide group-card group-card--awards">
    <div className="group-kicker"><span>04</span><span>The group chat awards</span><AwardIcon /></div><div className="award-burst" aria-hidden="true">★</div>
    {award ? <div className="award-plaque"><small>Most likely to</small><h2>{award.label}</h2><div><MemberCharacter member={award.member} size="lg" /><span><strong>{award.member.name}</strong><em>{award.evidence}</em></span></div><button className={voted ? 'is-voted' : ''} onClick={vote}><Vote /> {voted ? 'Vote counted' : 'Vote for this nominee'} <b>{votes[selected] ?? 0}</b></button></div>
      : <div className="award-plaque"><small>This round</small><h2>Nobody pulled clear enough to win.</h2></div>}
    <div className="award-tabs">{awards.map((_, index) => <button key={index} className={index === selected ? 'is-active' : ''} onClick={() => { setSelected(index); setVoted(false) }}>{index + 1}</button>)}</div><p className="group-caption">{roast}</p>
  </div>
}

function SocialGraph({ members, roast }: LayoutProps) {
  const score = (member: Member) => member.starts * 1.4 + (member.repliesReceived ?? 0) + (member.continuations ?? 0) * .5
  const central = topMember(members, score)
  const featured = [...members].sort((a, b) => score(b) - score(a)).slice(0, 6)
  const starters = clearWinner(members, (member) => member.starts), replied = clearWinner(members, (member) => member.repliesReceived ?? 0), keeper = clearWinner(members, (member) => member.continuations ?? 0)
  return <div className="slide group-card group-card--social">
    <div className="group-kicker"><span>05</span><span>Who runs this group?</span><Network /></div><h2>Not the loudest.<br />The most connected.</h2>
    <div className="social-orbit"><div className="orbit-rings" />{featured.map((member, index) => <div key={member.id} className={`orbit-node orbit-node--${index}`}><MemberCharacter member={member} size={member.id === central?.id ? 'lg' : 'sm'} /><span>{shortName(member)}</span></div>)}</div>
    <div className="social-receipts"><span><b>Starts</b>{shortName(starters)}</span><span><b>Pulls replies</b>{shortName(replied)}</span><span><b>Keeps it alive</b>{shortName(keeper)}</span></div><p className="group-caption">{roast}</p>
  </div>
}

function PlotTwist({ headline, roast, referenced, members }: LayoutProps) {
  const fact = referenced[0]
  const member = memberFor(fact, members)
  return <div className="slide group-card group-card--twist">
    <div className="group-kicker"><span>06</span><span>The biggest plot twist</span><Zap /></div>
    <div className="twist-type" aria-hidden="true"><span>PLOT</span><span>TWIST</span></div>
    <div className="twist-reveal">{member && <MemberCharacter member={member} size="lg" />}<small>Statistically, this actually happened</small><h2>{headline}</h2><p>{roast}</p><div className="evidence-chip"><BarChart3 /> Based on {fact?.detail ?? 'the exported chat'} · {fact?.context?.confidence ?? 100}% confidence</div></div>
  </div>
}

function GroupLanguage({ referenced, roast }: LayoutProps) {
  const words = referenced.filter((fact) => fact.kind === 'repeated_phrase' && fact.detail && !fillerWords.has(fact.detail.toLocaleLowerCase()))
  const emojis = referenced.filter((fact) => fact.kind === 'top_emoji')
  const leadEmoji = emojis[0] ?? referenced.find((fact) => fact.kind === 'emoji_count')
  const languageItems = words.length >= 3 ? words.slice(0, 6) : emojis.slice(0, 5)
  return <div className="slide group-card group-card--language">
    <div className="group-kicker"><span>07</span><span>The group's language</span><Languages /></div>
    <div className="language-emoji"><span>{leadEmoji?.kind === 'top_emoji' ? leadEmoji.detail : '😂'}</span><div><small>Most-used emoji</small><strong>{format(leadEmoji?.value ?? 0)} times</strong></div></div>
    <h2>{words.length >= 3 ? 'The words and emoji this group actually used most.' : 'The export had more emoji than distinctive words.'}</h2>
    <div className="word-sculpture">{languageItems.map((fact, index) => <span key={fact.id} style={{ '--word-rank': index } as React.CSSProperties}>{fact.detail}<b>{format(fact.value)}</b></span>)}</div>
    <div className="language-translation"><small>How we counted this</small><p>Names, system lines and common English or Pidgin filler words were removed first. These are usage counts, not invented translations.</p></div><p className="group-caption">{roast}</p>
  </div>
}

function TimeCapsule({ referenced, roast }: LayoutProps) {
  const find = (kind: string) => referenced.find((fact) => fact.kind === kind)
  const byId = (id: string) => referenced.find((fact) => fact.id === id)
  const context = (fact?: Fact) => fact && !isPendingContext(fact.value) ? String(fact.value) : undefined
  const busiest = find('busiest_day'), longest = find('longest_conversation'), media = find('media_peak')
  const busiestTopic = byId('busiest_day_topic'), longestTopic = byId('longest_conversation_topic'), mediaTopic = byId('media_peak_topic')
  return <div className="slide group-card group-card--time">
    <div className="group-kicker"><span>08</span><span>The moments that defined us</span><Clock3 /></div><h2>The dates,<br />with the missing context.</h2>
    <div className="time-spine"><i /><div><small>Most active day</small><strong>{busiest?.detail ?? 'The busiest day'} · {format(busiest?.value ?? 0)} messages</strong>{context(busiestTopic) && <span>{context(busiestTopic)}</span>}</div><div><small>Longest chat run</small><strong>{longest?.detail ?? 'One very long session'} · {format(longest?.value ?? 0)} messages</strong>{context(longestTopic) && <span>{context(longestTopic)}</span>}</div>{Number(media?.value ?? 0) > 4 && <div><small>Busiest media day</small><strong>{media?.detail ?? 'Across the year'} · {format(media?.value ?? 0)} media placeholders</strong>{context(mediaTopic) && <span>{context(mediaTopic)}</span>}</div>}</div>
    <p className="group-caption">{roast}</p>
  </div>
}

function CompanyRoast({ members, roast }: LayoutProps) {
  const roles = useMemo(() => {
    const used = new Set<string>()
    const pick = (score: (member: Member) => number) => {
      const eligible = members.filter((member) => score(member) > 0)
      const available = eligible.filter((member) => !used.has(member.id))
      const member = topMember(available.length ? available : eligible, score)
      if (member) used.add(member.id)
      return member
    }
    return [
      ['CEO', pick((member) => member.starts), 'starts the meetings'],
      ['HR', pick((member) => member.sorrys), 'says sorry first'],
      ['Finance', pick((member) => member.moneyMentions ?? 0), 'mentions the money'],
      ['Security', pick((member) => member.locationQuestions ?? 0), 'asks for location'],
      ['PR', pick((member) => member.avgMessageWords ?? 0), 'writes the longest updates']
    ] as [string, DisplayMember | undefined, string][]
  }, [members])
  return <div className="slide group-card group-card--company">
    <div className="group-kicker"><span>09</span><span>If this group were a company</span><BriefcaseBusiness /></div>
    <div className="company-brand"><span>GC<span>®</span></span><small>Group Holdings & Unfinished Plans Ltd.</small></div>
    <div className="org-chart">{roles.map(([role, member, note], index) => <div key={role} className={index === 0 ? 'is-ceo' : ''}>{member ? <MemberCharacter member={member} size={index === 0 ? 'md' : 'sm'} /> : <BriefcaseBusiness />}<span><small>{role}</small><strong>{member ? shortName(member) : 'Vacant'}</strong><em>{member ? note : 'nobody qualified'}</em></span></div>)}</div>
    <div className="company-stamp">Meeting could have been a message</div><p className="group-caption">{roast}</p>
  </div>
}

function DynamicDuo({ members, roast }: LayoutProps) {
  const byId = new Map(members.map((member) => [member.id, member]))
  const anchor = members.filter((member) => member.topPartnerId && byId.has(member.topPartnerId)).sort((a, b) => (b.topPartnerReplies ?? 0) - (a.topPartnerReplies ?? 0))[0]
  // Without pair data (sample chats) say what is true: two busy repliers, not a duo.
  const duo = anchor ? [anchor, byId.get(anchor.topPartnerId!)!] : [...members].sort((a, b) => (b.repliesReceived ?? 0) - (a.repliesReceived ?? 0)).slice(0, 2)
  return <div className="slide group-card group-card--duo"><div className="group-kicker"><span>10</span><span>The dynamic duo</span><Users /></div>
    <div className="duo-title"><small>Conversation chemistry</small><h2>{anchor ? <>These two keep<br />answering each other.</> : <>Two people who<br />draw plenty replies.</>}</h2></div>
    <div className="duo-poster">{duo.map((member, index) => <div key={member.id} className={`duo-person duo-person--${index + 1}`}><MemberCharacter member={member} size="lg" /><strong>{member.name}</strong><span>{anchor ? `${format(anchor.topPartnerReplies ?? 0)} back-to-back exchanges` : `${format(member.repliesReceived ?? 0)} replies received`}</span></div>)}<b>&</b></div>
    <div className="duo-receipt"><span>Combined messages</span><strong>{format(duo.reduce((sum, member) => sum + member.messages, 0))}</strong></div><p className="group-caption">{anchor ? roast : 'Counted from who got answered most.'}</p>
  </div>
}

function ReplyRace({ members, roast }: LayoutProps) {
  const total = members.reduce((sum, member) => sum + member.messages, 0)
  const qualified = members.filter((member) => qualifiesForReplyRank(member, total))
  const ordered = [...qualified].sort((a, b) => a.avgReplyMins - b.avgReplyMins).slice(0, 6)
  const winner = ordered[0]
  const replyTime = (minutes: number) => minutes < 1 ? '<1m' : `${format(minutes)}m`
  return <div className="slide group-card group-card--reply"><div className="group-kicker"><span>11</span><span>The reply race</span><TimerReset /></div>
    <div className="reply-stopwatch"><TimerReset /><div><strong>{winner ? replyTime(winner.avgReplyMins) : '—'}</strong><span>average</span></div></div><h2>{winner ? `${winner.name} had the fastest qualified reply average.` : 'Not enough clean reply data for a fair race.'}</h2>
    <ol className="reply-lanes">{ordered.map((member, index) => <li key={member.id}><b>{index + 1}</b><span>{shortName(member)}</span><i><em style={{ width: `${Math.max(12, 100 - member.avgReplyMins / Math.max(1, ordered.at(-1)?.avgReplyMins ?? 1) * 82)}%` }} /></i><strong>{replyTime(member.avgReplyMins)}</strong></li>)}</ol><p className="group-caption">{roast}</p>
  </div>
}

function NightShift({ members, roast }: LayoutProps) {
  const ordered = members.filter((member) => member.nightMessages > 0).sort((a, b) => b.nightMessages - a.nightMessages).slice(0, 5)
  const total = members.reduce((sum, member) => sum + member.nightMessages, 0)
  return <div className="slide group-card group-card--nightshift"><div className="group-kicker"><span>12</span><span>The night shift</span><MoonStar /></div>
    <div className="night-sky" aria-hidden="true"><i>✦</i><i>·</i><i>✧</i><i>·</i><i>✦</i></div><div className="night-clock">03<span>:</span>17</div><h2>{total ? 'Normal bedtime was never part of the group rules.' : 'Everybody respected bedtime.'}</h2>
    <div className="night-roster">{ordered.map((member, index) => <div key={member.id}><MemberCharacter member={member} size={index === 0 ? 'md' : 'xs'} /><span>{shortName(member)}</span><strong>{format(member.nightMessages)}</strong></div>)}</div><div className="night-total"><span>After-midnight messages</span><strong><CountUp value={total} /></strong></div><p className="group-caption">{total ? roast : 'Not one message between midnight and five.'}</p>
  </div>
}

function MediaDesk({ members, roast }: LayoutProps) {
  const ordered = members.filter((member) => member.mediaCount + (member.linkCount ?? 0) > 0).sort((a, b) => b.mediaCount - a.mediaCount).slice(0, 4)
  return <div className="slide group-card group-card--media"><div className="group-kicker"><span>13</span><span>The media department</span><Images /></div><h2>{ordered.length ? 'Typing was only one of the available formats.' : 'This export is all text. No media or links.'}</h2>
    <div className="media-contact-sheet">{ordered.map((member, index) => <div key={member.id} style={{ '--media-tilt': `${index % 2 ? 3 : -3}deg` } as React.CSSProperties}><span className="media-placeholder"><MemberCharacter member={member} size="lg" /><Images /></span><strong>{member.name}</strong><small>{format(member.mediaCount)} media · {format(member.linkCount ?? 0)} links</small></div>)}</div>
    <div className="media-caption">Most likely to say “see attached” without saying “see attached.”</div><p className="group-caption">{roast}</p>
  </div>
}

function GhostWatch({ members, roast }: LayoutProps) {
  const ghost = clearWinner(members, (member) => member.longestSilenceHrs >= 24 ? member.longestSilenceHrs : 0)
  return <div className="slide group-card group-card--ghostwatch"><div className="group-kicker"><span>14</span><span>The vanishing act</span><Ghost /></div>
    {ghost ? <div className="missing-poster"><span>Have you seen this group member?</span><div><MemberCharacter member={ghost} size="lg" /><Ghost /></div><h2>{ghost.name}</h2><strong>Missing for {hoursOrDays(ghost.longestSilenceHrs)}</strong><p>Returned to the chat with no explanation and, statistically, no shame.</p></div>
      : <div className="missing-poster"><span>Missing persons report</span><div><Ghost /></div><h2>Case closed</h2><strong>No single disappearing act</strong><p>Nobody stood out for going quiet longer than a day.</p></div>}
    <div className="last-seen"><i />Last seen between two completely different topics</div><p className="group-caption">{ghost ? roast : 'Attendance was suspiciously good.'}</p>
  </div>
}

function LaughTrack({ members, roast, referenced, hideNames }: LayoutProps) {
  const ordered = members.filter((member) => member.laughs > 0).sort((a, b) => b.laughs - a.laughs).slice(0, 5)
  const total = members.reduce((sum, member) => sum + member.laughs, 0)
  const moment = referenced.find((fact) => fact.kind === 'laugh_moment')
  const author = memberFor(moment, members)
  const replies = hideNames ? [] : (moment?.replies ?? []).flatMap((reply) => { const member = members.find((item) => item.id === reply.memberId); return member ? [{ member, text: reply.text }] : [] })
  return <div className={`slide group-card group-card--laughtrack ${replies.length ? 'has-replies' : ''}`}><div className="group-kicker"><span>15</span><span>The laugh track</span><Laugh /></div>
    <div className="laugh-face">😂<span>{format(moment?.value ?? total)}</span></div><h2>{moment ? 'Most people laughed right after this one.' : ordered.length ? 'Who sent the most laugh messages?' : 'No laughs showed up in this export.'}</h2>
    {moment ? <div className="laugh-moment">{hideNames ? <blockquote>Message hidden while names are hidden.</blockquote> : moment.detail ? <blockquote>“{moment.detail}”</blockquote> : <blockquote>The message itself is not saved on this device.</blockquote>}<span>{author ? `Sent by ${author.name} · ` : ''}{format(moment.value)} people sent a laugh after it</span>{replies.length > 0 && <div className="laugh-replies"><small>Replies after this</small><ul>{replies.map((reply) => <li key={reply.member.id}><b>{shortName(reply.member)}</b>{reply.text}</li>)}</ul></div>}</div> : <div className="laugh-board">{ordered.map((member, index) => <div key={member.id}><b>{index + 1}</b><span>{shortName(member)}</span><strong>{format(member.laughs)}</strong></div>)}</div>}<p className="group-caption">{roast}</p>
  </div>
}

function ConversationSpark({ members, roast }: LayoutProps) {
  const starter = topMember(members, (member) => member.starts)
  const leader = clearWinner(members, (member) => member.starts)
  const ordered = [...members].sort((a, b) => b.starts - a.starts).slice(0, 5)
  return <div className="slide group-card group-card--spark"><div className="group-kicker"><span>16</span><span>Who keeps pressing start?</span><Zap /></div>
    <div className="spark-match"><i /><Flame /><span>Fresh topic<br />loading…</span></div><h2>{leader ? `${leader.name} refuses to let silence win.` : 'The fresh topics are evenly shared.'}</h2>
    <div className="spark-count"><strong><CountUp value={starter.starts} /></strong><span>conversations started</span></div><div className="spark-board">{ordered.map((member, index) => <span key={member.id}><b>{shortName(member)}</b><i><em style={{ width: `${member.starts / Math.max(1, starter.starts) * 100}%` }} /></i><small>{format(member.starts)}</small></span>)}</div><p className="group-caption">{roast}</p>
  </div>
}

function GroupPulse({ referenced, roast }: LayoutProps) {
  const find = (kind: string) => referenced.find((fact) => fact.kind === kind)
  const busiest = find('busiest_day'), average = find('avg_messages_day'), active = find('active_days')
  return <div className="slide group-card group-card--pulse"><div className="group-kicker"><span>17</span><span>The group pulse</span><Activity /></div><h2>Alive, typing<br />and occasionally critical.</h2>
    <div className="pulse-monitor"><svg viewBox="0 0 320 90" role="img" aria-label="Group activity pulse"><path d="M0 52h48l10-18 13 41 18-67 17 45h26l10-20 12 39 18-61 17 42h33l10-15 11 29 14-49 15 35h50" /></svg><span>LIVE</span></div>
    <div className="pulse-stats"><div><small>Most active day</small><strong>{busiest?.detail ?? '—'}</strong><span>{format(busiest?.value ?? 0)} messages</span></div><div><small>Daily resting rate</small><strong>{format(average?.value ?? 0)}</strong><span>messages per day</span></div><div><small>Active days</small><strong>{format(active?.value ?? 0)}</strong><span>days online</span></div></div><p className="group-caption">{roast}</p>
  </div>
}

function MemoryVault({ referenced, roast }: LayoutProps) {
  const find = (kind: string) => referenced.find((fact) => fact.kind === kind)
  const words = referenced.filter((fact) => fact.kind === 'repeated_phrase')
  const longest = find('longest_conversation'), busiest = find('busiest_day'), media = find('media_peak')
  return <div className="slide group-card group-card--memory"><div className="group-kicker"><span>18</span><span>The memory vault</span><BookHeart /></div><h2>The things this group will remember.</h2>
    <div className="memory-scrapbook"><div className="memory-photo"><span>{find('top_emoji')?.detail ?? '😂'}</span><small>The recurring mood</small></div><div className="memory-note"><small>Longest conversation</small><strong>{longest?.detail ?? 'One very long day'}</strong><span>{format(longest?.value ?? 0)} messages</span></div><div className="memory-ticket"><small>Defining topic</small><strong>“{words[0]?.detail ?? 'the usual'}”</strong><span>{format(words[0]?.value ?? 0)} mentions</span></div><div className="memory-date"><small>The day</small><strong>{busiest?.detail ?? '—'}</strong><span>{format(busiest?.value ?? 0)} messages · {format(media?.value ?? 0)} media drops</span></div></div>
    <div className="memory-words">{words.slice(1, 5).map((fact) => <span key={fact.id}>{fact.detail}</span>)}</div><p className="group-caption">{roast}</p>
  </div>
}

function MovieFinale({ referenced, members, roast }: LayoutProps) {
  const messages = referenced.find((fact) => fact.kind === 'total_messages')?.value ?? 0
  const verdict = referenced.find((fact) => fact.kind === 'verdict')
  const context = referenced.filter((fact) => fact.kind === 'topic_context' && !isPendingContext(fact.value)).map((fact) => String(fact.value)).slice(0, 2)
  const cast = members.slice(0, 7)
  const lead = topMember(members, (member) => member.messages)
  const mediaRate = members.reduce((sum, member) => sum + member.mediaCount, 0) / Math.max(1, Number(messages))
  const genres = mediaRate > .08 ? ['Comedy', 'Found footage', 'Mystery'] : lead.sharePct > 30 ? ['Comedy', 'Biopic', 'Thriller'] : ['Comedy', 'Ensemble', 'Documentary']
  return <div className="slide group-card group-card--movie">
    <div className="movie-grain" /><div className="movie-billing"><span>19 · A {members.length}-person production</span><Clapperboard /></div>
    <div className="movie-title"><small>The group as a film</small><h2>{String(verdict?.value ?? 'A very long story with no quiet cast')}</h2><span>{shortName(lead)} sent the most messages in the ensemble</span></div>
    <div className="movie-cast">{cast.map((member, index) => <div key={member.id} className={member.id === lead?.id ? 'is-lead' : ''} style={{ '--cast-index': index } as React.CSSProperties}><MemberCharacter member={member} size="md" /></div>)}</div>
    <div className="movie-genre">{genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
    <blockquote>“{roast}”</blockquote><p className="movie-storyline">{context[0] || `${format(messages)} messages, one cast, and no single plot that could contain them.`}</p><div className="movie-credits">Starring {cast.map(shortName).join(' · ')}</div><div className="movie-rating">GC<br /><b>∞</b></div>
  </div>
}

function FinalVerdict({ referenced, members, roast }: LayoutProps) {
  const verdict = referenced.find((fact) => fact.kind === 'verdict')
  const messages = referenced.find((fact) => fact.kind === 'total_messages')?.value ?? 0
  const lead = topMember(members, (member) => member.messages)
  return <div className="slide group-card group-card--final"><div className="final-rays" /><div className="group-kicker"><span>20</span><span>The final verdict</span><Sparkles /></div>
    <div className="final-seal"><span>OFFICIAL<br />GROUP<br />FINDING</span></div><small className="final-overline">After reviewing {format(messages)} messages</small><h2>{verdict?.value ?? 'Everybody brought something nobody else could.'}</h2>
    <blockquote>“{roast}”</blockquote><p>{verdict?.detail ?? `${lead.name} may lead the typing, but the group only works because everybody adds a different kind of trouble.`}</p>
    <div className="final-cast">{members.slice(0, 9).map((member) => <MemberCharacter key={member.id} member={member} size="md" />)}</div><div className="final-signoff">Somehow, it works. <strong>Keep the group.</strong></div>
  </div>
}

const layouts: Record<LayoutType, (props: LayoutProps) => React.ReactNode> = { cover: Cover, bigNumber: BigNumber, leaderboard: Leaderboard, versus: Versus, quote: Quote, timeline: Timeline, award: Award, wordCloud: WordCloud, heatmap: Heatmap, verdict: Verdict, groupNumbers: GroupNumbers, yapLeaderboard: YapLeaderboard, characterCast: CharacterCast, groupAwards: GroupAwards, socialGraph: SocialGraph, plotTwist: PlotTwist, groupLanguage: GroupLanguage, timeCapsule: TimeCapsule, companyRoast: CompanyRoast, dynamicDuo: DynamicDuo, replyRace: ReplyRace, nightShift: NightShift, mediaDesk: MediaDesk, ghostWatch: GhostWatch, laughTrack: LaughTrack, conversationSpark: ConversationSpark, groupPulse: GroupPulse, memoryVault: MemoryVault, movieFinale: MovieFinale, finalVerdict: FinalVerdict, highlights: Highlights, split: Split, monthly: Monthly, hourly: Hourly, quietGap: QuietGap, emojiBoard: EmojiBoard, calls: Calls }

// Which cards get a shower, and of what. The chat's own emojis come first.
function rainFor(layout: LayoutType, facts: Fact[]) {
  const own = facts.filter((fact) => fact.kind === 'top_emoji' && fact.detail).map((fact) => fact.detail!)
  if (layout === 'emojiBoard' || layout === 'groupLanguage') return own
  if (layout === 'laughTrack') return ['😂', '🤣']
  if (layout === 'cover' || layout === 'groupNumbers') return own.length ? own.slice(0, 4) : ['💬', '✨']
  if (layout === 'verdict' || layout === 'finalVerdict') return ['🎉', '✨', ...own.slice(0, 2)]
  return []
}

export function CardRenderer({ still = false, ...props }: Props & { still?: boolean }) {
  return <StillContext.Provider value={still}><Slide {...props} /></StillContext.Provider>
}

function Slide({ card, facts, members, savage, hideNames, preview, watermark = true, view, onView }: Props) {
  const motionless = useStill()
  const referenced = card.factIds.map((id) => facts.find((fact) => fact.id === id)).filter(Boolean) as Fact[]
  const displayMembers = useMemo(() => toDisplayMembers(members, hideNames), [hideNames, members])
  const headline = resolveTemplate(card.headline, referenced, displayMembers)
  const roast = resolveTemplate(savage && card.savageRoast ? card.savageRoast : card.roast, referenced, displayMembers)
  const Layout = layouts[card.layout]
  return <ErrorBoundary scope={`card-${card.layout}`} fallback={<div className="card-fallback"><p>This card couldn’t load.</p><small>C-302 · Skip to the next card.</small></div>}><div className={`story-slide story-slide--${card.layout} ${motionless ? '' : 'is-animated'}`}><EmojiRain emojis={rainFor(card.layout, facts)} /><Layout {...{ card, facts, members: displayMembers, savage, hideNames, referenced, headline, roast, view, onView }} />{preview && <div className="preview-ribbon">PREVIEW ONLY · EXPORT LOCKED</div>}{watermark && <div className="slide-watermark">{brand.domain}</div>}</div></ErrorBoundary>
}
