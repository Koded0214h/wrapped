import { useLayoutEffect, type RefObject } from 'react'

const MAX_LINES = 2
const SMALLEST_PX = 17

function shrink(heading: HTMLElement) {
  // The reduced-motion stylesheet gives everything a tiny transition, which would make each
  // measurement below read the size from before the change.
  heading.style.setProperty('transition', 'none', 'important')
  heading.style.fontSize = ''
  const minHeight = heading.style.minHeight
  heading.style.minHeight = '0'
  let size = parseFloat(getComputedStyle(heading).fontSize)
  const lines = () => Math.round(heading.offsetHeight / parseFloat(getComputedStyle(heading).lineHeight))
  while (size > SMALLEST_PX && lines() > MAX_LINES) heading.style.fontSize = `${--size}px`
  heading.style.minHeight = minHeight
}

/** Card headlines change with every chat, so any that would run past two lines is sized down. */
export function useTwoLineHeadings(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const fit = () => ref.current?.querySelectorAll<HTMLElement>('h2').forEach(shrink)
    fit()
    // Measured again when a display font arrives, because it changes the line breaks. The font is
    // only requested after the first paint, so `fonts.ready` can resolve too early on its own.
    document.fonts?.addEventListener('loadingdone', fit)
    void document.fonts?.ready.then(fit)
    return () => document.fonts?.removeEventListener('loadingdone', fit)
  })
}
