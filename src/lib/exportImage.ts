import { toPng } from 'html-to-image'

const painted = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'stop-color', 'stop-opacity', 'stroke-opacity', 'fill-opacity'] as const

// html-to-image drops stylesheet rules for shapes inside an <svg>, which turns the characters
// black in saved images. Writing the computed paint onto each shape carries it across.
function keepSvgPaint(node: HTMLElement) {
  for (const shape of node.querySelectorAll<SVGElement>('svg *')) {
    const computed = getComputedStyle(shape)
    for (const property of painted) shape.style.setProperty(property, computed.getPropertyValue(property))
  }
}

const moving = ['opacity', 'translate', 'scale', 'rotate'] as const

/** Holds every animation in the card at one moment, written inline so the saved image keeps it. */
export function freezeAt(node: HTMLElement, seconds: number) {
  const targets = [...new Set(node.getAnimations({ subtree: true }).map((animation) => {
    animation.pause()
    animation.currentTime = seconds * 1000
    return (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null
  }).filter((target): target is HTMLElement => Boolean(target)))]
  const values = targets.map((target) => { const computed = getComputedStyle(target); return moving.map((property) => computed.getPropertyValue(property)) })
  targets.forEach((target, index) => {
    target.style.setProperty('animation', 'none')
    moving.forEach((property, at) => target.style.setProperty(property, values[index][at]))
  })
  return () => targets.forEach((target) => { target.style.removeProperty('animation'); moving.forEach((property) => target.style.removeProperty(property)) })
}

export function cardToPng(node: HTMLElement, backgroundColor: string, pixelRatio = 3) {
  keepSvgPaint(node)
  return toPng(node, { pixelRatio, cacheBust: true, backgroundColor })
}
