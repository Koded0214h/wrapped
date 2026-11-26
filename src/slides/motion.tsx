import { createContext, useContext, useEffect, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'

/** True when a card must render finished: while saving an image, or for reduced motion. */
export const StillContext = createContext(false)
/** Seconds into a card, while the video is being drawn frame by frame. */
export const ClockContext = createContext<number | null>(null)
export function useStill() {
  const reduced = useReducedMotion()
  return useContext(StillContext) || Boolean(reduced)
}

const numbers = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

/** Numbers climb to their value. Anything that is not a number is shown as is. */
export function CountUp({ value, duration = 1100 }: { value: number | string; duration?: number }) {
  const still = useStill()
  const clock = useContext(ClockContext)
  const target = typeof value === 'number' ? value : undefined
  const [shown, setShown] = useState(still ? target : 0)
  useEffect(() => {
    if (target === undefined || still) return
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - (1 - progress) ** 3
      setShown(progress === 1 ? target : Number.isInteger(target) ? Math.round(target * eased) : Math.round(target * eased * 10) / 10)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [duration, still, target])
  if (target === undefined) return <>{value}</>
  if (clock !== null) {
    const eased = 1 - (1 - Math.min(1, clock * 1000 / duration)) ** 3
    return <>{numbers.format(Number.isInteger(target) ? Math.round(target * eased) : Math.round(target * eased * 10) / 10)}</>
  }
  return <>{numbers.format((still ? target : shown) ?? 0)}</>
}

// Spread positions without Math.random, so a re-render does not reshuffle mid-fall.
const spread = (index: number, step: number) => (index * step) % 1

export const RAIN_DROPS = 26
/** Where and when each falling emoji goes. The video draws the same shower from this. */
export const rainDrop = (index: number) => ({
  left: spread(index, 0.618) * 0.92,
  rem: 1 + spread(index, 0.37) * 1.2,
  delay: spread(index, 0.29) * 1.3,
  duration: 1.7 + spread(index, 0.53) * 1.4,
  spin: index % 2 ? 260 : -260
})

/** The chat's emojis drop through the card once. */
export function EmojiRain({ emojis }: { emojis: string[] }) {
  const still = useStill()
  if (still || !emojis.length) return null
  return <div className="emoji-rain" aria-hidden="true">
    {Array.from({ length: RAIN_DROPS }, (_, index) => {
      const drop = rainDrop(index)
      return <span key={index} style={{ left: `${drop.left * 100}%`, fontSize: `${drop.rem}rem`, animationDelay: `${drop.delay}s`, animationDuration: `${drop.duration}s`, '--spin': `${drop.spin}deg` } as CSSProperties}>{emojis[index % emojis.length]}</span>
    })}
  </div>
}
