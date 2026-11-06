import { Award as AwardIcon, Clock3, Crown, Flame, MessageCircle, MoonStar, PartyPopper, Quote as QuoteIcon, Trophy, Zap } from 'lucide-react'
import type { Card, Fact, LayoutType, Member } from '../analysis/types'
import { resolveTemplate } from '../analysis/planCards'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { MemberCharacter } from '../components/MemberCharacter'
import { brand } from '../config/brand'

type Props = { card: Card; facts: Fact[]; members: Member[]; savage: boolean; hideNames: boolean; preview?: boolean; watermark?: boolean }
type LayoutProps = Props & { referenced: Fact[]; headline: string; roast: string }
const format = (value: string | number) => typeof value === 'number' ? new Intl.NumberFormat('en-GB').format(value) : value

const memberFor = (fact: Fact | undefined, members: Member[]) => members.find((member) => member.id === fact?.memberIds[0])

function Cover({ headline, referenced, roast, members }: LayoutProps) {
  const total = referenced.find((fact) => fact.kind === 'total_messages')
  const range = referenced.find((fact) => fact.kind === 'date_range')
  return <div className="slide slide--cover"><div className="slide__topline"><span>CHAT WRAPPED</span><PartyPopper /></div><div className="cover__title"><h2>{headline}</h2><p>{range?.value}</p></div><div className="cover__characters" aria-label="People inside this chat">{members.slice(0, 8).map((member) => <MemberCharacter key={member.id} member={member} size="md" />)}{members.length > 8 && <b>+{members.length - 8}</b>}</div><div className="cover__count"><strong>{format(total?.value ?? 0)}</strong><span>messages.<br />Na wetin export show be this.</span></div><div className="cover__stamp">{roast}</div></div>
}
function BigNumber({ headline, referenced, roast, members }: LayoutProps) {
  const featured = memberFor(referenced[0], members)
  return <div className={`slide slide--numbers ${referenced.length === 1 ? 'slide--single-number' : ''}`}><div className="slide__topline"><span>NA THE NUMBER BE THIS</span><MessageCircle /></div>{featured && <div className="slide-person"><MemberCharacter member={featured} size="md" /><span>{featured.name}</span></div>}<h2>{headline}</h2><div className="number-grid">{referenced.slice(0,4).map((fact) => <div key={fact.id}><strong>{format(fact.value)}</strong><span>{fact.detail ?? fact.kind.replaceAll('_',' ')}</span></div>)}</div><p className="slide__roast">{roast}</p></div>
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
function Quote({ headline, referenced, roast }: LayoutProps) { return <div className="slide slide--quote"><div className="slide__topline"><span>WETIN ENTER CHAT</span><QuoteIcon /></div><div className="quote-mark">“</div><h2>{headline}</h2><div className="quote-detail">{referenced[0]?.detail}</div><p className="slide__roast">{roast}</p></div> }
function Timeline({ headline, referenced, roast, members }: LayoutProps) {
  const fact = referenced[0]
  const featured = memberFor(fact, members)
  const evidenceWidth = Math.min(100, Math.max(8, (fact?.context?.ratioToAverage ?? 1) * 50))
  return <div className="slide slide--timeline"><div className="slide__topline"><span>HOW E TAKE HAPPEN</span><Clock3 /></div>{featured && <div className="slide-person"><MemberCharacter member={featured} size="md" /><span>{featured.name}</span></div>}<h2>{headline}</h2><div className="timeline-line"><i aria-hidden="true"><em style={{ width: `${evidenceWidth}%` }} /></i><b>{format(fact?.value ?? 0)}</b><span>{fact?.detail}</span></div><p className="slide__roast">{roast}</p></div>
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

const layouts: Record<LayoutType, (props: LayoutProps) => React.ReactNode> = { cover: Cover, bigNumber: BigNumber, leaderboard: Leaderboard, versus: Versus, quote: Quote, timeline: Timeline, award: Award, wordCloud: WordCloud, heatmap: Heatmap, verdict: Verdict }

export function CardRenderer({ card, facts, members, savage, hideNames, preview, watermark = true }: Props) {
  const referenced = card.factIds.map((id) => facts.find((fact) => fact.id === id)).filter(Boolean) as Fact[]
  const displayMembers = members.map((member,index)=>({...member,name:hideNames?`Member ${index+1}`:member.name}))
  const headline = resolveTemplate(card.headline, referenced, displayMembers)
  const roast = resolveTemplate(savage && card.savageRoast ? card.savageRoast : card.roast, referenced, displayMembers)
  const Layout = layouts[card.layout]
  return <ErrorBoundary scope={`card-${card.layout}`} fallback={<div className="card-fallback"><p>This card couldn’t load.</p><small>C-302 · Skip to the next card.</small></div>}><div className="story-slide"><Layout {...{ card, facts, members: displayMembers, savage, hideNames, referenced, headline, roast }} />{preview && <div className="preview-ribbon">PREVIEW ONLY · EXPORT LOCKED</div>}{watermark && <div className="slide-watermark">{brand.domain}</div>}</div></ErrorBoundary>
}
