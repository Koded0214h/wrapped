import { loadSoundtrack } from './soundtrack'
import { RAIN_DROPS, rainDrop } from '../slides/motion'
import { filmFrames, type CardFilm } from './exportImage'
import { whenIdle } from './idle'

export const VIDEO_WIDTH = 720
export const VIDEO_HEIGHT = 1280
const FRAMES_PER_SECOND = 30
const SLIDE_SECONDS = 0.5
/** The moments of a card's opening animation that are captured; the video blends between them. */
export const MOMENTS = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2.2]
const FADE_SECONDS = 1.2
const SAMPLE_RATE = 48000
// Keeps a full video under WhatsApp's 16 MB media limit.
const VIDEO_BITRATE = 2_000_000
// Short enough to post as one status.
const LONGEST_SECONDS = 59

export const secondsPerCard = (cards: number) => Math.min(3, LONGEST_SECONDS / Math.max(1, cards))

// The MP4 writer is only downloaded by people who ask for a video.
const writer = () => import('mediabunny')

/** Only MP4 is offered, because WhatsApp and Instagram do not reliably take anything else. */
export async function canMakeVideo() {
  if (typeof VideoEncoder === 'undefined') return false
  try {
    const { canEncodeVideo } = await writer()
    return await canEncodeVideo('avc', { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, bitrate: VIDEO_BITRATE })
  } catch { return false }
}

/** The track, repeated to the length of the video and faded out at the end. */
async function soundFor(seconds: number) {
  const context = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE)
  const source = context.createBufferSource()
  source.buffer = await loadSoundtrack(context)
  source.loop = true
  const volume = context.createGain()
  volume.gain.setValueAtTime(1, Math.max(0, seconds - FADE_SECONDS))
  volume.gain.linearRampToValueAtTime(0, seconds)
  source.connect(volume).connect(context.destination)
  source.start()
  return context.startRendering()
}

export type VideoCard = { film: CardFilm; rain: string[] }
type Options = {
  /** Each card's opening animation, filmed at MOMENTS, in story order. */
  cards: VideoCard[]
  background: string
  withSound?: boolean
  signal?: AbortSignal
  onProgress?: (done: number) => void
  onSoundError?: (error: unknown) => void
  /** True while it is made in the background as the person browses: it hands the page back more often, so
   * swiping stays smooth. Asked on every frame, so a video someone starts waiting for speeds up. */
  quiet?: () => boolean
}

const stopIfCancelled = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError') }

/** Writes the cards as an MP4 carousel, frame by frame, as fast as the device can encode. */
export async function makeCarousel({ cards, background, withSound, signal, onProgress, onSoundError, quiet = () => false }: Options) {
  const { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeAudio } = await writer()
  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_WIDTH
  canvas.height = VIDEO_HEIGHT
  const paint = canvas.getContext('2d')!
  const each = secondsPerCard(cards.length)
  const total = each * cards.length
  const scale = VIDEO_WIDTH / 360
  // Only the card on screen and the one leaving are kept as pictures.
  const images = new Map<number, ImageBitmap[]>()
  const load = async (index: number) => {
    if (!images.has(index)) images.set(index, await filmFrames(cards[index].film, background, VIDEO_WIDTH, VIDEO_HEIGHT, () => quiet() ? whenIdle() : Promise.resolve()))
    for (const [kept, frames] of images) if (kept < index - 1) { frames.forEach((frame) => frame.close()); images.delete(kept) }
  }
  const forget = () => { for (const frames of images.values()) frames.forEach((frame) => frame.close()); images.clear() }

  // Blends the two captured moments either side of this time, so the motion runs smoothly.
  const cardAt = (index: number, time: number, alpha = 1) => {
    const shots = images.get(index)!
    let at = MOMENTS.findIndex((moment) => moment > time) - 1
    if (at < 0) at = time < 0 ? 0 : shots.length - 1
    const next = Math.min(shots.length - 1, at + 1)
    const blend = next === at ? 0 : Math.min(1, Math.max(0, (time - MOMENTS[at]) / (MOMENTS[next] - MOMENTS[at])))
    paint.globalAlpha = alpha
    paint.drawImage(shots[at], 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    if (blend > 0) { paint.globalAlpha = alpha * blend; paint.drawImage(shots[next], 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT) }
    paint.globalAlpha = 1
  }

  const rain = (emojis: string[], time: number) => {
    if (!emojis.length) return
    paint.textAlign = 'center'
    paint.textBaseline = 'middle'
    for (let drop = 0; drop < RAIN_DROPS; drop++) {
      const { left, rem, delay, duration, spin } = rainDrop(drop)
      const progress = (time - delay) / duration
      if (progress <= 0 || progress >= 1) continue
      paint.save()
      paint.globalAlpha = progress < 0.12 ? progress / 0.12 : progress > 0.8 ? (1 - progress) / 0.2 : 1
      paint.translate(left * VIDEO_WIDTH + 10 * scale, (-0.12 + progress ** 1.6 * 1.2) * VIDEO_HEIGHT)
      paint.rotate(spin * progress * Math.PI / 180)
      paint.font = `${rem * 16 * scale}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
      paint.fillText(emojis[drop % emojis.length], 0, 0)
      paint.restore()
    }
  }

  // Overshoots a little and settles, like the card swap in the app.
  const settle = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2
  const draw = (time: number) => {
    const index = Math.min(cards.length - 1, Math.floor(time / each))
    const into = time - index * each
    paint.fillStyle = background
    paint.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    const swap = index === 0 ? 1 : Math.min(1, into / SLIDE_SECONDS)
    if (swap < 1) {
      // The last card tips away to the left.
      paint.save()
      paint.translate(VIDEO_WIDTH / 2 - swap * VIDEO_WIDTH * 0.6, VIDEO_HEIGHT / 2)
      paint.rotate(-swap * 8 * Math.PI / 180)
      paint.scale(1 - swap * 0.12, 1 - swap * 0.12)
      paint.translate(-VIDEO_WIDTH / 2, -VIDEO_HEIGHT / 2)
      cardAt(index - 1, 9, 1 - swap)
      paint.restore()
    }
    const enter = settle(swap)
    paint.save()
    paint.translate(VIDEO_WIDTH / 2 + (1 - enter) * VIDEO_WIDTH * 0.45, VIDEO_HEIGHT / 2)
    paint.rotate((1 - enter) * 7 * Math.PI / 180)
    paint.scale(0.9 + 0.1 * enter, 0.9 + 0.1 * enter)
    paint.translate(-VIDEO_WIDTH / 2, -VIDEO_HEIGHT / 2)
    cardAt(index, into, Math.min(1, swap * 2.5))
    paint.restore()
    rain(cards[index].rain, into)
    // Progress bars across the top, as on a status.
    const gap = 4, width = (VIDEO_WIDTH - 40 - gap * (cards.length - 1)) / cards.length
    cards.forEach((_, i) => {
      const x = 20 + i * (width + gap)
      paint.fillStyle = 'rgba(32,20,17,.18)'
      paint.fillRect(x, 16, width, 6)
      paint.fillStyle = '#201411'
      paint.fillRect(x, 16, width * (i < index ? 1 : i === index ? Math.min(1, into / each) : 0), 6)
    })
  }

  // A track that will not load, or a browser without AAC, costs the sound and not the video.
  let sound: AudioBuffer | undefined
  if (withSound) {
    try {
      // Firefox, among others, cannot write AAC itself, so it gets an encoder to do it with.
      if (!(await canEncodeAudio('aac'))) (await import('@mediabunny/aac-encoder')).registerAacEncoder()
      if (!(await canEncodeAudio('aac'))) throw new Error('E-305: This browser cannot add sound to MP4.')
      sound = await soundFor(total)
    } catch (error) { onSoundError?.(error) }
  }

  const target = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target })
  const video = new CanvasSource(canvas, { codec: 'avc', bitrate: VIDEO_BITRATE })
  output.addVideoTrack(video, { frameRate: FRAMES_PER_SECOND })
  const audio = sound ? new AudioBufferSource({ codec: 'aac', bitrate: 128_000 }) : undefined
  if (audio) output.addAudioTrack(audio)

  try {
    await output.start()
    // Not awaited here: the writer holds audio back until the pictures catch up.
    const soundAdded = audio?.add(sound!)
    const count = Math.round(total * FRAMES_PER_SECOND)
    for (let frame = 0; frame < count; frame++) {
      stopIfCancelled(signal)
      const time = frame / FRAMES_PER_SECOND
      await load(Math.min(cards.length - 1, Math.floor(time / each)))
      draw(time)
      await video.add(time, 1 / FRAMES_PER_SECOND)
      const gentle = quiet()
      if (frame % (gentle ? 3 : FRAMES_PER_SECOND) === 0) {
        onProgress?.(frame / count)
        // Lets the progress text, the cancel button and, in the background, swiping respond.
        await new Promise((resolve) => setTimeout(resolve, gentle ? 4 : 0))
      }
    }
    video.close()
    await soundAdded
    audio?.close()
    await output.finalize()
  } catch (error) {
    await output.cancel().catch(() => {})
    throw error
  } finally { forget() }
  const file = new File([target.buffer!], 'chat-wrapped.mp4', { type: 'video/mp4' })
  return { file, silent: Boolean(withSound) && !sound }
}
