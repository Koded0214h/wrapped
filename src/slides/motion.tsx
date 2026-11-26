import { createContext, useContext, useEffect, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'

/** True when a card must render finished: while saving an image, or for reduced motion. */
export const StillContext = createContext(false)
export function useStill() {
  const reduced = useReducedMotion()
  return useContext(StillContext) || Boolean(reduced)
}

const numbers = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

/** Numbers climb to their value. Anything that is not a number is shown as is. */
export function CountUp({ value, duration = 1100 }: { value: number | string; duration?: number }) {
  const still = useStill()
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
  return <>{numbers.format((still ? target : shown) ?? 0)}</>
}

// Spread positions without Math.random, so a re-render does not reshuffle mid-fall.
const spread = (index: number, step: number) => (index * step) % 1

/** The chat's emojis drop through the card once. */
export function EmojiRain({ emojis, count = 26 }: { emojis: string[]; count?: number }) {
  const still = useStill()
  if (still || !emojis.length) return null
  return <div className="emoji-rain" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <span key={index} style={{
      left: `${spread(index, 0.618) * 92}%`,
      fontSize: `${1 + spread(index, 0.37) * 1.2}rem`,
      animationDelay: `${spread(index, 0.29) * 1.3}s`,
      animationDuration: `${1.7 + spread(index, 0.53) * 1.4}s`,
      '--spin': `${index % 2 ? 260 : -260}deg`
    } as CSSProperties}>{emojis[index % emojis.length]}</span>)}
  </div>
}
