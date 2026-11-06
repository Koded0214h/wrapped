import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { flushSync } from 'react-dom'
import { Download, EyeOff, LockKeyhole, Pause, Play, Settings2, Share2, Sparkles, X } from 'lucide-react'
import { toPng } from 'html-to-image'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { Checkout } from '../components/Checkout'
import { Customiser } from '../components/Customiser'
import { CardRenderer } from '../slides/CardLayouts'
import { redactTemplate } from '../analysis/planCards'
import type { Card } from '../analysis/types'
import { useApp, type Purchase } from '../store/useApp'
import { fonts } from '../themes/fonts'
import { getTheme } from '../themes/themes'
import { track, timing, trackError } from '../lib/telemetry'
import { appConfig, privacyCopy } from '../config/appConfig'
import { brand } from '../config/brand'
import { planAnalysisWithAi } from '../analysis/aiPlanner'
import { ANALYSIS_SCHEMA_VERSION, clearAnalysis } from '../analysis/analysisCache'

const cardLabels: Partial<Record<Card['layout'], string>> = {
  groupNumbers: 'The group in numbers', yapLeaderboard: 'The yap leaderboard', characterCast: 'Everyone has a character',
  groupAwards: 'The group chat awards', socialGraph: 'Who runs this group?', plotTwist: 'The biggest plot twist',
  groupLanguage: "The group's language", timeCapsule: 'The moments that defined us', companyRoast: 'If this group were a company',
  dynamicDuo: 'The dynamic duo', replyRace: 'The reply race', nightShift: 'The night shift', mediaDesk: 'The media department',
  ghostWatch: 'The vanishing act', laughTrack: 'The laugh track', conversationSpark: 'Who keeps pressing start?',
  groupPulse: 'The group pulse', memoryVault: 'The memory vault', movieFinale: 'Our group chat: the movie', finalVerdict: 'The final verdict'
}
const cardLabel = (layout: Card['layout']) => cardLabels[layout] ?? layout.replace(/([A-Z])/g, ' $1')

function bonusCards(base: Card[], factIds: string[]): Card[] {
  return [...base,
    { id: 'bonus_quick_draw', layout: 'award', factIds: factIds.slice(0, 1), headline: '{{member:self}} collect Sharp Reply Award.', roast: 'Notification never settle, reply don land.', savageRoast: 'This phone no dey leave notification unanswered.', locked: false },
    { id: 'bonus_media', layout: 'award', factIds: factIds.slice(1, 2), headline: '{{member:self}} collect Media Dropper Award.', roast: 'Photo, video and link plenty for this side.', savageRoast: 'Typing na backup plan for this phone.', locked: false }
  ]
}

export function Story() {
  const { analysis, unlocked, owned, theme, font, savage, hideNames, autoAdvance, setAutoAdvance, setStep, setAnalysis } = useApp()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [customise, setCustomise] = useState(false)
  const [checkout, setCheckout] = useState<Purchase | null>(null)
  const [sharing, setSharing] = useState('')
  const [help, setHelp] = useState(true)
  const [captureShield, setCaptureShield] = useState(false)
  const pointer = useRef<number | null>(null)
  const aiAttemptedFor = useRef<typeof analysis>(null)
  const exportRef = useRef<HTMLDivElement | null>(null)
  const [exportIndex, setExportIndex] = useState<number | null>(null)
  const currentTheme = getTheme(theme)
  const currentFont = fonts.find((item) => item.id === font) ?? fonts[0]
  const accessUnlocked = appConfig.freeAccess || unlocked
  const has = useCallback((item: Purchase) => appConfig.freeAccess ? item !== 'watermark' : owned.includes(item) || owned.includes('everything'), [owned])
  const bonusFactIds = analysis?.facts.filter((fact) => ['fast_reply','media_dropper'].includes(fact.kind)).slice(0,2).map((fact)=>fact.id) ?? []
  const cards = useMemo(() => analysis ? (analysis.chatType !== 'group' && has('awards') && bonusFactIds.length === 2 ? bonusCards(analysis.cards, bonusFactIds) : analysis.cards) : [], [analysis, bonusFactIds.join('|'), has])
  const totalCards = cards.length
  const currentCard = cards[index]
  const exportCard = exportIndex === null ? null : cards[exportIndex]
  const lockedThemePreview = !currentTheme.free && !has('theme')
  const lockedFontPreview = !currentFont.free && !has('font')
  const lockedSavagePreview = savage && !has('savage')
  const lockedStyle = lockedThemePreview || lockedFontPreview || lockedSavagePreview

  const go = useCallback((next: number) => {
    const bounded = Math.max(0, Math.min(totalCards - 1, next))
    if (bounded === index) return
    setDirection(bounded > index ? 1 : -1); setIndex(bounded); setHelp(false)
    const card = cards[bounded]
    track('card_viewed', { index: bounded, layout: card?.layout ?? 'unknown' })
    if (card?.locked && !accessUnlocked) track('paywall_viewed', { index: bounded })
  }, [accessUnlocked, cards, index, totalCards])

  useEffect(() => { track('story_viewed', { chatType: analysis?.chatType ?? 'unknown', cards: totalCards }) }, [analysis?.chatType, totalCards])
  useEffect(() => {
    if (!appConfig.freeAccess || !appConfig.aiPlanner || !analysis || analysis.planner === 'ai' || aiAttemptedFor.current === analysis) return
    aiAttemptedFor.current = analysis
    void planAnalysisWithAi(analysis).then((planned) => {
      if (planned !== analysis) setAnalysis(planned)
    }).catch((error) => trackError(error, { step: 'ai-plan-free' }))
  }, [analysis, setAnalysis])
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'ArrowRight') go(index + 1); if (event.key === 'ArrowLeft') go(index - 1) }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [go, index])
  useEffect(() => {
    if (!autoAdvance || (currentCard?.locked && !accessUnlocked)) return
    const timer = window.setTimeout(() => go(index === totalCards - 1 ? 0 : index + 1), 6000)
    return () => clearTimeout(timer)
  }, [accessUnlocked, autoAdvance, currentCard?.locked, go, index, totalCards])
  useEffect(() => {
    if (accessUnlocked) { setCaptureShield(false); return }
    let timer: number | undefined
    const shield = () => { setCaptureShield(true); window.clearTimeout(timer); timer = window.setTimeout(() => setCaptureShield(false), 1800) }
    const key = (event: KeyboardEvent) => { if (event.key === 'PrintScreen') { event.preventDefault(); shield() } }
    const visibility = () => { if (document.hidden) setCaptureShield(true); else { window.clearTimeout(timer); timer = window.setTimeout(() => setCaptureShield(false), 1200) } }
    window.addEventListener('keydown', key); window.addEventListener('blur', shield); document.addEventListener('visibilitychange', visibility)
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', key); window.removeEventListener('blur', shield); document.removeEventListener('visibilitychange', visibility) }
  }, [accessUnlocked])

  const style = useMemo(() => ({ ...currentTheme.variables, '--font-display': currentFont.stack, '--font-body': '"Manrope Variable", sans-serif' } as React.CSSProperties), [currentTheme, currentFont])
  if (!analysis || !currentCard) return null
  if (analysis.schemaVersion !== ANALYSIS_SCHEMA_VERSION) return <main className="flow"><nav className="flow__nav"><Brand /></nav><div className="flow__body"><section className="processing-error"><span><Sparkles /></span><h1>This deck needs fresh facts.</h1><p>The card logic changed after this chat was analysed. Upload the same export once more so topic context, reply samples and laugh moments can be computed correctly.</p><Button onClick={() => { void clearAnalysis(); setStep('upload') }}>Upload the export again</Button></section></div></main>
  const isLocked = currentCard.locked && !accessUnlocked
  const watermark = !has('watermark')
  const cardFacts = currentCard.factIds.map((id) => analysis.facts.find((fact) => fact.id === id)).filter(Boolean)

  const downloadNode = async (node: HTMLElement, fileName: string) => {
    const started = performance.now(); await document.fonts.ready
    const url = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: currentTheme.variables['--bg-from'] })
    const link = document.createElement('a'); link.download = fileName; link.href = url; link.click()
    timing('png_export', performance.now() - started)
  }
  const prepareExportNode = async (targetIndex: number) => {
    flushSync(() => setExportIndex(targetIndex))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (!exportRef.current) throw new Error('E-301: Export card could not be prepared.')
    return exportRef.current
  }
  const requireExportAccess = () => {
    if (!accessUnlocked) { setCheckout('core'); return false }
    if (lockedThemePreview) { setCheckout('theme'); return false }
    if (lockedFontPreview) { setCheckout('font'); return false }
    if (lockedSavagePreview) { setCheckout('savage'); return false }
    return true
  }
  const saveCurrent = async () => {
    if (!requireExportAccess()) return
    setSharing('Saving card…')
    try { await downloadNode(await prepareExportNode(index), `chat-wrapped-${index + 1}.png`); track('card_downloaded', { index, layout: currentCard.layout }) } finally { setExportIndex(null); setSharing('') }
  }
  const downloadAll = async () => {
    if (!requireExportAccess()) return
    setSharing(`Preparing ${totalCards} cards…`)
    try { for (let i = 0; i < totalCards; i++) await downloadNode(await prepareExportNode(i), `chat-wrapped-${i + 1}.png`); track('card_downloaded', { index: -1, layout: 'all' }) } finally { setExportIndex(null); setSharing('') }
  }
  const shareCurrent = async () => {
    if (!requireExportAccess()) return
    setSharing('Preparing share…')
    try {
      const node = await prepareExportNode(index); await document.fonts.ready
      const url = await toPng(node, { pixelRatio: 3, cacheBust: true }); const blob = await (await fetch(url)).blob()
      const file = new File([blob], `chat-wrapped-${index + 1}.png`, { type: 'image/png' })
      const shareUrl = `https://${brand.domain}?ref=${encodeURIComponent(currentCard.id)}`
      const canNativeShare = navigator.canShare({ files: [file] })
      if (canNativeShare) await navigator.share({ title: 'Our Chat Wrapped', text: `The group chat has been exposed 👀 ${shareUrl}`, files: [file] })
      else await downloadNode(node, `chat-wrapped-${index + 1}.png`)
      track('card_shared', { target: canNativeShare ? 'native' : 'download', cardId: currentCard.id.slice(0,40) })
    } finally { setExportIndex(null); setSharing('') }
  }

  const renderedCard = isLocked
    ? <div className="locked-card"><div className="slide__topline"><span>{cardLabel(currentCard.layout)}</span><LockKeyhole /></div><h2>{redactTemplate(currentCard.headline)}</h2><p>Pay first make names and numbers show for this card.</p></div>
    : <CardRenderer card={currentCard} facts={analysis.facts} members={analysis.members} savage={savage} hideNames={hideNames} preview={lockedStyle} watermark={watermark} />

  return <main className={`story-page ${accessUnlocked ? 'is-unlocked' : 'is-preview'}`}>
    {!accessUnlocked && captureShield && <div className="capture-shield" role="alert"><LockKeyhole /><strong>Preview protected</strong><span>Unlock before saving or sharing this story.</span></div>}
    <nav className="story-nav"><Brand /><div><button onClick={() => setAutoAdvance(!autoAdvance)}>{autoAdvance ? <Pause /> : <Play />} {autoAdvance ? 'Pause' : 'Auto-play'}</button><button onClick={() => setCustomise(true)}><Settings2 /> Customise</button><button className="story-nav__close" onClick={() => setStep('landing')} aria-label="Close story"><X /></button></div></nav>
    <section className="story-layout">
      <div className="story-meta"><span>Your Chat Wrapped</span><h1>{cardLabel(currentCard.layout)}</h1><p>{index + 1} of {totalCards}</p><div className="story-meta__privacy"><EyeOff /><span>{hideNames ? 'Names are hidden' : 'Names are visible'}<small>Use Customise before sharing.</small></span></div></div>
      <div className="story-stage">
        <div className="story-progress">{cards.map((card, i) => <button key={card.id} onClick={() => go(i)} aria-label={`Go to card ${i + 1}`}><i className={i <= index ? 'is-filled' : ''}>{i === index && autoAdvance && <motion.em initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 6, ease: 'linear' }} />}</i></button>)}</div>
        <div className="story-frame-wrap">
          <button className="tap-zone tap-zone--left" onClick={() => go(index - 1)} aria-label="Previous card" />
          <div className="story-frame" style={style} onPointerDown={(e) => { pointer.current = e.clientX }} onPointerUp={(e) => { if (pointer.current !== null && Math.abs(e.clientX - pointer.current) > 45) go(index + (e.clientX < pointer.current ? 1 : -1)); pointer.current = null }} onPointerCancel={() => { pointer.current = null }}>
            {isLocked ? <div key={currentCard.id} className="story-content">{renderedCard}</div> : <motion.div key={currentCard.id} initial={{ x: direction * 18, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .16, ease: 'easeOut' }} className="story-content">{renderedCard}</motion.div>}
            {isLocked && <div className="paywall paywall--safe"><div className="paywall__lock"><LockKeyhole /></div><h2>The real reveal stays sealed.</h2><p>No locked names or values are rendered until purchase.</p><Button wide onClick={() => setCheckout('core')}>Unlock this story · $1.99</Button><small><LockKeyhole /> {privacyCopy.paywall}</small></div>}
          </div>
          <button className="tap-zone tap-zone--right" onClick={() => go(index + 1)} aria-label="Next card" />
          {help && <div className="swipe-hint"><span>Tap or swipe to explore</span></div>}
        </div>
      </div>
      <div className="share-panel"><h2>Keep the evidence</h2><p>Cards export at 1080 × 1920, ready for Stories and Status.</p><div><Button onClick={saveCurrent} variant="secondary"><Download /> Save card</Button><Button onClick={shareCurrent}><Share2 /> Send to group</Button></div><button className="download-all" onClick={downloadAll}><Sparkles /> Download all {totalCards} cards</button>{sharing && <span className="share-status" role="status">{sharing}</span>}<p className="share-warning">This may show your friends’ names. Hide names before posting?</p></div>
    </section>
    {customise && <><div className="drawer-backdrop" onClick={() => setCustomise(false)} /><Customiser onClose={() => setCustomise(false)} buy={(item) => { setCustomise(false); setCheckout(item) }} preview={<div className="customiser-preview-theme" style={style}>{renderedCard}</div>} /></>}
    {checkout && !appConfig.freeAccess && <Checkout purchase={checkout} onClose={() => { setCheckout(null) }} />}
    {exportCard && <div className="export-deck" aria-hidden="true"><div className="export-frame" style={style} ref={exportRef}>{(!exportCard.locked || accessUnlocked) && <CardRenderer card={exportCard} facts={analysis.facts} members={analysis.members} savage={savage} hideNames={hideNames} preview={lockedStyle} watermark={watermark} />}</div></div>}
  </main>
}
