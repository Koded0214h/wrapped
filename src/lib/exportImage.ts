import { toPng, toSvg } from 'html-to-image'

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

// Each element's browser defaults, read from a blank page with no stylesheets.
let blank: HTMLIFrameElement | undefined
const defaults = new Map<string, Record<string, string>>()
function defaultsFor(element: Element) {
  const key = `${element.namespaceURI} ${element.localName}`
  let known = defaults.get(key)
  if (known) return known
  if (!blank?.isConnected) {
    blank = document.createElement('iframe')
    blank.setAttribute('aria-hidden', 'true')
    blank.tabIndex = -1
    blank.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:400px;border:0;visibility:hidden'
    document.body.append(blank)
  }
  const doc = blank.contentDocument!
  const probe = doc.createElementNS(element.namespaceURI, element.localName)
  const parent = element.namespaceURI === 'http://www.w3.org/2000/svg' && element.localName !== 'svg'
    ? doc.body.querySelector('svg') ?? doc.body.appendChild(doc.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    : doc.body
  parent.append(probe)
  const computed = blank.contentWindow!.getComputedStyle(probe)
  known = {}
  for (let index = 0; index < computed.length; index++) known[computed[index]] = computed.getPropertyValue(computed[index])
  probe.remove()
  defaults.set(key, known)
  return known
}

/** Style properties that differ from the browser default somewhere in this card. The rest can be left
 * out of the copy without changing a pixel, which makes each moment much quicker to draw. */
function propertiesInUse(node: HTMLElement) {
  const used = new Set<string>()
  for (const element of [node, ...node.querySelectorAll('*')]) {
    const computed = getComputedStyle(element)
    const standard = defaultsFor(element)
    for (let index = 0; index < computed.length; index++) {
      const property = computed[index]
      if (!used.has(property) && computed.getPropertyValue(property) !== standard[property]) used.add(property)
    }
  }
  return used
}

/** A card's opening animation, kept as one copy of the card plus what moves at each moment. */
export type CardFilm = {
  /** The card as an SVG document, at the first moment. */
  xml: string
  /** For each moment, for each moving element: its opacity, translate, scale and rotate. */
  moves: string[][][]
  /** For each moment, the text of each climbing number. */
  counts: string[][]
}

/**
 * Copies the card once, then reads where everything that moves sits at each moment. Copying is the
 * slow part (every element's style), so this is about ten times quicker than one image per moment.
 */
export async function filmCard(node: HTMLElement, moments: number[], backgroundColor: string, countText: (element: HTMLElement, seconds: number) => string,
  /** Called between the slow steps, so work done in the background can let the page breathe. */
  rest: () => Promise<void> = async () => {}): Promise<CardFilm> {
  keepSvgPaint(node)
  const animations = node.getAnimations({ subtree: true })
  const targets = [...new Set(animations.map((animation) => (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null).filter((target): target is HTMLElement => Boolean(target)))]
  animations.forEach((animation) => animation.pause())
  const moves = moments.map((seconds) => {
    animations.forEach((animation) => { animation.currentTime = seconds * 1000 })
    return targets.map((target) => { const computed = getComputedStyle(target); return moving.map((property) => computed.getPropertyValue(property)) })
  })
  const counters = [...node.querySelectorAll<HTMLElement>('[data-count]')]
  const counts = moments.map((seconds) => counters.map((counter) => countText(counter, seconds)))
  // The copy is laid out with each number at its final value, so boxes are as wide as in the finished
  // card; the smaller values on the way up then sit inside them instead of being squeezed.
  const texts = counters.map((counter) => counter.firstChild)
  const before = texts.map((text) => text?.nodeValue ?? '')
  texts.forEach((text, index) => { if (text) text.nodeValue = counts[counts.length - 1][index] })
  // The copy starts at the first moment, written inline and marked so each later moment can be set.
  targets.forEach((target, index) => {
    target.dataset.film = String(index)
    target.style.setProperty('animation', 'none')
    moving.forEach((property, at) => target.style.setProperty(property, moves[0][index][at]))
  })
  try {
    const used = propertiesInUse(node)
    await rest()
    const url = await toSvg(node, { backgroundColor })
    await rest()
    const doc = new DOMParser().parseFromString(decodeURIComponent(url.slice(url.indexOf(',') + 1)), 'image/svg+xml')
    for (const element of doc.querySelectorAll<HTMLElement>('[style]')) {
      const style = element.style
      if (!style) continue
      for (let index = style.length - 1; index >= 0; index--) if (!used.has(style[index])) style.removeProperty(style[index])
    }
    return { xml: new XMLSerializer().serializeToString(doc), moves, counts }
  } finally {
    texts.forEach((text, index) => { if (text) text.nodeValue = before[index] })
    targets.forEach((target) => {
      delete target.dataset.film
      target.style.removeProperty('animation')
      moving.forEach((property) => target.style.removeProperty(property))
    })
  }
}

/** Draws each moment of a card, ready for the video. Done one card at a time, so memory stays low. */
export async function filmFrames(film: CardFilm, background: string, width: number, height: number, rest: () => Promise<void> = async () => {}) {
  const doc = new DOMParser().parseFromString(film.xml, 'image/svg+xml')
  const moved = [...doc.querySelectorAll<HTMLElement>('[data-film]')]
  const counters = [...doc.querySelectorAll('[data-count]')]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const paint = canvas.getContext('2d')!
  const serializer = new XMLSerializer()
  const frames: ImageBitmap[] = []
  for (let moment = 0; moment < film.moves.length; moment++) {
    await rest()
    for (const element of moved) {
      const values = film.moves[moment][Number(element.getAttribute('data-film'))]
      moving.forEach((property, at) => element.style.setProperty(property, values[at]))
    }
    counters.forEach((counter, index) => { counter.textContent = film.counts[moment][index] })
    const image = new Image()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializer.serializeToString(doc))}`
    await image.decode()
    paint.fillStyle = background
    paint.fillRect(0, 0, width, height)
    paint.drawImage(image, 0, 0, width, height)
    frames.push(await createImageBitmap(canvas))
  }
  return frames
}

export function cardToPng(node: HTMLElement, backgroundColor: string, pixelRatio = 3) {
  keepSvgPaint(node)
  return toPng(node, { pixelRatio, cacheBust: true, backgroundColor })
}
