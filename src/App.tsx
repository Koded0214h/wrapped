import { useEffect, useState } from 'react'
import { Landing } from './screens/Landing'
import { AiConsent, ChooseType, ExportGuide, Processing, Upload } from './screens/SetupFlow'
import { Story } from './screens/Story'
import { Modal } from './components/Modal'
import { useApp } from './store/useApp'
import { loadAnalysis } from './analysis/analysisCache'
import { privacyCopy } from './config/appConfig'
import { brand } from './config/brand'
import { setTelemetryStep } from './lib/telemetry'

export default function App() {
  const step = useApp((s) => s.step)
  const analysis = useApp((s) => s.analysis)
  const setAnalysis = useApp((s) => s.setAnalysis)
  useEffect(() => setTelemetryStep(step), [step])
  useEffect(() => { if (!analysis && step === 'story') void loadAnalysis().then((saved) => saved ? setAnalysis(saved) : useApp.getState().setStep('landing')) }, [analysis, setAnalysis, step])
  const [privacy, setPrivacy] = useState(false)
  return <>
    {step === 'landing' && <Landing openPrivacy={() => setPrivacy(true)} />}
    {step === 'choose' && <ChooseType />}
    {step === 'guide' && <ExportGuide />}
    {step === 'upload' && <Upload />}
    {step === 'ai-consent' && <AiConsent />}
    {step === 'processing' && <Processing />}
    {step === 'story' && <Story />}
    {privacy && <Modal title="Your chat stays yours" onClose={() => setPrivacy(false)}><div className="privacy-copy"><p>{privacyCopy.short} Raw messages are discarded after aggregate facts are calculated.</p><h3>What we collect</h3><p>Event counts, coarse device type, timings, error codes, payment references, and anonymous session IDs. We never collect chat text, member names, file names, or chat names.</p><h3>What stays local</h3><p>Your analysis is saved in this browser so a refresh or checkout return does not lose it. Use “Hide names” before posting if you do not have everyone’s consent.</p><h3>Deletion and NDPA requests</h3><p>Email {brand.supportEmail} with a payment reference. Do not send your chat export.</p></div></Modal>}
  </>
}
