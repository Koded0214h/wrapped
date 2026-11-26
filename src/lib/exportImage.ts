import { toPng } from 'html-to-image'

const painted = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'] as const

// html-to-image drops stylesheet rules for shapes inside an <svg>, which turns the characters
// black in saved images. Writing the computed paint onto each shape carries it across.
function keepSvgPaint(node: HTMLElement) {
  for (const shape of node.querySelectorAll<SVGElement>('svg *')) {
    const computed = getComputedStyle(shape)
    for (const property of painted) shape.style.setProperty(property, computed.getPropertyValue(property))
  }
}

export function cardToPng(node: HTMLElement, backgroundColor: string) {
  keepSvgPaint(node)
  return toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor })
}
