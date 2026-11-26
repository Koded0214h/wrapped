import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, LockKeyhole } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { RealCard, type Sample } from '../components/RealCard'
import { getAnalysis } from '../analysis/getAnalysis'
import { useApp } from '../store/useApp'
import { track } from '../lib/telemetry'
import { appConfig, privacyCopy } from '../config/appConfig'
import { brand } from '../config/brand'
import { KodedMark, credit } from '../components/KodedLabs'

type Kind = 'dm' | 'group'

/** The two sample chats, run through the same analysis a real upload gets. */
function useSampleCards() {
  const [cards, setCards] = useState<{ decks: Record<Kind, Sample[]>; rail: { sample: Sample; caption: string; kind: string }[] }>()
  useEffect(() => {
    let live = true
    void Promise.all([getAnalysis('group', { mock: 'friends' }), getAnalysis('dm', { mock: 'couple' })]).then(([group, couple]) => {
      if (!live) return
      const tag = (analysis: typeof group, layout: string, theme?: Sample['theme']): Sample => ({ analysis, layout, theme })
      setCards({
        decks: {
          dm: [tag(couple, 'split'), tag(couple, 'emojiBoard'), tag(couple, 'calls'), tag(couple, 'hourly')],
          group: [tag(group, 'groupNumbers'), tag(group, 'yapLeaderboard'), tag(group, 'ghostWatch'), tag(group, 'companyRoast')]
        },
        rail: [
          { sample: tag(couple, 'quietGap'), caption: 'When you both go quiet.', kind: '1:1' },
          { sample: tag(group, 'characterCast'), caption: 'Everybody gets a character.', kind: 'Group' },
          { sample: tag(couple, 'hourly'), caption: 'Your peak gist hour.', kind: '1:1' },
          { sample: tag(group, 'nightShift'), caption: 'Who no dey sleep.', kind: 'Group' },
          { sample: tag(couple, 'calls'), caption: 'Calls count too.', kind: '1:1' },
          { sample: tag(group, 'companyRoast'), caption: 'Your group, as a company.', kind: 'Group' },
          { sample: tag(couple, 'emojiBoard'), caption: 'The emojis you live by.', kind: '1:1' },
          { sample: tag(group, 'finalVerdict'), caption: 'One verdict to end it.', kind: 'Group' }
        ]
      })
    })
    return () => { live = false }
  }, [])
  return cards
}

function Deck({ decks }: { decks?: Record<Kind, Sample[]> }) {
  const [kind, setKind] = useState<Kind>('dm')
  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)
  const reduced = useReducedMotion()
  const samples = decks?.[kind]
  // Deals through one kind of chat, then moves to the other, so both get seen without a tap.
  const next = () => {
    if (!samples) return
    if (index + 1 < samples.length) setIndex(index + 1)
    else { setKind(kind === 'dm' ? 'group' : 'dm'); setIndex(0) }
  }
  useEffect(() => {
    if (!samples || held || reduced) return
    const timer = window.setTimeout(next, 4200)
    return () => clearTimeout(timer)
  }, [held, index, kind, reduced, samples])
  const choose = (value: Kind) => { setKind(value); setIndex(0) }
  return <div className="deck" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
    <div className="deck__switch" role="group" aria-label="Which kind of chat to preview">
      <button aria-pressed={kind === 'dm'} onClick={() => choose('dm')}>1:1 chat</button>
      <button aria-pressed={kind === 'group'} onClick={() => choose('group')}>Group chat</button>
    </div>
    <div className="deck__stack">
      <div className="deck__under deck__under--one" />
      <div className="deck__under deck__under--two" />
      {samples && <div className="deck__top" key={`${kind}-${index}`}><RealCard sample={samples[index]} /></div>}
      <button className="deck__hit" onClick={next} aria-label="Show the next sample card" />
    </div>
    <p className="deck__note">Real cards from made-up chats. Tap to deal the next one.</p>
  </div>
}

const steps = [
  ['Export the chat', 'In WhatsApp, open the chat. On iPhone tap the name, then Export Chat. On Android tap the three dots, More, then Export chat. Choose Without media.'],
  ['Drop the file here', 'The .txt or .zip goes straight in. Groups and 1:1 chats both work.'],
  ['Post the ones that sting', 'Swipe through, save the cards you love, and send them back to the group.']
]

export function Landing({ openPrivacy }: { openPrivacy: () => void }) {
  const setStep = useApp((s) => s.setStep)
  const cards = useSampleCards()
  useEffect(() => { track('landing_view'); if (new URLSearchParams(location.search).has('ref')) track('referral_landing', { ref: new URLSearchParams(location.search).get('ref')?.slice(0,40) ?? '' }) }, [])
  const begin = () => { setStep('choose'); window.scrollTo(0, 0) }
  const sample = () => { setStep('upload'); window.scrollTo(0, 0) }
  const price = appConfig.freeAccess ? 'Free, with every theme included.' : 'Free to make and download. Pay only for a custom look.'
  return <main className="landing">
    <nav className="landing__nav"><div className="landing__brand"><Brand /><a className="studio-credit" href={brand.studioUrl} target="_blank" rel="noreferrer"><KodedMark />{credit}</a></div><button className="text-link" onClick={openPrivacy}><LockKeyhole size={16} /> Privacy</button></nav>

    <section className="hero">
      <div className="hero__copy">
        <h1>Your chat, exposed.</h1>
        <p>Your person or your whole group. Drop the WhatsApp export and get a one-of-one deck about who carries the gist, who ghosts, and who is awake at 3am.</p>
        <div className="hero__actions">
          <Button onClick={begin}>Get yours in 30 seconds <ArrowUpRight size={20} /></Button>
          <button className="sample-link" onClick={sample}>or try it with a sample chat</button>
        </div>
        <p className="hero__price">{price}</p>
        <div className="trust"><LockKeyhole size={17} /><span>{privacyCopy.short}</span></div>
      </div>
      <Deck decks={cards?.decks} />
    </section>

    <section className="inside" aria-labelledby="inside-title">
      <h2 id="inside-title">Nobody escapes the cards.</h2>
      <p>Two people or two hundred. Every number comes from your own chat.</p>
      <ul className="rail" tabIndex={0} aria-label="More sample cards, scroll sideways">
        {cards?.rail.map(({ sample: item, caption, kind }) => <li key={caption}><RealCard sample={item} still /><span>{caption}<small>{kind}</small></span></li>)}
      </ul>
    </section>

    <section className="how" aria-labelledby="how-title">
      <h2 id="how-title">From chat to cards in three moves.</h2>
      <ol>{steps.map(([title, copy]) => <li key={title}><h3>{title}</h3><p>{copy}</p></li>)}</ol>
    </section>

    <section className="safe" aria-labelledby="safe-title">
      <h2 id="safe-title">Your gist is your business.</h2>
      <div>
        <p>{privacyCopy.short}</p>
        <p>Turn on <strong>Hide names</strong> before you post, and everybody becomes Member 1, Member 2.</p>
        <button className="text-link" onClick={openPrivacy}>Read the privacy details <ArrowRight size={16} /></button>
      </div>
    </section>

    <section className="closer">
      <h2>Who dey keep who up?</h2>
      <Button onClick={begin}>Find out now <ArrowUpRight size={20} /></Button>
    </section>

    <footer className="landing__foot">
      <a className="studio-credit studio-credit--foot" href={brand.studioUrl} target="_blank" rel="noreferrer"><KodedMark />{brand.productName}, {credit.replace('A ', 'a ')}</a>
      <span>For chats exported from WhatsApp. Not affiliated with WhatsApp.</span>
      <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
    </footer>
  </main>
}
