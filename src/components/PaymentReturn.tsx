import { useEffect, useState } from 'react'
import { useApp } from '../store/useApp'
import { forgetPendingPayment, pendingPayment, recoverPurchase, returnedCheckout } from '../lib/payments'
import { appConfig } from '../config/appConfig'
import { products } from '../config/products'
import { track, trackError } from '../lib/telemetry'
import { Modal } from './Modal'

let handled = false

/** Unlocks the purchase when the buyer lands back from the payment page. */
export function PaymentReturn() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    const returned = returnedCheckout(location.search)
    const id = returned ?? pendingPayment()
    if (handled || !id || appConfig.freeAccess) return
    handled = true
    // Without a redirect this is only a background check, so stay quiet unless it succeeds.
    if (returned) setMessage('Confirming your payment…')
    void recoverPurchase(id).then(({ product, reference }) => {
      useApp.getState().unlock(product)
      forgetPendingPayment()
      history.replaceState(null, '', location.pathname)
      track('unlock_confirmed', { via: returned ? 'return' : 'recovery' })
      setMessage(`${products[product].name} unlocked. Keep this reference to restore it on another browser: ${reference}`)
    }).catch((error) => {
      if (!returned) return
      trackError(error, { step: 'payment-return' })
      // The id stays in the address bar, so reloading tries again.
      setMessage(`We could not confirm this payment yet. A bank transfer can take a few minutes: reload to check again. Payment ID: ${returned}`)
    })
  }, [])
  return message ? <Modal title="Your payment" onClose={() => setMessage('')}><p style={{ overflowWrap: 'anywhere' }}>{message}</p></Modal> : null
}
