import { CanvasTexture, Color, SRGBColorSpace } from 'three'

/**
 * Painted faces for the two friends. The head is a smooth ellipsoid whose UVs run around it like a globe,
 * so the face is drawn on a 2:1 canvas centred on the point that faces forward (u = 0.25).
 * Drawing happens in head-space metres (y up) through a transform, so features land where the 3D head expects them.
 */
export type Expression = 'neutral' | 'blink' | 'talk' | 'laugh'
export type FaceStyle = { skin: string; lip: string; brow: string; radiusX: number; radiusY: number }

const W = 2048
const H = 1024

const shade = (hex: string, amount: number) => `#${new Color(hex).multiplyScalar(amount).getHexString()}`
const alpha = (hex: string, value: number) => { const c = new Color(hex); return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${value})` }

type Ctx = CanvasRenderingContext2D
type Point = [number, number]

function soft(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.save()
  ctx.translate(x, y); ctx.scale(rx, ry)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  gradient.addColorStop(0, color); gradient.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'))
  ctx.fillStyle = gradient
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/** Almond eye outline points for one side: inner corner, outer corner and curve controls. */
function eyeShape(side: number, cx: number, cy: number) {
  const w = 0.092, h = 0.029
  const inner: Point = [cx - side * w * 0.5, cy - 0.002]
  const outer: Point = [cx + side * w * 0.5, cy + 0.005]
  return {
    inner, outer, w, h,
    upper: [[cx - side * w * 0.22, cy + h * 1.55], [cx + side * w * 0.26, cy + h * 1.6]] as Point[],
    lower: [[cx + side * w * 0.2, cy - h * 1.05], [cx - side * w * 0.24, cy - h * 0.9]] as Point[]
  }
}

function openEye(ctx: Ctx, side: number, style: FaceStyle, lookX: number) {
  const cx = side * 0.084, cy = 0.022
  const e = eyeShape(side, cx, cy)
  const dark = shade(style.skin, 0.62)
  // a soft socket shadow and the crease above the lid
  soft(ctx, cx, cy + 0.006, 0.07, 0.045, alpha(dark, 0.35))
  ctx.strokeStyle = alpha(shade(style.skin, 0.5), 0.55); ctx.lineWidth = 0.0024
  ctx.beginPath(); ctx.moveTo(e.inner[0] + side * 0.008, e.inner[1] + 0.02); ctx.bezierCurveTo(cx - side * 0.02, cy + 0.052, cx + side * 0.024, cy + 0.054, e.outer[0] - side * 0.004, e.outer[1] + 0.02); ctx.stroke()
  // white of the eye
  const path = new Path2D()
  path.moveTo(...e.inner); path.bezierCurveTo(...e.upper[0], ...e.upper[1], ...e.outer); path.bezierCurveTo(...e.lower[0], ...e.lower[1], ...e.inner); path.closePath()
  const white = ctx.createLinearGradient(0, cy + 0.035, 0, cy - 0.02)
  white.addColorStop(0, '#cbb8a8'); white.addColorStop(0.35, '#f6eee4'); white.addColorStop(1, '#efe4d8')
  ctx.fillStyle = white; ctx.fill(path)
  // iris, pupil and catchlights, kept inside the eye
  ctx.save(); ctx.clip(path)
  // A large iris tucked under the upper lid reads as relaxed rather than startled.
  const ix = cx + lookX * 0.01, iy = cy + 0.009
  const iris = ctx.createRadialGradient(ix, iy, 0, ix, iy, 0.026)
  iris.addColorStop(0, '#0d0605'); iris.addColorStop(0.34, '#120806'); iris.addColorStop(0.42, '#6e4220'); iris.addColorStop(0.78, '#3b2010'); iris.addColorStop(1, '#120805')
  ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(ix, iy, 0.026, 0, Math.PI * 2); ctx.fill()
  const lidShadow = ctx.createLinearGradient(0, cy + 0.04, 0, cy + 0.01)
  lidShadow.addColorStop(0, 'rgba(0,0,0,.55)'); lidShadow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lidShadow; ctx.fillRect(cx - 0.06, cy + 0.01, 0.12, 0.04)
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ix + 0.009, iy + 0.004, 0.0062, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(ix - 0.008, iy - 0.011, 0.0028, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // upper lid line with a lifted outer flick, lashes, and a fine lower lash line
  ctx.strokeStyle = '#120a07'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.lineWidth = 0.0048
  ctx.beginPath(); ctx.moveTo(...e.inner); ctx.bezierCurveTo(...e.upper[0], ...e.upper[1], ...e.outer); ctx.lineTo(e.outer[0] + side * 0.012, e.outer[1] + 0.009); ctx.stroke()
  ctx.lineWidth = 0.0022
  for (let i = 0; i < 6; i++) {
    const t = 0.45 + i * 0.1
    const x = cx + side * (t - 0.5) * e.w, y = cy + e.h * 1.15 * Math.sin(Math.PI * t) + 0.004
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 0.006 * (0.5 + t), y + 0.008); ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(30, 16, 10, .55)'; ctx.lineWidth = 0.0016
  ctx.beginPath(); ctx.moveTo(cx - side * 0.012, cy - e.h * 0.95); ctx.bezierCurveTo(cx + side * 0.02, cy - e.h * 1.0, cx + side * 0.04, cy - e.h * 0.4, ...e.outer); ctx.stroke()
}

function closedEye(ctx: Ctx, side: number, style: FaceStyle, happy: boolean) {
  const cx = side * 0.084, cy = 0.022
  const dark = shade(style.skin, 0.62)
  soft(ctx, cx, cy + 0.004, 0.068, 0.04, alpha(dark, happy ? 0.25 : 0.32))
  ctx.strokeStyle = '#120a07'; ctx.lineCap = 'round'; ctx.lineWidth = happy ? 0.012 : 0.0058
  ctx.beginPath()
  if (happy) {
    // laughing: a lifted crescent, pushed up by the cheeks
    ctx.moveTo(cx - side * 0.044, cy - 0.002); ctx.bezierCurveTo(cx - side * 0.02, cy + 0.03, cx + side * 0.024, cy + 0.03, cx + side * 0.046, cy + 0.0)
  } else {
    ctx.moveTo(cx - side * 0.044, cy + 0.002); ctx.bezierCurveTo(cx - side * 0.018, cy - 0.012, cx + side * 0.022, cy - 0.012, cx + side * 0.046, cy + 0.004)
  }
  ctx.stroke()
  if (happy) {
    // a light line under the crescent so it reads on deep skin
    ctx.save(); ctx.strokeStyle = 'rgba(255, 225, 205, .22)'; ctx.lineWidth = 0.004; ctx.translate(0, -0.006); ctx.stroke(); ctx.restore()
  }
  ctx.lineWidth = 0.0022
  for (let i = 0; i < 4; i++) {
    const t = 0.55 + i * 0.13
    const x = cx + side * (t - 0.5) * 0.09
    const y = happy ? cy + 0.024 * Math.sin(Math.PI * t) - 0.001 : cy - 0.009 * Math.sin(Math.PI * t)
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 0.005, y + (happy ? 0.007 : -0.008)); ctx.stroke()
  }
  if (happy) {
    ctx.strokeStyle = alpha(shade(style.skin, 0.55), 0.6); ctx.lineWidth = 0.0024
    ctx.beginPath(); ctx.moveTo(cx - side * 0.03, cy - 0.016); ctx.quadraticCurveTo(cx, cy - 0.026, cx + side * 0.032, cy - 0.014); ctx.stroke()
  }
}

function brow(ctx: Ctx, side: number, style: FaceStyle, lift: number) {
  const y = 0.084 + lift
  ctx.fillStyle = style.brow
  ctx.beginPath()
  ctx.moveTo(side * 0.036, y - 0.004)
  ctx.bezierCurveTo(side * 0.06, y + 0.012, side * 0.1, y + 0.02, side * 0.138, y + 0.0)
  ctx.bezierCurveTo(side * 0.11, y + 0.008, side * 0.07, y + 0.002, side * 0.038, y - 0.012)
  ctx.closePath(); ctx.fill()
  // a few hair strokes so the brow is not a flat shape
  ctx.strokeStyle = alpha(style.brow, 0.7); ctx.lineWidth = 0.0012
  for (let i = 0; i < 9; i++) { const x = side * (0.042 + i * 0.01); ctx.beginPath(); ctx.moveTo(x, y - 0.006 + i * 0.0009); ctx.lineTo(x + side * 0.008, y + 0.006 + i * 0.0005); ctx.stroke() }
}

function nose(ctx: Ctx, style: FaceStyle) {
  const dark = shade(style.skin, 0.55)
  soft(ctx, 0, -0.07, 0.04, 0.018, alpha(dark, 0.45))
  soft(ctx, 0, 0.0, 0.012, 0.05, 'rgba(255, 236, 220, .08)')
  soft(ctx, 0.002, -0.055, 0.014, 0.01, 'rgba(255, 236, 220, .18)')
  ctx.fillStyle = alpha(shade(style.skin, 0.32), 0.9)
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * 0.016, -0.072, 0.0085, 0.0045, side * -0.35, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = alpha(dark, 0.75); ctx.lineWidth = 0.0024; ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 0.022, -0.05); ctx.bezierCurveTo(side * 0.038, -0.056, side * 0.04, -0.072, side * 0.026, -0.078); ctx.stroke()
  }
}

function cheeks(ctx: Ctx, laugh: boolean) {
  for (const side of [-1, 1]) soft(ctx, side * 0.122, laugh ? -0.045 : -0.058, 0.05, 0.034, `rgba(255, 120, 105, ${laugh ? 0.26 : 0.15})`)
}

function closedMouth(ctx: Ctx, style: FaceStyle) {
  const lipDark = shade(style.lip, 0.72)
  const corners: Point = [0.043, -0.121]
  const upper = new Path2D()
  upper.moveTo(-corners[0], corners[1])
  upper.bezierCurveTo(-0.03, -0.112, -0.018, -0.104, -0.008, -0.106)
  upper.quadraticCurveTo(0, -0.11, 0.008, -0.106)
  upper.bezierCurveTo(0.018, -0.104, 0.03, -0.112, corners[0], corners[1])
  upper.bezierCurveTo(0.02, -0.126, -0.02, -0.126, -corners[0], corners[1])
  const top = ctx.createLinearGradient(0, -0.104, 0, -0.126)
  top.addColorStop(0, lipDark); top.addColorStop(1, style.lip)
  ctx.fillStyle = top; ctx.fill(upper)
  const lower = new Path2D()
  lower.moveTo(-corners[0], corners[1])
  lower.bezierCurveTo(-0.02, -0.126, 0.02, -0.126, corners[0], corners[1])
  lower.bezierCurveTo(0.03, -0.148, -0.03, -0.148, -corners[0], corners[1])
  const bottom = ctx.createLinearGradient(0, -0.124, 0, -0.15)
  bottom.addColorStop(0, shade(style.lip, 1.12)); bottom.addColorStop(1, lipDark)
  ctx.fillStyle = bottom; ctx.fill(lower)
  soft(ctx, 0.006, -0.134, 0.014, 0.004, 'rgba(255, 255, 255, .38)')
  ctx.strokeStyle = shade(style.lip, 0.45); ctx.lineWidth = 0.0022; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-corners[0], corners[1]); ctx.bezierCurveTo(-0.02, -0.127, 0.02, -0.127, corners[0], corners[1]); ctx.stroke()
  // the corners turn up slightly
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * corners[0], corners[1]); ctx.lineTo(side * (corners[0] + 0.005), corners[1] + 0.004); ctx.stroke() }
}

function openMouth(ctx: Ctx, style: FaceStyle, width: number, depth: number) {
  const lipDark = shade(style.lip, 0.72)
  const top = -0.114
  const opening = new Path2D()
  opening.moveTo(-width, top + 0.004)
  opening.bezierCurveTo(-width * 0.5, top - 0.004, width * 0.5, top - 0.004, width, top + 0.004)
  opening.bezierCurveTo(width * 0.8, top - depth * 1.25, -width * 0.8, top - depth * 1.25, -width, top + 0.004)
  ctx.fillStyle = '#3a0e12'; ctx.fill(opening)
  ctx.save(); ctx.clip(opening)
  // upper teeth with faint gaps
  ctx.fillStyle = '#fbf6ee'
  ctx.beginPath(); ctx.moveTo(-width, top + 0.01); ctx.lineTo(width, top + 0.01); ctx.lineTo(width, top - depth * 0.32); ctx.bezierCurveTo(width * 0.4, top - depth * 0.42, -width * 0.4, top - depth * 0.42, -width, top - depth * 0.32); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(160, 130, 120, .35)'; ctx.lineWidth = 0.0012
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * width * 0.24, top + 0.01); ctx.lineTo(i * width * 0.24, top - depth * 0.36); ctx.stroke() }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-width, top - depth * 0.42, width * 2, 0.004)
  // tongue
  ctx.fillStyle = '#c6505b'
  ctx.beginPath(); ctx.ellipse(0, top - depth * 1.05, width * 0.55, depth * 0.38, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // lips framing the smile
  ctx.strokeStyle = lipDark; ctx.lineCap = 'round'; ctx.lineWidth = 0.008
  ctx.beginPath(); ctx.moveTo(-width, top + 0.004); ctx.bezierCurveTo(-width * 0.5, top - 0.004, width * 0.5, top - 0.004, width, top + 0.004); ctx.stroke()
  ctx.strokeStyle = style.lip; ctx.lineWidth = 0.011
  ctx.beginPath(); ctx.moveTo(-width * 0.92, top - 0.002); ctx.bezierCurveTo(-width * 0.8, top - depth * 1.32, width * 0.8, top - depth * 1.32, width * 0.92, top - 0.002); ctx.stroke()
  soft(ctx, 0.006, top - depth * 1.2, width * 0.3, 0.004, 'rgba(255, 255, 255, .3)')
  // smile lines from the nose to the lifted corners
  ctx.strokeStyle = alpha(shade(style.skin, 0.5), 0.45); ctx.lineWidth = 0.0026
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 0.045, -0.07); ctx.quadraticCurveTo(side * (width + 0.02), -0.095, side * (width + 0.006), top + 0.002); ctx.stroke() }
}

export function paintFace(style: FaceStyle, expression: Expression, lookX = 0) {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = style.skin; ctx.fillRect(0, 0, W, H)
  // head-space metres, y up, centred on the forward-facing point
  ctx.setTransform((W / (Math.PI * 2)) / style.radiusX, 0, 0, -(H / Math.PI) / style.radiusY, W * 0.25, H * 0.5)
  const laugh = expression === 'laugh'
  // Stylised proportions: every feature a quarter larger than life, scaled about the middle of the face.
  ctx.translate(0, -0.02); ctx.scale(1.25, 1.25); ctx.translate(0, 0.02)
  cheeks(ctx, laugh)
  for (const side of [-1, 1]) {
    brow(ctx, side, style, laugh ? 0.008 : expression === 'talk' ? 0.004 : 0)
    if (expression === 'neutral' || expression === 'talk') openEye(ctx, side, style, lookX)
    else closedEye(ctx, side, style, laugh)
  }
  nose(ctx, style)
  if (laugh) openMouth(ctx, style, 0.068, 0.07)
  else if (expression === 'talk') openMouth(ctx, style, 0.044, 0.03)
  else { ctx.save(); ctx.translate(0, -0.125); ctx.scale(1.18, 1.25); ctx.translate(0, 0.125); closedMouth(ctx, style); ctx.restore() }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/**
 * Hair painted onto a cap that fits the head: a soft hairline on the forehead that drops to the ears and nape,
 * strands combed back toward the crown, and fine baby hairs along the edge. Transparent below the hairline.
 */
export function paintHairCap(color: string, highlight: string) {
  const width = 1024, height = 512
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')!
  const toX = (lon: number) => ((0.25 + lon / (Math.PI * 2)) % 1 + 1) % 1 * width
  const toY = (lat: number) => (0.5 - lat / Math.PI) * height
  const hairline = (lon: number) => 0.5 - 0.56 * (1 - Math.cos(lon)) * 0.5 - 0.08 * Math.sin(lon * 2) ** 2
  // the hair itself, column by column
  for (let px = 0; px < width; px++) {
    const lon = (px / width - 0.25) * Math.PI * 2
    const top = toY(Math.PI / 2), edge = toY(hairline(lon))
    ctx.fillStyle = color
    ctx.fillRect(px, top, 1, edge - top)
  }
  // combed strands running back to the crown
  ctx.lineCap = 'round'
  for (let i = 0; i < 520; i++) {
    const lon = (i / 520) * Math.PI * 2 - Math.PI
    const start = hairline(lon)
    ctx.strokeStyle = i % 3 ? `${highlight}55` : `${highlight}99`
    ctx.lineWidth = 1 + (i % 4 === 0 ? 1 : 0)
    ctx.beginPath()
    ctx.moveTo(toX(lon), toY(start) - 1)
    ctx.quadraticCurveTo(toX(lon * 0.9), toY((start + Math.PI / 2) / 2), toX(lon * 0.75), toY(Math.PI / 2 - 0.05))
    ctx.stroke()
  }
  // baby hairs: little swirls along the front hairline
  ctx.strokeStyle = color; ctx.lineWidth = 1.4
  for (let i = 0; i < 40; i++) {
    const lon = (i / 39 - 0.5) * 2.2
    const x = toX(lon), y = toY(hairline(lon))
    ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.bezierCurveTo(x + 3, y + 4, x - 4, y + 7, x - 1, y + 9); ctx.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
