import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, LockKeyhole } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { RealCard, type Sample } from '../components/RealCard'
import { getAnalysis } from '../analysis/getAnalysis'
import { useApp } from '../store/useApp'
import { track } from '../lib/telemetry'
import { appConfig, privacyCopy } from '../config/appConfig'
import { brand } from '../config/brand'
import { KodedMark, credit } from '../components/KodedLabs'
import { friendMessages } from '../landing3d/messages'

// The 3D scenes load after the page, in their own chunk, so the first paint stays light.
const HeroStage = lazy(() => import('../landing3d/stages').then((module) => ({ default: module.HeroStage })))
const FriendsStage = lazy(() => import('../landing3d/stages').then((module) => ({ default: module.FriendsStage })))
const EmojiStage = lazy(() => import('../landing3d/stages').then((module) => ({ default: module.EmojiStage })))

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
          { sample: tag(group, 'yapLeaderboard', 'bubblegum'), caption: 'Who yaps, ranked.', kind: 'Group' },
          { sample: tag(couple, 'split', 'midnight'), caption: 'Who types more.', kind: '1:1' },
          { sample: tag(group, 'groupAwards', 'lagos'), caption: 'Awards nobody asked for.', kind: 'Group' },
          { sample: tag(couple, 'monthly', 'mint'), caption: 'Your busiest month.', kind: '1:1' },
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

/** Words drop in one after another, with a little tumble, when the title scrolls into view. */
function DropTitle({ text, id, as: Tag = 'h2' }: { text: string; id?: string; as?: 'h1' | 'h2' }) {
  const reduced = useReducedMotion()
  const MotionTag = Tag === 'h1' ? motion.h1 : motion.h2
  return <MotionTag id={id} aria-label={text} initial={reduced ? false : 'hidden'} whileInView="shown" viewport={{ once: true, amount: 0.6 }} transition={{ staggerChildren: 0.07 }}>
    {text.split(' ').map((word, index) => <motion.span key={index} aria-hidden="true" className="drop-word" variants={{ hidden: { opacity: 0, y: -70, rotate: index % 2 ? 8 : -8 }, shown: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 15 } } }}>{word}</motion.span>)}
  </MotionTag>
}

/** Rises into place as it scrolls into view. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 46, scale: 0.97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.25 }} transition={{ type: 'spring', stiffness: 110, damping: 17, delay }}>{children}</motion.div>
}

type RailItem = { sample: Sample; caption: string; kind: string }

/** The cards section pins while you scroll, and the scroll moves the cards sideways. */
function CardRail({ items }: { items?: RailItem[] }) {
  const reduced = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLUListElement>(null)
  const [height, setHeight] = useState<number>()
  useEffect(() => {
    const node = section.current, list = track.current
    if (reduced || !node || !list) return
    const distance = () => Math.max(0, list.scrollWidth - window.innerWidth)
    const measure = () => setHeight(window.innerHeight + distance())
    const move = () => {
      const box = node.getBoundingClientRect()
      const progress = Math.min(1, Math.max(0, -box.top / Math.max(1, box.height - window.innerHeight)))
      list.style.transform = `translate3d(${-progress * distance()}px, 0, 0)`
      list.style.setProperty('--progress', String(progress))
    }
    const resize = new ResizeObserver(() => { measure(); move() })
    resize.observe(list)
    window.addEventListener('scroll', move, { passive: true })
    window.addEventListener('resize', measure)
    measure(); move()
    return () => { resize.disconnect(); window.removeEventListener('scroll', move); window.removeEventListener('resize', measure) }
  }, [items, reduced])
  return <section ref={section} className={`cards-scroll ${reduced ? 'is-static' : ''}`} style={height ? { height } : undefined} aria-labelledby="inside-title">
    <div className="cards-scroll__sticky">
      <div className="cards-scroll__head">
        <DropTitle id="inside-title" text="Deal with it." />
        <Reveal delay={0.15}><p>Every chat deals a different hand: two people or two hundred, and every number comes from your own export. Keep scrolling, we’ll shuffle.</p></Reveal>
      </div>
      <ul ref={track} className="rail rail--scroll" tabIndex={reduced ? 0 : -1} aria-label="Sample cards">
        {items?.map(({ sample: item, caption, kind }, index) => <li key={caption} style={{ '--i': index } as React.CSSProperties}><RealCard sample={item} still /><span>{caption}<small>{kind}</small></span></li>)}
      </ul>
    </div>
  </section>
}

/** Shown while the friends scene loads, and instead of it where WebGL is unavailable. */
function StaticBubbles() {
  return <ul className="static-bubbles" aria-hidden="true">{friendMessages.slice(0, 6).map((message) => <li key={message.text} className={`friend-bubble friend-bubble--${message.from ? 'right' : 'left'}`}>{message.text}</li>)}</ul>
}

export function Landing({ openPrivacy }: { openPrivacy: () => void }) {
  const setStep = useApp((s) => s.setStep)
  const cards = useSampleCards()
  const still = Boolean(useReducedMotion())
  useEffect(() => { track('landing_view'); if (new URLSearchParams(location.search).has('ref')) track('referral_landing', { ref: new URLSearchParams(location.search).get('ref')?.slice(0,40) ?? '' }) }, [])
  const begin = () => { setStep('choose'); window.scrollTo(0, 0) }
  const sample = () => { setStep('upload'); window.scrollTo(0, 0) }
  const price = appConfig.freeAccess ? 'Free, with every theme included.' : 'Free to make and download. Pay only for a custom look.'
  const deck = <Deck decks={cards?.decks} />
  return <main className="landing">
    <section className="hero-band">
      <nav className="landing__nav"><div className="landing__brand"><Brand /><a className="studio-credit" href={brand.studioUrl} target="_blank" rel="noreferrer"><KodedMark />{credit}</a></div><button className="text-link" onClick={openPrivacy}><LockKeyhole size={16} /> Privacy</button></nav>
      <div className="hero">
        <div className="hero__copy">
          <Reveal><span className="hero__kicker">WhatsApp chats · 1:1 and groups</span></Reveal>
          <motion.h1 aria-label="Your chat, exposed." initial={still ? false : 'hidden'} animate="shown" transition={{ staggerChildren: 0.09, delayChildren: 0.15 }}>
            {['Your', 'chat,'].map((word) => <motion.span key={word} aria-hidden="true" className="drop-word" variants={{ hidden: { opacity: 0, y: -90, rotate: -10 }, shown: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 240, damping: 14 } } }}>{word}</motion.span>)}
            <motion.span aria-hidden="true" className="drop-word marker" variants={{ hidden: { opacity: 0, scale: 0.4, rotate: 12 }, shown: { opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 220, damping: 11 } } }}>exposed.</motion.span>
          </motion.h1>
          <Reveal delay={0.45}><p>Your person or your whole group. Drop the WhatsApp export and get a one-of-one deck about who carries the gist, who ghosts, and who is awake at 3am.</p></Reveal>
          <Reveal delay={0.6}>
            <div className="hero__actions">
              <Button onClick={begin}>Get yours in 30 seconds <ArrowUpRight size={20} /></Button>
              <button className="sample-link" onClick={sample}>or try it with a sample chat</button>
            </div>
            <p className="hero__price">{price}</p>
            <div className="trust"><LockKeyhole size={17} /><span>{privacyCopy.short}</span></div>
          </Reveal>
        </div>
        <div className="hero__stage">
          <span className="float-sticker float-sticker--one" aria-hidden="true">😂</span>
          <span className="float-sticker float-sticker--two" aria-hidden="true">🔥</span>
          <span className="float-sticker float-sticker--three" aria-hidden="true">👀</span>
          <Suspense fallback={deck}><HeroStage still={still} fallback={deck} /></Suspense>
        </div>
      </div>
    </section>

    <section className="friends" aria-labelledby="friends-title">
      <div className="friends__copy">
        <DropTitle id="friends-title" text="Group chat, meet group chart." />
        <Reveal delay={0.2}><p>Every card comes from what your chat actually did: who yaps, who replies in four seconds, and who vanishes for a month then returns with “wetin I miss?”</p></Reveal>
      </div>
      <Suspense fallback={<StaticBubbles />}><FriendsStage still={still} fallback={<StaticBubbles />} /></Suspense>
    </section>

    <CardRail items={cards?.rail} />

    <section className="how" aria-labelledby="how-title">
      <DropTitle id="how-title" text="Easier than leaving someone on read." />
      <ol>{steps.map(([title, copy], index) => <li key={title}><Reveal delay={index * 0.12}><h3>{title}</h3><p>{copy}</p></Reveal></li>)}</ol>
    </section>

    <section className="safe" aria-labelledby="safe-title">
      <DropTitle id="safe-title" text="Your secrets stay safe. Your stats, less so." />
      <Reveal delay={0.15}>
        <p>{privacyCopy.short}</p>
        <p>Turn on <strong>Hide names</strong> before you post, and everybody becomes Member 1, Member 2.</p>
        <button className="text-link" onClick={openPrivacy}>Read the privacy details <ArrowRight size={16} /></button>
      </Reveal>
    </section>

    <section className="closer" aria-labelledby="closer-title">
      <Suspense fallback={null}>
        <EmojiStage still={still} fallback={null}>
          <div className="closer__copy">
            <DropTitle id="closer-title" text="Spill the tea. We’ll count the cups." />
            <Reveal delay={0.3}>
              <Button onClick={begin}>Wrap my chat <ArrowUpRight size={20} /></Button>
              <small>{still ? 'Your chat’s favourite faces, piled up.' : 'Psst: poke the emojis.'}</small>
            </Reveal>
          </div>
        </EmojiStage>
      </Suspense>
    </section>

    <Reveal>
      <footer className="landing__foot">
        <a className="studio-credit studio-credit--foot" href={brand.studioUrl} target="_blank" rel="noreferrer"><KodedMark />{brand.productName}, {credit.replace('A ', 'a ')}</a>
        <span>For chats exported from WhatsApp. Not affiliated with WhatsApp.</span>
        <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
      </footer>
    </Reveal>
  </main>
}
