import { useEffect } from 'react'
import { ArrowUpRight, LockKeyhole } from 'lucide-react'
import { motion } from 'framer-motion'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { useApp } from '../store/useApp'
import { track } from '../lib/telemetry'
import { privacyCopy } from '../config/appConfig'

export function Landing({ openPrivacy }: { openPrivacy: () => void }) {
  const setStep = useApp((s) => s.setStep)
  useEffect(() => { track('landing_view'); if (new URLSearchParams(location.search).has('ref')) track('referral_landing', { ref: new URLSearchParams(location.search).get('ref')?.slice(0,40) ?? '' }) }, [])
  const begin = () => { setStep('choose') }
  return <main className="landing">
    <nav className="landing__nav"><Brand /><button className="text-link" onClick={openPrivacy}><LockKeyhole size={16} /> Privacy</button></nav>
    <section className="hero">
      <div className="hero__copy">
        <h1>Your group chat, exposed.</h1>
        <p>Drop your WhatsApp export. Get a one-of-one deck about who carries the gist, who ghosts, and who is awake at 3am.</p>
        <Button onClick={begin}>Get yours in 30 seconds <ArrowUpRight size={20} /></Button>
        <button className="sample-link" onClick={() => setStep('choose')}>or try it with a sample chat</button>
        <div className="trust"><LockKeyhole size={17} /><span><strong>{privacyCopy.short}</strong><br />Raw messages are discarded after facts are computed.</span></div>
      </div>
      <div className="hero__deck" aria-label="Sample Chat Wrapped card">
        <div className="deck-shadow deck-shadow--one" />
        <div className="deck-shadow deck-shadow--two" />
        <motion.div className="sample-card" initial={{ rotate: -3, y: 20 }} animate={{ rotate: 1.5, y: 0 }} transition={{ type: 'spring', stiffness: 80, damping: 14 }}>
          <div className="sample-card__bars"><i /><i /><i /><i /><i /></div>
          <span className="sample-card__chip">3AM CLUB</span>
          <div className="sample-card__clock">03:17</div>
          <h2>Tobi is keeping the group awake.</h2>
          <div className="sample-card__stat"><strong>944</strong><span>messages sent<br />after midnight</span></div>
          <p>Some of you need to sleep. Or confess.</p>
          <footer>No Dull Moment 🔥 · sample data</footer>
        </motion.div>
      </div>
    </section>
    <section className="landing__proof" aria-label="How it works">
      <span>Export without media</span><b>→</b><span>Pick your chat</span><b>→</b><span>Share the evidence</span>
    </section>
  </main>
}
