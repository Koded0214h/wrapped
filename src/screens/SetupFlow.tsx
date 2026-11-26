import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, FileArchive, Heart, LockKeyhole, MessageCircleMore, MessagesSquare, Smartphone, UploadCloud, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { useApp } from '../store/useApp'
import { getAnalysis, type AnalysisProgress, type MockChatId } from '../analysis/getAnalysis'
import { clearPendingInput, getPendingInput, setPendingAiMode, setPendingFile, setPendingMock } from '../analysis/pendingInput'
import { appConfig, privacyCopy } from '../config/appConfig'
import { timing, track, trackError } from '../lib/telemetry'
import type { ParserDiagnostics } from '../analysis/parseExport'
import { planAnalysisWithAi } from '../analysis/aiPlanner'
import type { AnalysisResult } from '../analysis/types'
import { isPendingContext } from '../analysis/fairness'
import { aiServerAvailable } from '../lib/aiServer'

function Shell({ children, back }: { children: React.ReactNode; back?: () => void }) {
  return <main className="flow"><nav className="flow__nav">{back ? <button className="back-link" onClick={back}><ArrowLeft size={18} /> Back</button> : <Brand />}</nav><div className="flow__body">{children}</div></main>
}

export function ChooseType() {
  const { chatType, setChatType, setStep } = useApp()
  const choose = (type: 'group'|'dm') => { setChatType(type); track('chat_type_selected', { chatType: type }) }
  return <Shell back={() => setStep('landing')}><motion.section className="choice" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
    <h1>Whose business are we entering?</h1><p>Choose the chat type. The fact planner will build a different deck for every chat.</p>
    <div className="choice__options">
      <button className={chatType === 'group' ? 'type-card is-active' : 'type-card'} onClick={() => choose('group')}><span className="type-card__icon"><MessagesSquare /></span><span><strong>Group chat</strong><small>Leaders, ghosts, night shifts, repeated phrases, and unexpected rivalries.</small></span>{chatType === 'group' && <Check />}</button>
      <button className={chatType === 'dm' ? 'type-card is-active' : 'type-card'} onClick={() => choose('dm')}><span className="type-card__icon"><MessageCircleMore /></span><span><strong>1:1 chat</strong><small>Reply battles, long silences, shared language, and your chat verdict.</small></span>{chatType === 'dm' && <Check />}</button>
    </div><Button wide onClick={() => setStep('guide')}>Show me how to export <ArrowRight size={19} /></Button>
  </motion.section></Shell>
}

export function ExportGuide() {
  const setStep = useApp((s) => s.setStep); const [platform, setPlatform] = useState<'iphone' | 'android'>('iphone')
  useEffect(() => track('export_guide_viewed'), [])
  const switchPlatform = (os:'iphone'|'android') => { setPlatform(os); track('export_tab_switched', { os }) }
  const steps = platform === 'iphone' ? [['Open the chat', 'Tap the name at the top.'], ['Export the chat', 'Scroll down and choose “Export Chat”.'], ['Keep it light', 'Pick “Without Media”, then save the file.']] : [['Open the chat', 'Tap the three-dot menu.'], ['Export the chat', 'Tap More, then “Export chat”.'], ['Keep it light', 'Pick “Without media”, then save the file.']]
  return <Shell back={() => setStep('choose')}><section className="guide"><div className="guide__intro"><h1>Four taps. No screenshots.</h1><p>WhatsApp can export any chat as a file. It takes under a minute.</p></div>
    <div className="platform-tabs" role="tablist"><button className={platform === 'iphone' ? 'is-active' : ''} onClick={() => switchPlatform('iphone')}>iPhone</button><button className={platform === 'android' ? 'is-active' : ''} onClick={() => switchPlatform('android')}>Android</button></div>
    <AnimatePresence mode="wait"><motion.ol key={platform} className="guide__steps" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>{steps.map(([title, copy], index) => <li key={title}><span>{index + 1}</span><Smartphone /><div><strong>{title}</strong><p>{copy}</p></div></li>)}</motion.ol></AnimatePresence>
    <div className="privacy-strip"><LockKeyhole /><span>{privacyCopy.short}</span></div><Button wide onClick={() => setStep('upload')}>I have the file <ArrowRight size={19} /></Button>
  </section></Shell>
}

export function Upload() {
  const { setStep, setChatType } = useApp(); const input = useRef<HTMLInputElement>(null); const [dragging, setDragging] = useState(false); const [error, setError] = useState('')
  const asksConsent = appConfig.aiPlanner && appConfig.aiMode === 'with-quotes'
  const next = () => { setPendingAiMode('facts-only'); if (!asksConsent) { setStep('processing'); return } void aiServerAvailable().then((available) => setStep(available ? 'ai-consent' : 'processing')) }
  const accept = (file?: File) => {
    if (!file) return
    if (!/\.(txt|zip)$/i.test(file.name)) { setError('U-201 · Choose the .txt or .zip file created by chat export.'); track('upload_failed', { code: 'U-201' }); return }
    setPendingFile(file); track('upload_started', { kind: /\.zip$/i.test(file.name) ? 'zip' : 'txt', fileKb: Math.round(file.size/1024) }); next()
  }
  const sample = (mock: MockChatId) => { setPendingMock(mock); setChatType(mock === 'couple' ? 'dm' : 'group'); track('upload_started', { kind: `mock-${mock}` }); setStep('processing') }
  return <Shell back={() => setStep('guide')}><section className="upload"><h1>Drop your chat.</h1><p>Choose the file WhatsApp exported. Every message gets counted.</p>
    <button className={`dropzone ${dragging ? 'is-dragging' : ''}`} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]) }}><span className="dropzone__icon"><UploadCloud /></span><strong>Choose your chat file</strong><small>.txt or .zip, or drag it here</small></button>
    <input ref={input} type="file" accept=".txt,.zip" hidden onChange={(e) => accept(e.target.files?.[0])} />{error && <p className="form-error" role="alert">{error}</p>}
    <div className="upload__divider"><span>No file yet? Try a sample</span></div><div className="sample-grid">
      <button onClick={() => sample('friends')}><MessagesSquare /><span><strong>Friends group</strong><small>Who dey awake at 3am</small></span></button>
      <button onClick={() => sample('study')}><BookOpenCheck /><span><strong>Study group</strong><small>Deadlines and rescues</small></span></button>
      <button onClick={() => sample('couple')}><Heart /><span><strong>Couple chat</strong><small>Replies and calls</small></span></button>
    </div><p className="upload__privacy"><LockKeyhole size={16} /> {privacyCopy.short}</p>
  </section></Shell>
}

export function AiConsent() {
  const setStep = useApp((s)=>s.setStep); const [agreed,setAgreed]=useState(false)
  return <Shell back={()=>setStep('upload')}><section className="consent">
    <h1>Let AI read your chat?</h1>
    <p>This is how your cards can say what you were actually talking about.</p>
    <ul>
      <li><strong>Sent:</strong> your messages, with sender names changed to “Person A”, “Person B”.</li>
      <li><strong>Removed first:</strong> phone numbers, emails and links.</li>
      <li><strong>Can still show:</strong> nicknames, and people who never sent a message here.</li>
      <li><strong>Afterwards:</strong> our server does not keep your messages.</li>
    </ul>
    <label><input type="checkbox" checked={agreed} onChange={(e)=>setAgreed(e.target.checked)} /><span><strong>I agree to send my chat to AI</strong><small>Very long chats are sampled from across the whole period.</small></span></label>
    <Button wide disabled={!agreed} onClick={()=>{ setPendingAiMode('with-quotes'); setStep('processing') }}>Make my cards <ArrowRight size={19} /></Button>
  </section></Shell>
}

const teasers = ['Reading timestamps and senders…', 'Computing reply times locally…', 'Ranking the surprising facts…', 'Planning a different card deck…']
function safeFallbackDeck(analysis: AnalysisResult): AnalysisResult {
  const incompleteIds = new Set(analysis.facts.filter((fact) => fact.kind === 'topic_context' && isPendingContext(fact.value)).map((fact) => fact.id))
  return {
    ...analysis,
    aiAttempted: true,
    aiChunks: undefined,
    facts: analysis.facts.filter((fact) => !incompleteIds.has(fact.id)).map((fact) => { const { sourceExcerpt: _sourceExcerpt, ...safeFact } = fact; return safeFact }),
    cards: analysis.cards.map((card) => ({ ...card, factIds: card.factIds.filter((id) => !incompleteIds.has(id)) }))
  }
}
export function Processing() {
  const { chatType, analysis, setAnalysis, setStep } = useApp(); const [progress,setProgress]=useState<AnalysisProgress>({percent:4,processed:0,total:0,label:'Opening export'}); const [teaser,setTeaser]=useState(0); const [error,setError]=useState(''); const abort=useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); abort.current = controller; const started=performance.now(); const input=getPendingInput(); let diagnostics: ParserDiagnostics | undefined; const teaserTimer=window.setInterval(()=>setTeaser((i)=>(i+1)%teasers.length),850)
    if (!input.file && !input.mock) {
      // After a successful run the input is cleared and the new analysis is already set.
      // Never fall back to a saved one here: it could be a different chat.
      if (analysis) setStep('story')
      else setError('U-202 · The upload session expired. Please choose the export again.')
      return ()=>{ clearInterval(teaserTimer); controller.abort() }
    }
    getAnalysis(chatType,{...input,signal:controller.signal,onProgress:setProgress,onDiagnostics:(value)=>{diagnostics=value}}).then(async(data)=>{ const parseMs=Math.round(performance.now()-started); if(controller.signal.aborted)return;const completed={...data,aiMode:input.aiMode,aiAttempted:Boolean(input.mock)}; timing('upload_to_parse',parseMs); track('parse_completed',{messageCount:data.totals.messages,memberCount:data.members.length,cards:data.cards.length,parseMs,fileKb:input.file?Math.round(input.file.size/1024):0,format:diagnostics?.format??'mock',clock:diagnostics?.clock??'mock',dateOrder:diagnostics?.dateOrder??'mock',unknownPct:diagnostics?.unknownPct??0,languageHint:diagnostics?.languageHint??'mock'});let planned:AnalysisResult=completed;if(appConfig.aiPlanner&&!input.mock&&!(await aiServerAvailable()))planned=safeFallbackDeck(completed);else if(appConfig.aiPlanner&&!input.mock){setProgress({percent:98,processed:data.totals.messages,total:data.totals.messages,label:input.aiMode==='with-quotes'?'AI is reading the full chat in parts':'AI is planning the story from the counts'});try{planned=await planAnalysisWithAi(completed,{signal:controller.signal})}catch(reason){if(reason instanceof DOMException&&reason.name==='AbortError')throw reason;trackError(reason,{step:'ai-plan-processing'});planned=safeFallbackDeck(completed)}}clearPendingInput();setAnalysis(planned);setProgress({percent:100,processed:data.totals.messages,total:data.totals.messages,label:'Story ready'});window.setTimeout(()=>setStep('story'),150) }).catch((reason)=>{ if (reason?.name==='AbortError') return; const message=reason instanceof Error?reason.message:'P-100 · This export could not be read.'; setError(message); trackError(reason,{step:'processing'}); track('parse_failed',{code:message.match(/[A-Z]-\d{3}/)?.[0]??'P-100'}) })
    return ()=>{ clearInterval(teaserTimer); controller.abort() }
  }, [analysis,chatType,setAnalysis,setStep])
  if(error) return <Shell><section className="processing-error"><span><X /></span><h1>We couldn’t read this export.</h1><p>{error}</p><Button onClick={()=>setStep('upload')}>Choose another file</Button><small>Send support only the code above and your session ID—never the chat file.</small></section></Shell>
  return <Shell><section className="processing"><div className="processing__deck"><div/><div/><motion.div animate={{rotate:[2,-3,2],y:[0,-8,0]}} transition={{duration:1.4,repeat:Infinity}}><span>{Math.round(progress.percent)}%</span></motion.div></div><h1>Reading the room…</h1><AnimatePresence mode="wait"><motion.p key={teaser} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}}>{progress.label || teasers[teaser]}</motion.p></AnimatePresence><div className="progress-track"><motion.i animate={{width:`${progress.percent}%`}}/></div>{progress.total>0&&<small>{progress.processed.toLocaleString()} of {progress.total.toLocaleString()} lines</small>}<p>{privacyCopy.processing}</p><button className="cancel-parse" onClick={()=>{abort.current?.abort();clearPendingInput();setStep('upload')}}>Cancel</button></section></Shell>
}
