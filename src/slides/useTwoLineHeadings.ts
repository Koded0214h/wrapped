import { useLayoutEffect, type RefObject } from 'react'

const MAX_LINES = 3
const SMALLEST_PX = 18

function fit(heading: HTMLElement) {
  // Not laid out yet: a measurement now would shrink it for nothing.
  if (!heading.isConnected || heading.offsetWidth < 120) return
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

/** Card headlines change with every chat, so any that would run past three lines is sized down. */
export function useTwoLineHeadings(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const headings = [...ref.current?.querySelectorAll<HTMLElement>('h2') ?? []]
    const fitAll = () => { headings.forEach(fit); if (ref.current) placeSticker(ref.current) }
    fitAll()
    // Measured again when a display font arrives, because it changes the line breaks. The font is
    // only requested after the first paint, so `fonts.ready` can resolve too early on its own.
    document.fonts?.addEventListener('loadingdone', fitAll)
    void document.fonts?.ready.then(fitAll)
    // And whenever a headline's width changes, such as when the card first gets its size.
    // Fitting changes only the height, so this cannot loop.
    const widths = new WeakMap<Element, number>()
    const watcher = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver((entries) => entries.forEach((entry) => {
      const width = Math.round(entry.contentRect.width)
      if (widths.get(entry.target) === width) return
      widths.set(entry.target, width)
      fit(entry.target as HTMLElement)
      if (ref.current) placeSticker(ref.current)
    }))
    headings.forEach((heading) => watcher?.observe(heading))
    return () => { document.fonts?.removeEventListener('loadingdone', fitAll); watcher?.disconnect() }
  })
}

/** Shows the card's sticker only when the content leaves a real gap above the closing line, and centres it there. */
export function placeSticker(slide: HTMLElement) {
  const sticker = slide.querySelector<HTMLElement>('.card-sticker')
  if (!sticker) return
  const closing = slide.querySelector<HTMLElement>('.slide__roast, .group-caption')
  const above = closing?.previousElementSibling as HTMLElement | null
  if (!closing || !above) { sticker.hidden = true; return }
  const top = above.offsetTop + above.offsetHeight
  const gap = closing.offsetTop - top
  const size = Math.min(150, gap - 34)
  sticker.hidden = size < 92
  if (sticker.hidden) return
  sticker.style.setProperty('--sticker-size', `${size}px`)
  sticker.style.top = `${top + (gap - size) / 2}px`
}
