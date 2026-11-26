import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { flushSync } from 'react-dom'
import { Download, EyeOff, Pause, Play, Settings2, Share2, Sparkles, X } from 'lucide-react'
import { toPng } from 'html-to-image'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { Checkout } from '../components/Checkout'
import { Customiser } from '../components/Customiser'
import { CardRenderer, type CardView } from '../slides/CardLayouts'
import { clearWinner } from '../analysis/fairness'
import type { Card } from '../analysis/types'
import { ownsPurchase, useApp, type Purchase } from '../store/useApp'
import { fonts } from '../themes/fonts'
import { getTheme } from '../themes/themes'
import { track, timing, trackError } from '../lib/telemetry'
import { appConfig } from '../config/appConfig'
import { brand } from '../config/brand'
import { planAnalysisWithAi } from '../analysis/aiPlanner'
import { aiServerAvailable } from '../lib/aiServer'
import { ANALYSIS_SCHEMA_VERSION, clearAnalysis } from '../analysis/analysisCache'

const cardLabels: Partial<Record<Card['layout'], string>> = {
  cover: 'The opening', bigNumber: 'The number that stood out', leaderboard: 'Who did it most?', versus: 'Head to head', quote: 'What kept happening', timeline: 'How it unfolded', award: 'An award was earned', wordCloud: 'The words that stayed', heatmap: 'When the chat came alive', verdict: 'The closing verdict',
  groupNumbers: 'The group in numbers', yapLeaderboard: 'The yap leaderboard', characterCast: 'Everyone has a character',
  groupAwards: 'The group chat awards', socialGraph: 'Who runs this group?', plotTwist: 'The biggest plot twist',
  groupLanguage: "The group's language", timeCapsule: 'The moments that defined us', companyRoast: 'If this group were a company',
  dynamicDuo: 'The dynamic duo', replyRace: 'The reply race', nightShift: 'The night shift', mediaDesk: 'The media department',
  ghostWatch: 'The vanishing act', laughTrack: 'The laugh track', conversationSpark: 'Who keeps pressing start?',
  highlights: 'Chat highlights', split: 'Who typed more', monthly: 'Month by month', hourly: 'Round the clock', quietGap: 'The quiet stretch', emojiBoard: 'Your top emojis', calls: 'The call log',
  groupPulse: 'The group pulse', memoryVault: 'The memory vault', movieFinale: 'Our group chat: the movie', finalVerdict: 'The final verdict'
}
const cardLabel = (layout: Card['layout']) => cardLabels[layout] ?? layout.replace(/([A-Z])/g, ' $1')
// React StrictMode mounts effects twice in development. Keep this outside the
// component so the same analysis cannot trigger two billable model requests.
const autoPlanningStarted = new WeakSet<object>()

function bonusCards(base: Card[], factIds: string[]): Card[] {
  const extras: Card[] = [
    { id: 'bonus_quick_draw', layout: 'award', factIds: factIds.slice(0, 1), headline: '{{member:self}} collect Sharp Reply Award.', roast: 'Notification never settle, reply don land.', savageRoast: 'This phone no dey leave notification unanswered.', locked: false },
    { id: 'bonus_media', layout: 'award', factIds: factIds.slice(1, 2), headline: '{{member:self}} collect Media Dropper Award.', roast: 'Photo, video and link plenty for this side.', savageRoast: 'Typing na backup plan for this phone.', locked: false }
  ]
  // The verdict stays last.
  const verdictAt = base.findIndex((card) => card.layout === 'verdict')
  const at = verdictAt < 0 ? base.length : verdictAt
  return [...base.slice(0, at), ...extras, ...base.slice(at)]
}

export function Story() {
  const { analysis, owned, theme, font, savage, hideNames, autoAdvance, setAutoAdvance, setStep, setAnalysis } = useApp()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [customise, setCustomise] = useState(false)
  const [checkout, setCheckout] = useState<Purchase | null>(null)
  const [sharing, setSharing] = useState('')
  const [exportError, setExportError] = useState('')
  const [help, setHelp] = useState(true)
  const pointer = useRef<number | null>(null)
  const exportRef = useRef<HTMLDivElement | null>(null)
  const [exportIndex, setExportIndex] = useState<number | null>(null)
  const [views, setViews] = useState<Record<string, CardView>>({})
  const viewProps = (card: Card) => ({ view: views[card.id], onView: (key: string, value: unknown) => setViews((current) => ({ ...current, [card.id]: { ...current[card.id], [key]: value } })) })
  const currentTheme = getTheme(theme)
  const currentFont = fonts.find((item) => item.id === font) ?? fonts[0]
  const has = useCallback((item: Purchase) => ownsPurchase(owned, item), [owned])
  // One award each for the clear fastest replier and the clear media leader.
  const bonusFactIds = (['fast_reply', 'media_dropper'] as const).flatMap((kind) => {
    const ofKind = analysis?.facts.filter((fact) => fact.kind === kind) ?? []
    const winner = kind === 'fast_reply' ? ofKind.find((fact) => fact.context?.rank === 1 && fact.context.gap !== 0) : clearWinner(ofKind, (fact) => Number(fact.value))
    return winner ? [winner.id] : []
  })
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
  }, [cards, index, totalCards])

  useEffect(() => { track('story_viewed', { chatType: analysis?.chatType ?? 'unknown', cards: totalCards }) }, [analysis?.chatType, totalCards])
  useEffect(() => {
    if (!appConfig.aiPlanner || !analysis || analysis.planner === 'ai' || analysis.aiAttempted || autoPlanningStarted.has(analysis)) return
    autoPlanningStarted.add(analysis)
    void aiServerAvailable().then(async (available) => {
      if (!available) return
      const planned = await planAnalysisWithAi(analysis)
      if (planned !== analysis) setAnalysis(planned)
    }).catch((error) => trackError(error, { step: 'ai-plan-free' }))
  }, [analysis, setAnalysis])
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.target instanceof HTMLInputElement || customise || checkout) return; if (event.key === 'ArrowRight') go(index + 1); if (event.key === 'ArrowLeft') go(index - 1) }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [checkout, customise, go, index])
  // A re-planned deck can be shorter than the one being viewed.
  useEffect(() => { if (totalCards && index >= totalCards) setIndex(totalCards - 1) }, [index, totalCards])
  useEffect(() => {
    if (!autoAdvance) return
    const timer = window.setTimeout(() => go(index === totalCards - 1 ? 0 : index + 1), 6000)
    return () => clearTimeout(timer)
  }, [autoAdvance, go, index, totalCards])
  const style = useMemo(() => ({ ...currentTheme.variables, '--font-display': currentFont.stack, '--font-body': '"Manrope Variable", sans-serif' } as React.CSSProperties), [currentTheme, currentFont])
  if (!analysis || !currentCard) return null
  if (analysis.schemaVersion !== ANALYSIS_SCHEMA_VERSION) return <main className="flow"><nav className="flow__nav"><Brand /></nav><div className="flow__body"><section className="processing-error"><span><Sparkles /></span><h1>This deck needs fresh facts.</h1><p>The card logic changed after this chat was analysed. Upload the same export once more so topic context, reply samples and laugh moments can be computed correctly.</p><Button onClick={() => { void clearAnalysis(); setStep('upload') }}>Upload the export again</Button></section></div></main>
  const watermark = !has('watermark')

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
  // The story and its downloads are free. Only a premium style asks for payment.
  const requireExportAccess = () => {
    const needed = lockedThemePreview ? 'theme' : lockedFontPreview ? 'font' : lockedSavagePreview ? 'savage' : null
    if (!needed) return true
    track('paywall_viewed', { product: needed })
    setCheckout(needed)
    return false
  }
  // One place for progress, cleanup and failures, so no export can fail silently.
  const runExport = async (label: string, work: () => Promise<void>) => {
    if (!requireExportAccess()) return
    setExportError(''); setSharing(label)
    try { await work() }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return // the viewer closed the share sheet
      trackError(error, { step: 'export' })
      setExportError('That did not work. Try again, or use “Save card” instead.')
    } finally { setExportIndex(null); setSharing('') }
  }
  const saveCurrent = () => runExport('Saving card…', async () => {
    await downloadNode(await prepareExportNode(index), `chat-wrapped-${index + 1}.png`); track('card_downloaded', { index, layout: currentCard.layout })
  })
  const downloadAll = () => runExport(`Preparing ${totalCards} cards…`, async () => {
    for (let i = 0; i < totalCards; i++) await downloadNode(await prepareExportNode(i), `chat-wrapped-${i + 1}.png`)
    track('card_downloaded', { index: -1, layout: 'all' })
  })
  const shareCurrent = () => runExport('Preparing share…', async () => {
    const node = await prepareExportNode(index); await document.fonts.ready
    const url = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: currentTheme.variables['--bg-from'] }); const blob = await (await fetch(url)).blob()
    const file = new File([blob], `chat-wrapped-${index + 1}.png`, { type: 'image/png' })
    const shareUrl = `https://${brand.domain}?ref=${encodeURIComponent(currentCard.id)}`
    let target = 'download'
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: 'Our Chat Wrapped', text: `The group chat has been exposed 👀 ${shareUrl}`, files: [file] }); target = 'native' }
      // Safari can refuse to share once rendering has used up the tap; save the image instead.
      catch (error) { if (!(error instanceof DOMException && error.name === 'NotAllowedError')) throw error; await downloadNode(node, file.name) }
    } else await downloadNode(node, file.name)
    track('card_shared', { target, cardId: currentCard.id.slice(0,40) })
  })

  const renderedCard = <CardRenderer {...viewProps(currentCard)} card={currentCard} facts={analysis.facts} members={analysis.members} savage={savage} hideNames={hideNames} preview={lockedStyle} watermark={watermark} />

  return <main className="story-page is-unlocked">
    <nav className="story-nav"><Brand /><div><button onClick={() => setAutoAdvance(!autoAdvance)}>{autoAdvance ? <Pause /> : <Play />} {autoAdvance ? 'Pause' : 'Auto-play'}</button><button onClick={() => setCustomise(true)}><Settings2 /> Customise</button><button className="story-nav__close" onClick={() => setStep('landing')} aria-label="Close story"><X /></button></div></nav>
    <section className="story-layout">
      <div className="story-meta"><span>Your Chat Wrapped</span><h1>{cardLabel(currentCard.layout)}</h1><p>{index + 1} of {totalCards}</p><div className="story-meta__privacy"><EyeOff /><span>{hideNames ? 'Names are hidden' : 'Names are visible'}<small>Use Customise before sharing.</small></span></div></div>
      <div className="story-stage">
        <div className="story-progress">{cards.map((card, i) => <button key={card.id} onClick={() => go(i)} aria-label={`Go to card ${i + 1}`}><i className={i <= index ? 'is-filled' : ''}>{i === index && autoAdvance && <motion.em initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 6, ease: 'linear' }} />}</i></button>)}</div>
        <div className="story-frame-wrap">
          <button className="tap-zone tap-zone--left" onClick={() => go(index - 1)} aria-label="Previous card" />
          <div className="story-frame" style={style} onPointerDown={(e) => { pointer.current = e.clientX }} onPointerUp={(e) => { if (pointer.current !== null && Math.abs(e.clientX - pointer.current) > 45) go(index + (e.clientX < pointer.current ? 1 : -1)); pointer.current = null }} onPointerCancel={() => { pointer.current = null }}>
            <motion.div key={currentCard.id} initial={{ x: direction * 18, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .16, ease: 'easeOut' }} className="story-content">{renderedCard}</motion.div>
          </div>
          <button className="tap-zone tap-zone--right" onClick={() => go(index + 1)} aria-label="Next card" />
          {help && <div className="swipe-hint"><span>Tap or swipe to explore</span></div>}
        </div>
      </div>
      <div className="share-panel"><h2>Keep the evidence</h2><p>Cards export at 1080 × 1920, ready for Stories and Status.</p><div><Button onClick={saveCurrent} variant="secondary"><Download /> Save card</Button><Button onClick={shareCurrent}><Share2 /> Send to group</Button></div><button className="download-all" onClick={downloadAll}><Sparkles /> Download all {totalCards} cards</button>{sharing && <span className="share-status" role="status">{sharing}</span>}{exportError && <p className="form-error" role="alert">{exportError}</p>}<p className="share-warning">This may show your friends’ names. Hide names before posting?</p></div>
    </section>
    {customise && <><div className="drawer-backdrop" onClick={() => setCustomise(false)} /><Customiser onClose={() => setCustomise(false)} buy={(item) => { setCustomise(false); setCheckout(item) }} preview={<div className="customiser-preview-theme" style={style}>{renderedCard}</div>} /></>}
    {checkout && !appConfig.freeAccess && <Checkout purchase={checkout} onClose={() => { setCheckout(null) }} />}
    {exportCard && <div className="export-deck" aria-hidden="true"><div className="export-frame" style={style} ref={exportRef}><CardRenderer still key={exportCard.id} {...viewProps(exportCard)} card={exportCard} facts={analysis.facts} members={analysis.members} savage={savage} hideNames={hideNames} preview={lockedStyle} watermark={watermark} /></div></div>}
  </main>
}
