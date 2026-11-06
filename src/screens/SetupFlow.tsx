import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, FileArchive, Heart, LockKeyhole, MessageCircleMore, MessagesSquare, Smartphone, UploadCloud, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { useApp } from '../store/useApp'
import { getAnalysis, type AnalysisProgress, type MockChatId } from '../analysis/getAnalysis'
import { clearPendingInput, getPendingInput, setPendingFile, setPendingMock } from '../analysis/pendingInput'
import { appConfig, privacyCopy } from '../config/appConfig'
import { timing, track, trackError } from '../lib/telemetry'
import type { ParserDiagnostics } from '../analysis/parseExport'
import { loadAnalysis } from '../analysis/analysisCache'

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
  return <Shell back={() => setStep('choose')}><section className="guide"><div className="guide__intro"><h1>Four taps. No screenshots.</h1><p>Your phone gives you a text export that can be analysed locally.</p></div>
    <div className="platform-tabs" role="tablist"><button className={platform === 'iphone' ? 'is-active' : ''} onClick={() => switchPlatform('iphone')}>iPhone</button><button className={platform === 'android' ? 'is-active' : ''} onClick={() => switchPlatform('android')}>Android</button></div>
    <AnimatePresence mode="wait"><motion.ol key={platform} className="guide__steps" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>{steps.map(([title, copy], index) => <li key={title}><span>{index + 1}</span><Smartphone /><div><strong>{title}</strong><p>{copy}</p></div></li>)}</motion.ol></AnimatePresence>
    <div className="privacy-strip"><LockKeyhole /><span><strong>Raw messages stay local.</strong> {privacyCopy.short}</span></div><Button wide onClick={() => setStep('upload')}>I have the file <ArrowRight size={19} /></Button>
  </section></Shell>
}

export function Upload() {
  const { setStep, setChatType } = useApp(); const input = useRef<HTMLInputElement>(null); const [dragging, setDragging] = useState(false); const [error, setError] = useState('')
  const next = () => setStep(appConfig.aiMode === 'with-quotes' ? 'ai-consent' : 'processing')
  const accept = (file?: File) => {
    if (!file) return
    if (!/\.(txt|zip)$/i.test(file.name)) { setError('U-201 · Choose the .txt or .zip file created by chat export.'); track('upload_failed', { code: 'U-201' }); return }
    setPendingFile(file); track('upload_started', { kind: /\.zip$/i.test(file.name) ? 'zip' : 'txt', fileKb: Math.round(file.size/1024) }); next()
  }
  const sample = (mock: MockChatId) => { setPendingMock(mock); setChatType(mock === 'couple' ? 'dm' : 'group'); track('upload_started', { kind: `mock-${mock}` }); next() }
  return <Shell back={() => setStep('guide')}><section className="upload"><h1>Drop the chat. We’ll find the facts.</h1><p>Real exports are parsed in a Web Worker. The most recent sixty thousand messages are used.</p>
    <button className={`dropzone ${dragging ? 'is-dragging' : ''}`} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]) }}><span className="dropzone__icon"><UploadCloud /></span><strong>Choose a .txt or .zip file</strong><small>or drag it right here</small></button>
    <input ref={input} type="file" accept=".txt,.zip" hidden onChange={(e) => accept(e.target.files?.[0])} />{error && <p className="form-error" role="alert">{error}</p>}
    <div className="upload__divider"><span>or verify the dynamic planner</span></div><div className="sample-grid">
      <button onClick={() => sample('friends')}><MessagesSquare /><span><strong>Friends group</strong><small>Night owls and chaos</small></span></button>
      <button onClick={() => sample('study')}><BookOpenCheck /><span><strong>Study group</strong><small>Deadlines and rescues</small></span></button>
      <button onClick={() => sample('couple')}><Heart /><span><strong>Couple DM</strong><small>Replies and silences</small></span></button>
    </div><p className="upload__privacy"><LockKeyhole size={16} /> {privacyCopy.short}</p>
  </section></Shell>
}

export function AiConsent() {
  const setStep = useApp((s)=>s.setStep); const [agreed,setAgreed]=useState(false)
  return <Shell back={()=>setStep('upload')}><section className="consent"><h1>Quotes need your permission.</h1><p>This mode may send selected message excerpts to the card planner. Names are replaced with member IDs first, but the words themselves leave this device.</p><label><input type="checkbox" checked={agreed} onChange={(e)=>setAgreed(e.target.checked)} /><span><strong>I understand and opt in</strong><small>I have permission to process this chat’s excerpts.</small></span></label><Button wide disabled={!agreed} onClick={()=>setStep('processing')}>Continue with quotes</Button><button onClick={()=>{ setStep('upload') }}>Go back and use facts-only mode</button></section></Shell>
}

const teasers = ['Reading timestamps and senders…', 'Computing reply times locally…', 'Ranking the surprising facts…', 'Planning a different card deck…']
export function Processing() {
  const { chatType, analysis, setAnalysis, setStep } = useApp(); const [progress,setProgress]=useState<AnalysisProgress>({percent:4,processed:0,total:0,label:'Opening export'}); const [teaser,setTeaser]=useState(0); const [error,setError]=useState(''); const abort=useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); abort.current = controller; const started=performance.now(); const input=getPendingInput(); let diagnostics: ParserDiagnostics | undefined; const teaserTimer=window.setInterval(()=>setTeaser((i)=>(i+1)%teasers.length),850)
    if (!input.file && !input.mock) {
      if (analysis) setStep('story')
      else void loadAnalysis().then((saved) => { if (saved) { setAnalysis(saved); setStep('story') } else setError('U-202 · The upload session expired. Please choose the export again.') })
      return ()=>{ clearInterval(teaserTimer); controller.abort() }
    }
    getAnalysis(chatType,{...input,signal:controller.signal,onProgress:setProgress,onDiagnostics:(value)=>{diagnostics=value}}).then((data)=>{ const parseMs=Math.round(performance.now()-started); clearPendingInput(); setAnalysis(data); timing('upload_to_parse',parseMs); track('parse_completed',{messageCount:data.totals.messages,memberCount:data.members.length,cards:data.cards.length,parseMs,fileKb:input.file?Math.round(input.file.size/1024):0,format:diagnostics?.format??'mock',clock:diagnostics?.clock??'mock',dateOrder:diagnostics?.dateOrder??'mock',unknownPct:diagnostics?.unknownPct??0,languageHint:diagnostics?.languageHint??'mock'}); setProgress({percent:100,processed:data.totals.messages,total:data.totals.messages,label:'Story ready'}); window.setTimeout(()=>setStep('story'),150) }).catch((reason)=>{ if (reason?.name==='AbortError') return; const message=reason instanceof Error?reason.message:'P-100 · This export could not be read.'; setError(message); trackError(reason,{step:'processing'}); track('parse_failed',{code:message.match(/[A-Z]-\d{3}/)?.[0]??'P-100'}) })
    return ()=>{ clearInterval(teaserTimer); controller.abort() }
  }, [analysis,chatType,setAnalysis,setStep])
  if(error) return <Shell><section className="processing-error"><span><X /></span><h1>We couldn’t read this export.</h1><p>{error}</p><Button onClick={()=>setStep('upload')}>Choose another file</Button><small>Send support only the code above and your session ID—never the chat file.</small></section></Shell>
  return <Shell><section className="processing"><div className="processing__deck"><div/><div/><motion.div animate={{rotate:[2,-3,2],y:[0,-8,0]}} transition={{duration:1.4,repeat:Infinity}}><span>{Math.round(progress.percent)}%</span></motion.div></div><h1>Reading the room…</h1><AnimatePresence mode="wait"><motion.p key={teaser} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}}>{progress.label || teasers[teaser]}</motion.p></AnimatePresence><div className="progress-track"><motion.i animate={{width:`${progress.percent}%`}}/></div>{progress.total>0&&<small>{progress.processed.toLocaleString()} of {progress.total.toLocaleString()} lines</small>}<p>{privacyCopy.processing}</p><button className="cancel-parse" onClick={()=>{abort.current?.abort();clearPendingInput();setStep('upload')}}>Cancel</button></section></Shell>
}
