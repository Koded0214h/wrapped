import { useEffect, useState } from 'react'
import { Check, CreditCard, LockKeyhole, RotateCcw } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useApp, type Purchase } from '../store/useApp'
import { track, trackError } from '../lib/telemetry'
import { postJson, recoverPurchase, rememberPendingPayment } from '../lib/payments'
import { getPurchaseId } from '../lib/purchaseId'
import { brand } from '../config/brand'
import { products } from '../config/products'

export function Checkout({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { unlock, setTheme, setFont, setSavage } = useApp()
  const [email, setEmail] = useState('')
  const [reference, setReference] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [restored, setRestored] = useState<Purchase | null>(null)
  const [status, setStatus] = useState<'ready' | 'paying' | 'done'>('ready')
  const [error, setError] = useState('')
  const product = products[purchase]
  const isStyle = purchase === 'theme' || purchase === 'font' || purchase === 'savage'
  useEffect(() => { track('checkout_opened', { product: purchase }) }, [purchase])

  const pay = async () => {
    setStatus('paying'); setError('')
    try {
      const result = await postJson('/api/payments/init', { product: purchase, currency: 'NGN', email, sessionId: getPurchaseId() })
      setReference(result.reference)
      if (result.mock) {
        await postJson('/api/payments/mock-complete', { reference: result.reference })
        unlock(purchase); setStatus('done'); track('payment_succeeded', { channel: 'mock', currency: 'ngn' })
      } else { rememberPendingPayment(result.reference); location.assign(result.checkoutUrl) }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'C-301: Checkout failed.'
      setError(message); setStatus('ready'); track('payment_failed', { reason: message.match(/[A-Z]-\d{3}/)?.[0] || 'C-301' }); trackError(caught, { step: 'checkout' })
    }
  }
  const recover = async () => {
    setStatus('paying'); setError(''); track('recovery_started')
    try { const result = await recoverPurchase(reference); unlock(result.product); setRestored(result.product); setStatus('done'); track('recovery_succeeded') }
    catch (caught) { const message = caught instanceof Error ? caught.message : 'K-401: Payment not found.'; setError(message); setStatus('ready'); track('unlock_failed', { code: 'K-401' }) }
  }
  const useFreeStyle = () => { setTheme('sunset'); setFont('bricolage'); setSavage(false); onClose() }
  const close = () => { if (status !== 'done') track('checkout_abandoned', { product: purchase }); onClose() }

  return <Modal title={status === 'done' ? 'You’re in!' : recovering ? 'Paid but still locked?' : 'Make it yours'} onClose={close}>
    {status === 'done' ? <div className="checkout-success"><span><Check /></span><h3>{products[restored ?? purchase].name} unlocked</h3><p>Saved on this device. Keep your reference if you switch browsers.</p>{reference && <code>{reference}</code>}<Button wide onClick={onClose}>Continue</Button></div>
      : recovering ? <div className="checkout"><p>Enter your reference (starts with cw_) or the Bachs payment ID (starts with chk_).</p><label>Payment reference<input value={reference} onChange={(event) => setReference(event.target.value.trim().slice(0, 80))} placeholder="cw_..." /></label>{error && <p className="form-error">{error}</p>}<Button wide onClick={recover} disabled={status === 'paying' || !reference}>{status === 'paying' ? 'Checking…' : 'Restore my unlock'}</Button><button className="text-button" onClick={() => { setRecovering(false); setError('') }}>Back to checkout</button></div>
      : <div className="checkout">
        <div className="checkout__product"><span>{product.name}</span><strong>{product.price}</strong></div>
        <label>Receipt email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <ul><li><Check /> One-time purchase</li><li><Check /> Works on every chat on this device</li><li><LockKeyhole /> No chat text is sent with payment</li></ul>
        {error && <p className="form-error">{error}</p>}
        <Button wide onClick={pay} disabled={status === 'paying' || !email}>{status === 'paying' ? 'Opening secure checkout…' : <><CreditCard size={19} /> Pay {product.price}</>}</Button>
        {isStyle && <button className="text-button" onClick={useFreeStyle}>No thanks, use the free style</button>}
        <button className="recovery-link" onClick={() => { setRecovering(true); setError('') }}><RotateCcw /> Paid but still locked?</button>
        <small>Payments are processed on Bachs’ secure checkout page. Local development uses a mock transaction.</small>
        <p className="support-line">Need help? <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a> · <a href={`https://wa.me/${brand.supportWhatsApp.replace(/\D/g, '')}`}>WhatsApp support</a></p>
      </div>}
  </Modal>
}
