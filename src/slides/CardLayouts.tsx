import { Award as AwardIcon, Clock3, Crown, Flame, MessageCircle, MoonStar, PartyPopper, Quote as QuoteIcon, Trophy, Zap } from 'lucide-react'
import type { Card, Fact, LayoutType, Member } from '../analysis/types'
import { resolveTemplate } from '../analysis/planCards'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { brand } from '../config/brand'

type Props = { card: Card; facts: Fact[]; members: Member[]; savage: boolean; hideNames: boolean; preview?: boolean; watermark?: boolean }
type LayoutProps = Props & { referenced: Fact[]; headline: string; roast: string }
const format = (value: string | number) => typeof value === 'number' ? new Intl.NumberFormat('en-GB').format(value) : value

function Cover({ headline, referenced, roast }: LayoutProps) {
  const total = referenced.find((fact) => fact.kind === 'total_messages')
  const range = referenced.find((fact) => fact.kind === 'date_range')
  return <div className="slide slide--cover"><div className="slide__topline"><span>CHAT WRAPPED</span><PartyPopper /></div><div className="cover__title"><h2>{headline}</h2><p>{range?.value}</p></div><div className="cover__count"><strong>{format(total?.value ?? 0)}</strong><span>messages.<br />The evidence is ready.</span></div><div className="cover__stamp">{roast}</div></div>
}
function BigNumber({ headline, referenced, roast }: LayoutProps) {
  return <div className={`slide slide--numbers ${referenced.length === 1 ? 'slide--single-number' : ''}`}><div className="slide__topline"><span>THE RECEIPTS</span><MessageCircle /></div><h2>{headline}</h2><div className="number-grid">{referenced.slice(0,4).map((fact) => <div key={fact.id}><strong>{format(fact.value)}</strong><span>{fact.detail ?? fact.kind.replaceAll('_',' ')}</span></div>)}</div><p className="slide__roast">{roast}</p></div>
}
function Leaderboard({ headline, referenced, roast, members }: LayoutProps) {
  return <div className="slide slide--rank"><div className="slide__topline"><span>THE LEADERBOARD</span><Crown /></div><h2>{headline}</h2><div className="leaderboard">{referenced.map((fact,i) => <div key={fact.id}><b>{i+1}</b><span>{members.find(m=>m.id===fact.memberIds[0])?.name ?? 'Member'}</span><i><em style={{width:`${Math.max(12, 100-i*15)}%`}} /></i><strong>{format(fact.value)}</strong></div>)}</div><p className="slide__roast">{roast}</p></div>
}
function Versus({ headline, referenced, roast, members }: LayoutProps) {
  return <div className="slide slide--rank"><div className="slide__topline"><span>HEAD TO HEAD</span><Zap /></div><h2>{headline}</h2><div className="duel">{referenced.slice(0,2).map((fact,i)=><div className={i===0?'is-winner':''} key={fact.id}><span>{members.find(m=>m.id===fact.memberIds[0])?.name ?? 'Member'}</span><strong>{format(fact.value)}</strong><small>{fact.detail}</small></div>)}</div><p className="slide__roast">{roast}</p></div>
}
function Quote({ headline, referenced, roast }: LayoutProps) { return <div className="slide slide--quote"><div className="slide__topline"><span>CAUGHT IN THE CHAT</span><QuoteIcon /></div><div className="quote-mark">“</div><h2>{headline}</h2><div className="quote-detail">{referenced[0]?.detail}</div><p className="slide__roast">{roast}</p></div> }
function Timeline({ headline, referenced, roast }: LayoutProps) { return <div className="slide slide--timeline"><div className="slide__topline"><span>THE TIMELINE</span><Clock3 /></div><h2>{headline}</h2><div className="timeline-line"><i/><b>{format(referenced[0]?.value ?? 0)}</b><span>{referenced[0]?.detail}</span></div><p className="slide__roast">{roast}</p></div> }
function Award({ headline, referenced, roast }: LayoutProps) { return <div className="slide slide--awards"><div className="slide__topline"><span>AWARD UNLOCKED</span><AwardIcon /></div><div className="trophy"><Trophy /></div><h2>{headline}</h2><div className="award-card"><strong>{referenced[0]?.kind.replaceAll('_',' ')}</strong><span>{format(referenced[0]?.value ?? 0)} · {referenced[0]?.detail}</span></div><p className="slide__roast">{roast}</p></div> }
function WordCloud({ headline, referenced, roast }: LayoutProps) {
  const maximum = Math.max(1, ...referenced.map((fact) => Number(fact.value) || 0))
  return <div className="slide slide--phrases">
    <div className="slide__topline"><span>MOST REPEATED</span><Flame /></div>
    <h2>{headline}</h2>
    <ol className="phrase-chart" aria-label="Most repeated words, ranked by appearances">
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
function Heatmap({ headline, referenced, roast, members }: LayoutProps) { return <div className="slide slide--night"><div className="slide__topline"><span>AFTER DARK</span><MoonStar /></div><h2>{headline}</h2><div className="heatmap">{Array.from({length:28},(_,i)=><i key={i} style={{opacity:.16+((i*7+Number(referenced[0]?.value??1))%9)/11}} />)}</div><div className="night__receipt"><span>{members.find(m=>m.id===referenced[0]?.memberIds[0])?.name ?? 'The chat'}</span><strong>{format(referenced[0]?.value ?? 0)}</strong></div><p className="slide__roast">{roast}</p></div> }
function Verdict({ headline, roast, members }: LayoutProps) { return <div className="slide slide--verdict"><div className="slide__topline"><span>THE FINAL VERDICT</span><PartyPopper /></div><div className="verdict__seal">YOUR CHAT TYPE</div><h2>{headline}</h2><p>{roast}</p><div className="verdict__members">{members.slice(0,7).map((m)=><span key={m.id}>{m.name.charAt(0)}</span>)}</div><div className="verdict__cta">Make yours at <strong>{brand.domain}</strong></div></div> }

const layouts: Record<LayoutType, (props: LayoutProps) => React.ReactNode> = { cover: Cover, bigNumber: BigNumber, leaderboard: Leaderboard, versus: Versus, quote: Quote, timeline: Timeline, award: Award, wordCloud: WordCloud, heatmap: Heatmap, verdict: Verdict }

export function CardRenderer({ card, facts, members, savage, hideNames, preview, watermark = true }: Props) {
  const referenced = card.factIds.map((id) => facts.find((fact) => fact.id === id)).filter(Boolean) as Fact[]
  const displayMembers = members.map((member,index)=>({...member,name:hideNames?`Member ${index+1}`:member.name}))
  const headline = resolveTemplate(card.headline, referenced, displayMembers)
  const roast = resolveTemplate(savage && card.savageRoast ? card.savageRoast : card.roast, referenced, displayMembers)
  const Layout = layouts[card.layout]
  return <ErrorBoundary scope={`card-${card.layout}`} fallback={<div className="card-fallback"><p>This card couldn’t load.</p><small>C-302 · Skip to the next card.</small></div>}><div className="story-slide"><Layout {...{ card, facts, members: displayMembers, savage, hideNames, referenced, headline, roast }} />{preview && <div className="preview-ribbon">PREVIEW ONLY · EXPORT LOCKED</div>}{watermark && <div className="slide-watermark">{brand.domain}</div>}</div></ErrorBoundary>
}
