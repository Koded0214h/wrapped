import { loadSoundtrack } from './soundtrack'

export const VIDEO_WIDTH = 720
export const VIDEO_HEIGHT = 1280
const FRAMES_PER_SECOND = 30
const SLIDE_SECONDS = 0.35
const FADE_SECONDS = 1.2
const SAMPLE_RATE = 48000
const VIDEO_BITRATE = 4_000_000
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

async function picture(url: string) {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

type Options = {
  /** One still image per card, as a data URL, in story order. */
  frames: string[]
  withSound?: boolean
  signal?: AbortSignal
  onProgress?: (done: number) => void
  onSoundError?: (error: unknown) => void
}

const stopIfCancelled = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError') }

/** Writes the cards as an MP4 carousel, frame by frame, as fast as the device can encode. */
export async function makeCarousel({ frames, withSound, signal, onProgress, onSoundError }: Options) {
  const { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeAudio } = await writer()
  const images = await Promise.all(frames.map(picture))
  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_WIDTH
  canvas.height = VIDEO_HEIGHT
  const paint = canvas.getContext('2d')!
  const each = secondsPerCard(images.length)
  const total = each * images.length

  const draw = (time: number) => {
    const index = Math.min(images.length - 1, Math.floor(time / each))
    const into = time - index * each
    const slide = index === 0 ? 1 : Math.min(1, into / SLIDE_SECONDS)
    const offset = Math.round((1 - slide) ** 3 * VIDEO_WIDTH)
    if (offset > 0) paint.drawImage(images[index - 1], offset - VIDEO_WIDTH, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    paint.drawImage(images[index], offset, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    // Progress bars across the top, as on a status.
    const gap = 4, width = (VIDEO_WIDTH - 40 - gap * (images.length - 1)) / images.length
    images.forEach((_, i) => {
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
      draw(time)
      await video.add(time, 1 / FRAMES_PER_SECOND)
      if (frame % FRAMES_PER_SECOND === 0) {
        onProgress?.(frame / count)
        // Lets the progress text and the cancel button respond.
        await new Promise((resolve) => setTimeout(resolve))
      }
    }
    video.close()
    await soundAdded
    audio?.close()
    await output.finalize()
  } catch (error) {
    await output.cancel().catch(() => {})
    throw error
  }
  const file = new File([target.buffer!], 'chat-wrapped.mp4', { type: 'video/mp4' })
  return { file, silent: Boolean(withSound) && !sound }
}
