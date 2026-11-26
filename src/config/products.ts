import type { Purchase } from '../store/useApp'

// Display copy only. The server owns the real prices (server/index.mjs).
export const products: Record<Purchase, { name: string; price: string }> = {
  everything: { name: 'Everything pack', price: '₦3,200' },
  theme: { name: 'All premium themes', price: '₦800' },
  font: { name: 'All premium fonts', price: '₦800' },
  savage: { name: 'Savage mode', price: '₦800' },
  watermark: { name: 'Watermark removal', price: '₦800' },
  awards: { name: 'Bonus award cards', price: '₦800' }
}
