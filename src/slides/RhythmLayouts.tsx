import { BarChart3, CalendarDays, Clock3, MoonStar, Phone, PieChart, Smile } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Fact } from '../analysis/types'
import type { DisplayMember } from '../analysis/memberNames'
import { MemberCharacter } from '../components/MemberCharacter'
import { CountUp } from './motion'
import { TopicNote } from './TopicNote'
import { topicOf } from '../analysis/topics'

type Props = { headline: string; roast: string; referenced: Fact[]; members: DisplayMember[]; facts: Fact[] }
const format = (value: number | string) => typeof value === 'number' ? new Intl.NumberFormat('en-GB').format(value) : value

function Frame({ label, icon, headline, roast, children }: { label: string; icon: ReactNode; headline: string; roast: string; children: ReactNode }) {
  return <div className="slide slide--calendar"><div className="slide__topline"><span>{label}</span>{icon}</div><h2>{headline}</h2><div className="calendar-body">{children}</div><p className="slide__roast">{roast}</p></div>
}

function Bars({ fact, every }: { fact?: Fact; every: number }) {
  const series = fact?.series ?? []
  const max = Math.max(1, ...series.map((item) => item.value))
  return <div className="bar-chart" role="img" aria-label={series.map((item) => `${item.label}: ${item.value}`).join(', ')}>
    {series.map((item, index) => <div key={index} className={item.value === max ? 'is-peak' : ''}><i style={{ height: `${item.value / max * 100}%` }} /><span>{index % every === 0 ? item.label : ''}</span></div>)}
  </div>
}

export function Highlights({ headline, roast, referenced, facts }: Props) {
  const label: Record<string, string> = { active_days: 'days you talked', longest_streak: 'days in a row', longest_conversation: 'messages in one run', weekday_peak: 'your busiest weekday' }
  return <Frame label="CHAT HIGHLIGHTS" icon={<CalendarDays />} headline={headline} roast={roast}>
    <div className="stat-tiles">{referenced.map((fact) => <div key={fact.id}><strong><CountUp value={fact.id === 'weekday_peak' ? fact.detail ?? '' : fact.value} /></strong><span>{label[fact.id]}</span></div>)}</div>
    <TopicNote label="THAT LONG RUN" text={topicOf('longest_conversation', facts)} />
  </Frame>
}

export function Monthly({ headline, roast, referenced, facts }: Props) {
  return <Frame label="MONTH BY MONTH" icon={<BarChart3 />} headline={headline} roast={roast}><Bars fact={referenced[0]} every={referenced[0]?.series && referenced[0].series.length > 8 ? 2 : 1} /><TopicNote label="THAT MONTH" text={topicOf('month_series', facts)} /></Frame>
}

export function Hourly({ headline, roast, referenced }: Props) {
  return <Frame label="ROUND THE CLOCK" icon={<Clock3 />} headline={headline} roast={roast}><Bars fact={referenced[0]} every={6} /></Frame>
}

export function QuietGap({ headline, roast, referenced }: Props) {
  return <Frame label="THE QUIET STRETCH" icon={<MoonStar />} headline={headline} roast={roast}>
    <div className="big-count"><strong><CountUp value={referenced[0]?.value ?? 0} /></strong><span>days without one message</span></div>
  </Frame>
}

export function Split({ headline, roast, referenced, members }: Props) {
  const rows = referenced.flatMap((fact) => { const member = members.find((item) => item.id === fact.memberIds[0]); return member ? [{ member, count: Number(fact.value) }] : [] })
  const total = Math.max(1, rows.reduce((sum, row) => sum + row.count, 0))
  const first = Math.round((rows[0]?.count ?? 0) / total * 100)
  const share = (index: number) => index === 0 ? first : 100 - first
  return <Frame label="MESSAGE SPLIT" icon={<PieChart />} headline={headline} roast={roast}>
    <div className="donut" style={{ background: `conic-gradient(var(--accent) 0 ${first}%, var(--surface) ${first}% 100%)` }} role="img" aria-label={rows.map((row, index) => `${row.member.name}: ${share(index)} percent`).join(', ')}><b /></div>
    <ul className="split-legend">{rows.map((row, index) => <li key={row.member.id}><i data-second={index === 1} /><MemberCharacter member={row.member} size="xs" /><span>{row.member.name}<small>{format(row.count)} messages</small></span><strong><CountUp value={share(index)} />%</strong></li>)}</ul>
  </Frame>
}

export function EmojiBoard({ headline, roast, referenced }: Props) {
  const max = Math.max(1, ...referenced.map((fact) => Number(fact.value)))
  return <Frame label="TOP EMOJIS" icon={<Smile />} headline={headline} roast={roast}>
    <ol className="emoji-board">{referenced.map((fact) => <li key={fact.id}><span>{fact.detail}</span><i><em style={{ width: `${Math.max(8, Number(fact.value) / max * 100)}%` }} /></i><strong>{format(fact.value)}</strong></li>)}</ol>
  </Frame>
}

export function Calls({ headline, roast, referenced }: Props) {
  const total = referenced.find((fact) => fact.id === 'call_total')
  const minutes = Number(referenced.find((fact) => fact.id === 'call_minutes')?.value ?? 0)
  return <Frame label="CALL LOG" icon={<Phone />} headline={headline} roast={roast}>
    <div className="big-count"><strong><CountUp value={minutes} /></strong><span>minutes on call</span></div>
    <div className="stat-tiles stat-tiles--three">{total?.series?.map((item) => <div key={item.label}><strong><CountUp value={item.value} /></strong><span>{item.label.toLowerCase()}</span></div>)}</div>
  </Frame>
}
