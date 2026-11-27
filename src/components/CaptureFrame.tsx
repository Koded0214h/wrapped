import { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { Card } from '../analysis/types'

export type CaptureHandle = {
  /** Shows a card at this many seconds into its opening animation, and returns the node to capture. */
  show: (card: Card, clock: number) => Promise<HTMLElement>
  clear: () => void
}

type Props = { style: CSSProperties; render: (card: Card, clock: number) => ReactNode }

/**
 * An off-screen frame used only for video snapshots. It keeps its own state, so taking hundreds of
 * snapshots re-renders this frame alone and never the card the person is looking at.
 */
export const CaptureFrame = forwardRef<CaptureHandle, Props>(function CaptureFrame({ style, render }, ref) {
  const [shown, setShown] = useState<{ card: Card; clock: number } | null>(null)
  const node = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => ({
    async show(card, clock) {
      flushSync(() => setShown({ card, clock }))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (!node.current) throw new Error('E-301: Export card could not be prepared.')
      return node.current
    },
    clear: () => setShown(null)
  }), [])
  if (!shown) return null
  return <div className="export-deck" aria-hidden="true">
    <div className="export-frame export-frame--video" style={style} ref={node} key={shown.card.id}>{render(shown.card, shown.clock)}</div>
  </div>
})
