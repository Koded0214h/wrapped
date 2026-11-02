import { useEffect, useState } from 'react'
import { Building2, Check, CreditCard, LockKeyhole, RotateCcw, Smartphone } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useApp, type Purchase } from '../store/useApp'
import { getSessionId, track, trackError } from '../lib/telemetry'
import { brand } from '../config/brand'
import { appConfig } from '../config/appConfig'
import type { Card } from '../analysis/types'

const productNames: Record<Purchase, string> = { core: 'Full story unlock', everything: 'Everything pack', theme: 'Premium theme', font: 'Premium font', savage: 'Savage mode', watermark: 'Watermark removal', awards: 'Bonus award cards' }
const prices: Record<Purchase, { usd: string; ngn: string }> = { core: { usd: '$1.99', ngn: '₦1,500' }, everything: { usd: '$3.99', ngn: '₦3,200' }, theme: { usd: '$0.99', ngn: '₦800' }, font: { usd: '$0.99', ngn: '₦800' }, savage: { usd: '$0.99', ngn: '₦800' }, watermark: { usd: '$0.99', ngn: '₦800' }, awards: { usd: '$0.99', ngn: '₦800' } }
type Channel = 'card' | 'bank' | 'ussd'

async function post(path: string, payload: object) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json()
  if (!response.ok) throw new Error(String(result.error || 'C-301: Checkout failed.'))
  return result
}

export function Checkout({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const unlock = useApp((s) => s.unlock)
  const analysis = useApp((s) => s.analysis)
  const setAnalysis = useApp((s) => s.setAnalysis)
  const [currency, setCurrency] = useState<'usd' | 'ngn'>('ngn')
  const [channel, setChannel] = useState<Channel>('card')
  const [email, setEmail] = useState('')
  const [reference, setReference] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [status, setStatus] = useState<'ready' | 'paying' | 'done'>('ready')
  const [error, setError] = useState('')
  useEffect(() => { track('checkout_opened', { method: channel, product: purchase }) }, [channel, purchase])

  const generatePaidCards = async () => {
    if (!appConfig.aiPlanner || !analysis) return
    try {
      const result = await post('/api/cards/plan', { facts: analysis.facts, sessionId: getSessionId() }) as { cards?: Card[]; fallback?: boolean }
      if (!result.fallback && result.cards?.length) {
        const deterministicVerdict = analysis.cards.find((card) => card.layout === 'verdict')
        const aiVerdict = result.cards.find((card) => card.layout === 'verdict')
        const aiInsights = result.cards.filter((card) => card.layout !== 'verdict')
        setAnalysis({ ...analysis, cards: [...analysis.cards.slice(0, 2).map((card) => ({ ...card, locked: false })), ...aiInsights, ...(aiVerdict ? [aiVerdict] : deterministicVerdict ? [{ ...deterministicVerdict, locked: false }] : [])] })
      }
    } catch (caught) { trackError(caught, { step: 'ai-plan' }) }
  }

  const pay = async () => {
    setStatus('paying'); setError('')
    try {
      const result = await post('/api/payments/init', { product: purchase, currency: currency.toUpperCase(), channel, email, sessionId: getSessionId() })
      setReference(result.reference)
      if (result.mock) {
        await post('/api/payments/mock-complete', { reference: result.reference })
        unlock(purchase); await generatePaidCards(); setStatus('done'); track('payment_succeeded', { channel, currency }); track('unlock_confirmed', { via: 'webhook' })
      } else location.assign(result.authorizationUrl)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'C-301: Checkout failed.'
      setError(message); setStatus('ready'); track('payment_failed', { reason: message.match(/[A-Z]-\d{3}/)?.[0] || 'C-301' }); trackError(caught, { step: 'checkout' })
    }
  }
  const recover = async () => {
    setStatus('paying'); setError(''); track('recovery_started')
    try { await post('/api/payments/recover', { reference, sessionId: getSessionId() }); unlock('core'); await generatePaidCards(); setStatus('done'); track('recovery_succeeded'); track('unlock_confirmed', { via: 'recovery' }) }
    catch (caught) { const message = caught instanceof Error ? caught.message : 'K-401: Payment not found.'; setError(message); setStatus('ready'); track('unlock_failed', { code: 'K-401' }) }
  }
  const close = () => { if (status !== 'done') track('checkout_abandoned', { product: purchase }); onClose() }

  return <Modal title={status === 'done' ? 'You’re in!' : recovering ? 'Paid but still locked?' : 'Unlock the good part'} onClose={close}>
    {status === 'done' ? <div className="checkout-success"><span><Check /></span><h3>{productNames[purchase]} unlocked</h3><p>Saved on this device. Keep your reference if you switch browsers.</p>{reference && <code>{reference}</code>}<Button wide onClick={onClose}>Continue</Button></div>
      : recovering ? <div className="checkout"><p>Enter the reference from your payment receipt. We’ll verify it with the provider and restore access.</p><label>Payment reference<input value={reference} onChange={(event) => setReference(event.target.value.slice(0, 40))} placeholder="cw_..." /></label>{error && <p className="form-error">{error}</p>}<Button wide onClick={recover} disabled={status === 'paying' || !reference}>{status === 'paying' ? 'Checking…' : 'Restore my unlock'}</Button><button className="text-button" onClick={() => { setRecovering(false); setError('') }}>Back to checkout</button></div>
      : <div className="checkout">
        <div className="currency-toggle"><button className={currency === 'ngn' ? 'is-active' : ''} onClick={() => setCurrency('ngn')}>NGN</button><button className={currency === 'usd' ? 'is-active' : ''} onClick={() => setCurrency('usd')}>USD</button></div>
        <div className="checkout__product"><span>{productNames[purchase]}</span><strong>{prices[purchase][currency]}</strong></div>
        <label>Receipt email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        {currency === 'ngn' && <div className="channel-picker" role="group" aria-label="Payment method"><button className={channel === 'card' ? 'is-active' : ''} onClick={() => setChannel('card')}><CreditCard />Card</button><button className={channel === 'bank' ? 'is-active' : ''} onClick={() => setChannel('bank')}><Building2 />Bank</button><button className={channel === 'ussd' ? 'is-active' : ''} onClick={() => setChannel('ussd')}><Smartphone />USSD</button></div>}
        <ul><li><Check /> One-time purchase</li><li><Check /> Unlock saved on this device</li><li><LockKeyhole /> No chat text is sent with payment</li></ul>
        {error && <p className="form-error">{error}</p>}
        <Button wide onClick={pay} disabled={status === 'paying' || !email}>{status === 'paying' ? 'Opening secure checkout…' : <><CreditCard size={19} /> Pay {prices[purchase][currency]}</>}</Button>
        <button className="recovery-link" onClick={() => { setRecovering(true); setError('') }}><RotateCcw /> Paid but still locked?</button>
        <small>Card, bank and USSD are processed by Paystack when configured. Local development uses a mock transaction.</small>
        <p className="support-line">Need help? <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a> · <a href={`https://wa.me/${brand.supportWhatsApp.replace(/\D/g, '')}`}>WhatsApp support</a></p>
      </div>}
  </Modal>
}
