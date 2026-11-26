import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { MemberCharacter } from '../components/MemberCharacter'
import { getTheme, type ThemeId } from '../themes/themes'

/** Canvas size of one card face: 9:16, drawn in the same 360 × 640 units the real cards use. */
const W = 600
const H = 1066
const S = W / 360
const display = '"Gluten Variable", "Nunito Variable", sans-serif'
const body = '"Nunito Variable", sans-serif'

type Palette = Record<'bgFrom' | 'bgTo' | 'surface' | 'text' | 'muted' | 'accent' | 'accent2', string>
const palette = (id: ThemeId): Palette => {
  const v = getTheme(id).variables
  return { bgFrom: v['--bg-from'], bgTo: v['--bg-to'], surface: v['--surface'], text: v['--text'], muted: v['--muted'], accent: v['--accent'], accent2: v['--accent-2'] }
}

/** The avatar rules from the app stylesheet, so a rasterised avatar matches the one on a real card. */
function avatarCss() {
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) if (rule instanceof CSSStyleRule && rule.selectorText.includes('member-character__')) css += rule.cssText
    } catch { /* a cross-origin sheet cannot be read */ }
  }
  return css
}

async function avatarImage(id: string, colors: Palette) {
  const markup = renderToStaticMarkup(createElement(MemberCharacter, { member: { id, name: id }, size: 'lg' }))
  const svg = markup.slice(markup.indexOf('<svg'), markup.lastIndexOf('</svg>') + 6)
    .replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" style="--accent:${colors.accent};--accent-2:${colors.accent2};--surface:${colors.surface};--text:${colors.text}"`)
    .replace(/(<svg[^>]*>)/, `$1<style>${avatarCss()}</style>`)
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  return image
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath()
  ctx.roundRect(x * S, y * S, w * S, h * S, Array.isArray(r) ? r.map((value) => value * S) : r * S)
}

function sticker(ctx: CanvasRenderingContext2D, c: Palette, x: number, y: number, w: number, h: number, r: number | number[], fill: string, shadow = 3) {
  roundRect(ctx, x + shadow, y + shadow, w, h, r); ctx.fillStyle = c.text; ctx.fill()
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2 * S; ctx.strokeStyle = c.text; ctx.stroke()
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = 800, font = body, align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size * S}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'
  ctx.fillText(value, x * S, y * S)
}

function wrap(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, size: number, color: string, lineHeight = 1.04, font = display, weight = 760, align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size * S}px ${font}`
  const words = value.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth * S && line) { lines.push(line); line = word } else line = next
  }
  lines.push(line)
  lines.forEach((item, index) => text(ctx, item, x, y + index * size * lineHeight, size, color, weight, font, align))
  return y + (lines.length - 1) * size * lineHeight
}

function frame(ctx: CanvasRenderingContext2D, c: Palette, label: string, icon: string) {
  ctx.save()
  roundRect(ctx, 0, 0, 360, 640, 26); ctx.clip()
  const base = ctx.createLinearGradient(0, 0, W * .4, H)
  base.addColorStop(0, c.bgFrom); base.addColorStop(1, c.bgTo)
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H)
  const blob = ctx.createRadialGradient(W * 1.05, -H * .04, 0, W * 1.05, -H * .04, W * 1.1)
  blob.addColorStop(0, `${c.accent}cc`); blob.addColorStop(1, `${c.accent}00`)
  ctx.fillStyle = blob; ctx.fillRect(0, 0, W, H)
  const low = ctx.createRadialGradient(-W * .1, H * 1.05, 0, -W * .1, H * 1.05, W * .95)
  low.addColorStop(0, `${c.accent2}44`); low.addColorStop(1, `${c.accent2}00`)
  ctx.fillStyle = low; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = `${c.text}1c`
  for (let y = 8; y < 640; y += 15) for (let x = 8; x < 360; x += 15) if (y < 230 || y > 470) { ctx.beginPath(); ctx.arc(x * S, y * S, 1.1 * S, 0, Math.PI * 2); ctx.fill() }
  // sticker label
  ctx.save(); ctx.translate(22 * S, 40 * S); ctx.rotate(-.035)
  ctx.font = `850 ${9.5 * S}px ${body}`
  const labelWidth = ctx.measureText(label).width / S + 24
  roundRect(ctx, 2, -14, labelWidth, 24, 12); ctx.fillStyle = c.accent2; ctx.fill()
  roundRect(ctx, 0, -16, labelWidth, 24, 12); ctx.fillStyle = c.text; ctx.fill()
  text(ctx, label, 12, 0, 9.5, c.surface, 850)
  ctx.restore()
  // icon bubble
  ctx.beginPath(); ctx.arc(325 * S, 37 * S, 15 * S, 0, Math.PI * 2); ctx.fillStyle = c.text; ctx.fill()
  ctx.beginPath(); ctx.arc(323 * S, 35 * S, 15 * S, 0, Math.PI * 2); ctx.fillStyle = c.surface; ctx.fill(); ctx.lineWidth = 2 * S; ctx.strokeStyle = c.text; ctx.stroke()
  text(ctx, icon, 323, 41, 15, c.text, 400, 'sans-serif', 'center')
}

function bubble(ctx: CanvasRenderingContext2D, c: Palette, value: string, y: number) {
  ctx.font = `750 ${12.5 * S}px ${body}`
  const width = Math.min(300, ctx.measureText(value).width / S + 30)
  const lines = ctx.measureText(value).width / S > 270 ? 2 : 1
  const height = lines === 2 ? 52 : 36
  sticker(ctx, c, 22, y, width, height, [18, 18, 18, 5], c.surface)
  ctx.beginPath(); ctx.moveTo(22 * S, (y + height) * S); ctx.lineTo(36 * S, (y + height) * S); ctx.lineTo(22 * S, (y + height + 11) * S); ctx.closePath(); ctx.fillStyle = c.text; ctx.fill()
  wrap(ctx, value, 36, y + 23, width - 28, 12.5, c.text, 1.3, body, 750)
  text(ctx, 'chat-wrapped.kodedlabs.com', 338, 628, 8, `${c.text}99`, 800, body, 'right')
}

type Face = (ctx: CanvasRenderingContext2D, avatars: (id: string, c: Palette) => Promise<HTMLImageElement | null>) => Promise<void>

const avatarAt = async (ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, c: Palette, x: number, y: number, size: number) => {
  ctx.save()
  ctx.beginPath(); ctx.arc((x + size / 2 + 2.5) * S, (y + size / 2 + 3) * S, (size / 2 + 2) * S, 0, Math.PI * 2); ctx.fillStyle = c.text; ctx.fill()
  ctx.beginPath(); ctx.arc((x + size / 2) * S, (y + size / 2) * S, (size / 2 + 2.5) * S, 0, Math.PI * 2); ctx.fillStyle = c.surface; ctx.fill()
  ctx.beginPath(); ctx.arc((x + size / 2) * S, (y + size / 2) * S, (size / 2) * S, 0, Math.PI * 2); ctx.fillStyle = c.accent; ctx.fill(); ctx.clip()
  if (image) ctx.drawImage(image, x * S, y * S, size * S, size * S)
  ctx.restore()
}

const faces: Face[] = [
  async (ctx, avatars) => {
    const c = palette('sunset')
    frame(ctx, c, 'THE YAP LEADERBOARD', '👑')
    wrap(ctx, 'Zainab yaps the most, no contest.', 22, 104, 300, 34, c.text)
    const rows: [string, string, number][] = [['zainab', 'Zainab', 21942], ['amaka', 'Amaka', 20218], ['tobi', 'Tobi', 16855], ['femi', 'Femi', 13420], ['chioma', 'Chioma', 12331]]
    for (const [index, [id, name, value]] of rows.entries()) {
      const y = 200 + index * 56
      sticker(ctx, c, 22, y, 316, 44, 14, index === 0 ? c.accent : c.surface, 2)
      await avatarAt(ctx, await avatars(id, c), c, 30, y + 6, 32)
      text(ctx, name, 72, y + 27, 13, c.text, 850)
      roundRect(ctx, 140, y + 16, 120, 12, 6); ctx.fillStyle = c.surface; ctx.fill(); ctx.lineWidth = 2 * S; ctx.strokeStyle = c.text; ctx.stroke()
      roundRect(ctx, 140, y + 16, 120 * value / 21942, 12, 6); ctx.fillStyle = c.accent2; ctx.fill(); ctx.stroke()
      text(ctx, value.toLocaleString('en-GB'), 330, y + 28, 14, c.text, 820, display, 'right')
    }
    bubble(ctx, c, 'Message count is volume. Word count is commitment.', 520)
  },
  async (ctx, avatars) => {
    const c = palette('bubblegum')
    frame(ctx, c, 'MESSAGE SPLIT', '🍰')
    wrap(ctx, 'Who types more?', 22, 104, 300, 40, c.text)
    const cx = 180, cy = 255, r = 92
    ctx.beginPath(); ctx.arc((cx + 5) * S, (cy + 5) * S, r * S, 0, Math.PI * 2); ctx.fillStyle = c.text; ctx.fill()
    ctx.beginPath(); ctx.arc(cx * S, cy * S, r * S, 0, Math.PI * 2); ctx.fillStyle = c.surface; ctx.fill()
    ctx.beginPath(); ctx.moveTo(cx * S, cy * S); ctx.arc(cx * S, cy * S, r * S, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * .53); ctx.closePath(); ctx.fillStyle = c.accent2; ctx.fill()
    ctx.beginPath(); ctx.arc(cx * S, cy * S, r * S, 0, Math.PI * 2); ctx.lineWidth = 2 * S; ctx.strokeStyle = c.text; ctx.stroke()
    ctx.beginPath(); ctx.arc(cx * S, cy * S, 50 * S, 0, Math.PI * 2); ctx.fillStyle = c.surface; ctx.fill(); ctx.stroke()
    await avatarAt(ctx, await avatars('ada', c), c, cx - 34, cy - 34, 68)
    const rows: [string, string, string][] = [['ada', 'Ada', '53%'], ['david', 'David', '47%']]
    for (const [index, [id, name, share]] of rows.entries()) {
      const y = 378 + index * 58
      sticker(ctx, c, 22, y, 316, 46, 16, c.surface, 2)
      await avatarAt(ctx, await avatars(id, c), c, 32, y + 7, 32)
      text(ctx, name, 74, y + 29, 14, c.text, 850)
      text(ctx, share, 328, y + 32, 24, c.text, 820, display, 'right')
    }
    bubble(ctx, c, 'Every message counted. Both phones dey work.', 520)
  },
  async (ctx, avatars) => {
    const c = palette('midnight')
    frame(ctx, c, 'AFTER MIDNIGHT', '🌙')
    wrap(ctx, 'When others sleep, Tobi dey type.', 22, 104, 300, 34, c.text)
    sticker(ctx, c, 22, 186, 316, 178, 18, c.surface)
    for (let index = 0; index < 28; index++) {
      const x = 36 + (index % 7) * 42, y = 200 + Math.floor(index / 7) * 40
      roundRect(ctx, x, y, 34, 32, 8); ctx.fillStyle = index < 11 ? c.accent2 : `${c.text}18`; ctx.fill()
    }
    sticker(ctx, c, 22, 384, 316, 76, 18, c.surface)
    await avatarAt(ctx, await avatars('tobi', c), c, 34, 396, 52)
    text(ctx, 'Tobi', 98, 418, 15, c.text, 850)
    text(ctx, '38% came after midnight', 98, 438, 11, c.muted, 750)
    text(ctx, '944', 326, 438, 34, c.text, 820, display, 'right')
    bubble(ctx, c, '944 messages after midnight. The night shift dey open.', 508)
  },
  async (ctx, avatars) => {
    const c = palette('lagos')
    frame(ctx, c, 'AWARD TIME', '🏆')
    ctx.beginPath(); ctx.arc(186 * S, 172 * S, 70 * S, 0, Math.PI * 2); ctx.fillStyle = c.text; ctx.fill()
    ctx.beginPath(); ctx.arc(180 * S, 166 * S, 70 * S, 0, Math.PI * 2); ctx.fillStyle = c.accent; ctx.fill(); ctx.lineWidth = 2 * S; ctx.strokeStyle = c.text; ctx.stroke()
    await avatarAt(ctx, await avatars('amaka', c), c, 128, 114, 104)
    const end = wrap(ctx, 'Amaka dey wake this chat up.', 180, 290, 290, 32, c.text, 1.04, display, 760, 'center')
    sticker(ctx, c, 40, end + 24, 280, 82, 16, c.surface)
    text(ctx, 'fresh gists started', 180, end + 52, 12, c.text, 800, body, 'center')
    text(ctx, '312', 180, end + 92, 36, c.text, 820, display, 'center')
    bubble(ctx, c, 'Started fresh gist 312 times. The chat’s own alarm clock.', 508)
  },
  async (ctx, avatars) => {
    const c = palette('detty')
    frame(ctx, c, 'THE GROUP IN NUMBERS', '✨')
    wrap(ctx, 'You sent 14,203 messages. Una no dey tire!', 22, 104, 310, 31, c.text)
    text(ctx, '14,203', 22, 262, 74, c.accent2, 820, display)
    const stats: [string, string][] = [['7', 'PEOPLE'], ['91,840', 'WORDS'], ['858', 'MEDIA'], ['49.7', 'PER DAY']]
    stats.forEach(([value, label], index) => {
      const x = 22 + (index % 2) * 162, y = 290 + Math.floor(index / 2) * 92
      sticker(ctx, c, x, y, 152, 78, 16, index === 0 ? c.accent : c.surface)
      text(ctx, value, x + 14, y + 42, 28, c.text, 820, display)
      text(ctx, label, x + 14, y + 62, 10, c.muted, 850)
    })
    for (const [index, id] of ['zainab', 'amaka', 'tobi', 'femi', 'chioma'].entries()) await avatarAt(ctx, await avatars(id, c), c, 26 + index * 30, 488, 38)
    bubble(ctx, c, 'Every one of them counted. Proudly a group that talks.', 540)
  },
  async (ctx) => {
    const c = palette('mint')
    frame(ctx, c, 'TOP EMOJIS', '😍')
    wrap(ctx, 'Emojis you can’t do without.', 22, 104, 300, 36, c.text)
    const rows: [string, number][] = [['😂', 1874], ['❤️', 1221], ['🥹', 743], ['😭', 511], ['🙄', 288]]
    rows.forEach(([emoji, value], index) => {
      const y = 196 + index * 60
      sticker(ctx, c, 22, y, 316, 48, 16, index === 0 ? c.accent : c.surface, 2)
      text(ctx, emoji, 48, y + 34, 26, c.text, 400, 'sans-serif', 'center')
      roundRect(ctx, 80, y + 18, 180, 13, 7); ctx.fillStyle = c.surface; ctx.fill(); ctx.lineWidth = 2 * S; ctx.strokeStyle = c.text; ctx.stroke()
      roundRect(ctx, 80, y + 18, 180 * value / 1874, 13, 7); ctx.fillStyle = c.accent2; ctx.fill(); ctx.stroke()
      text(ctx, value.toLocaleString('en-GB'), 328, y + 31, 16, c.text, 820, display, 'right')
    })
    bubble(ctx, c, '😂 dey lead. Nobody is surprised.', 540)
  }
]

export const faceCount = faces.length

function backArt(ctx: CanvasRenderingContext2D) {
  ctx.save()
  roundRect(ctx, 0, 0, 360, 640, 26); ctx.clip()
  const base = ctx.createLinearGradient(0, 0, W, H)
  base.addColorStop(0, '#ff7a45'); base.addColorStop(1, '#f04a2a')
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H)
  // a lattice of tiny chat bubbles
  ctx.fillStyle = '#ffffff22'
  for (let y = 18; y < 640; y += 34) for (let x = (y / 34) % 2 ? 14 : 31; x < 360; x += 34) {
    roundRect(ctx, x, y, 16, 11, [6, 6, 6, 2]); ctx.fill()
  }
  roundRect(ctx, 14, 14, 332, 612, 18); ctx.lineWidth = 3 * S; ctx.strokeStyle = '#fff4e2'; ctx.stroke()
  roundRect(ctx, 22, 22, 316, 596, 13); ctx.lineWidth = 1.2 * S; ctx.strokeStyle = '#fff4e288'; ctx.stroke()
  // centre badge
  ctx.beginPath(); ctx.arc(186 * S, 298 * S, 76 * S, 0, Math.PI * 2); ctx.fillStyle = '#2a1611'; ctx.fill()
  ctx.beginPath(); ctx.arc(180 * S, 292 * S, 76 * S, 0, Math.PI * 2); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 3 * S; ctx.strokeStyle = '#2a1611'; ctx.stroke()
  roundRect(ctx, 138, 258, 84, 58, [26, 26, 26, 8]); ctx.fillStyle = '#2a1611'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(146 * S, 304 * S); ctx.lineTo(140 * S, 330 * S); ctx.lineTo(166 * S, 312 * S); ctx.fill()
  for (const x of [160, 180, 200]) { ctx.beginPath(); ctx.arc(x * S, 287 * S, 6 * S, 0, Math.PI * 2); ctx.fillStyle = '#ffd23f'; ctx.fill() }
  text(ctx, 'Chat', 180, 424, 44, '#fff8ec', 800, display, 'center')
  text(ctx, 'Wrapped', 180, 470, 44, '#fff8ec', 800, display, 'center')
  text(ctx, 'A KODEDLABS PRODUCTION', 180, 590, 9, '#fff4e2cc', 850, body, 'center')
  ctx.restore()
}

function texture(canvas: HTMLCanvasElement) {
  const result = new CanvasTexture(canvas)
  result.colorSpace = SRGBColorSpace
  result.anisotropy = 8
  return result
}

const blank = () => { const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; return canvas }

export function makeBackTexture() {
  const canvas = blank()
  backArt(canvas.getContext('2d')!)
  return texture(canvas)
}

/** Draws every face. Avatars are SVG rasterised into the canvas; if a browser refuses that, the faces are drawn without them. */
export async function makeFaceTextures(): Promise<Texture[]> {
  await Promise.all(['760 40px "Gluten Variable"', '800 20px "Nunito Variable"'].map((font) => document.fonts.load(font).catch(() => undefined)))
  const cache = new Map<string, HTMLImageElement | null>()
  const avatars = async (id: string, c: Palette) => {
    const key = `${id}${c.accent}`
    if (!cache.has(key)) cache.set(key, await avatarImage(id, c).catch(() => null))
    return cache.get(key)!
  }
  const draw = async (withAvatars: boolean) => Promise.all(faces.map(async (face) => {
    const canvas = blank()
    const ctx = canvas.getContext('2d')!
    await face(ctx, withAvatars ? avatars : async () => null)
    ctx.restore()
    ctx.getImageData(0, 0, 1, 1)
    return canvas
  }))
  const canvases = await draw(true).catch(() => draw(false))
  return canvases.map(texture)
}
