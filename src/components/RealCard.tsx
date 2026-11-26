import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { CardRenderer } from '../slides/CardLayouts'
import { getTheme, type ThemeId } from '../themes/themes'
import type { AnalysisResult } from '../analysis/types'

export type Sample = { analysis: AnalysisResult; layout: string; theme?: ThemeId }

/** A story card exactly as the app renders it (360 × 640), scaled to its container. */
export function RealCard({ sample, still }: { sample: Sample; still?: boolean }) {
  const frame = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const node = frame.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 360))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const card = sample.analysis.cards.find((item) => item.layout === sample.layout)
  const style = { ...getTheme(sample.theme ?? 'sunset').variables, '--font-display': '"Bricolage Grotesque Variable", sans-serif', '--font-body': '"Manrope Variable", sans-serif' } as CSSProperties
  // The card's own buttons are not usable here, so it is inert and hidden from assistive technology.
  return <div className="real-card" ref={frame} aria-hidden="true" inert>
    {card && <div className="real-card__canvas" style={{ ...style, transform: `scale(${scale})` }}><CardRenderer still={still} card={card} facts={sample.analysis.facts} members={sample.analysis.members} savage={false} hideNames={false} watermark /></div>}
  </div>
}
