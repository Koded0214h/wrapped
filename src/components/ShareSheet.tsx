import { useEffect, useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'

export type Shareable = { file: File; caption: string; silent?: boolean }

type Platform = { id: string; name: string; takesCaption: boolean; takesPaste: boolean; web: (caption: string) => string }

// A website cannot post a file into another app by itself. A phone's share menu hands over the file
// and the text together. On a computer the picture is copied, to be pasted in beside the text; where
// pasting is not possible (video, Instagram) the file is saved to be attached.
const platforms: Platform[] = [
  { id: 'whatsapp', name: 'WhatsApp', takesCaption: true, takesPaste: true, web: (caption) => `https://wa.me/?text=${encodeURIComponent(caption)}` },
  { id: 'instagram', name: 'Instagram', takesCaption: false, takesPaste: false, web: () => 'https://www.instagram.com/' },
  { id: 'facebook', name: 'Facebook', takesCaption: false, takesPaste: true, web: () => 'https://www.facebook.com/' },
  { id: 'x', name: 'X (Twitter)', takesCaption: true, takesPaste: true, web: (caption) => `https://x.com/intent/post?text=${encodeURIComponent(caption)}` }
]

const hasShareMenu = (file: File) => Boolean(navigator.canShare?.({ files: [file] }))
// Computers can have a share menu too, but it rarely lists these apps.
const usesShareMenu = (file: File) => window.matchMedia('(pointer: coarse)').matches && hasShareMenu(file)
const pasteKeys = () => /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘V' : 'Ctrl+V'
const copyPicture = async (file: File) => {
  try { await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]); return true }
  catch { return false }
}

export function ShareSheet({ file, caption: suggested, silent, onShared, onClose }: Shareable & { onShared: (target: string) => void; onClose: () => void }) {
  // Made and released in the same effect, so React's double mount in development gets a fresh one.
  const [url, setUrl] = useState('')
  const preview = useRef<HTMLVideoElement>(null)
  const [heldSilent, setHeldSilent] = useState(false)
  const [caption, setCaption] = useState(suggested)
  const [note, setNote] = useState('')
  // What to do after a computer share: where to go, and whether the caption still needs copying.
  const [next, setNext] = useState<{ platform: Platform; captionToCopy: boolean } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  const video = file.type.startsWith('video/')
  // Play with sound. Browsers often refuse that without a fresh tap, so then say how to turn it on.
  useEffect(() => {
    const player = preview.current
    if (!url || !player) return
    player.play().catch(() => {
      player.muted = true
      setHeldSilent(true)
      void player.play().catch(() => {})
    })
  }, [url])
  const thing = video ? 'video' : 'photo'
  const phone = usesShareMenu(file)
  const save = () => { const link = document.createElement('a'); link.download = file.name; link.href = url; link.click() }
  // Several apps drop the text that comes with a file, so it is always on the clipboard as well.
  const copyCaption = () => navigator.clipboard?.writeText(caption).then(() => true, () => false) ?? Promise.resolve(false)

  const throughShareMenu = async (target: string, where: string) => {
    const copied = copyCaption()
    try {
      // Called without waiting for the clipboard: the share menu only opens straight from a tap.
      await navigator.share({ files: [file], text: caption })
      onShared(target)
      setNote((await copied) ? `If the caption is missing ${where}, paste it. It is copied.` : '')
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(`Sharing did not work here. Save the ${thing}, then post it from your gallery.`)
    }
  }
  const send = async (platform: Platform) => {
    setError(''); setNext(null)
    if (phone) return throughShareMenu(`${platform.id}-menu`, `in ${platform.name}`)
    const pasted = !video && platform.takesPaste && await copyPicture(file)
    // The clipboard holds one thing. When it holds the picture, a caption the app will not
    // pre-fill is copied by its own button afterwards.
    let captionCopied = false
    if (!pasted) { save(); if (!platform.takesCaption) captionCopied = await copyCaption() }
    window.open(platform.web(caption), '_blank', 'noopener,noreferrer')
    onShared(`${platform.id}-web`)
    const attach = pasted ? `Your card is copied. Press ${pasteKeys()} in ${platform.name} to add the picture.` : `The ${thing} is in your downloads. Attach it in ${platform.name}.`
    setNote(captionCopied ? `${attach} Your caption is copied, so paste it in.` : attach)
    setNext({ platform, captionToCopy: pasted && !platform.takesCaption })
  }

  return <Modal title={`Share your ${thing}`} onClose={onClose}>
    {video ? <video ref={preview} className="share-preview" src={url || undefined} controls playsInline loop onVolumeChange={(event) => { if (!event.currentTarget.muted) setHeldSilent(false) }} /> : url && <img className="share-preview" src={url} alt="The card you are about to share" />}
    {heldSilent && !silent && <p className="share-sheet__note">Tap the speaker on the video to hear it.</p>}
    <label className="share-caption">Caption<textarea rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
    <p className="share-sheet__note">{phone ? `Tap an app below, then choose it in your phone’s share menu. The ${thing} and caption go together.` : video ? 'Tap an app. The video is saved and the app opens, ready for you to attach it.' : 'Tap an app. Your card is copied (Instagram gets a download) and the app opens.'}</p>
    <div className="share-targets">{platforms.map((platform) => <Button key={platform.id} variant="secondary" onClick={() => void send(platform)} disabled={!url}><Share2 /> {platform.name}</Button>)}</div>
    {note && <p className="share-sheet__note share-sheet__next" role="status">{note}</p>}
    {next && <p className="share-sheet__links"><a href={next.platform.web(caption)} target="_blank" rel="noreferrer">Open {next.platform.name}</a>{next.captionToCopy && <button onClick={() => void copyCaption().then((copied) => setNote(copied ? 'Caption copied. Paste it in too.' : 'Select the caption above and copy it.'))}>Copy caption</button>}</p>}
    {!phone && hasShareMenu(file) && <Button wide variant="quiet" onClick={() => void throughShareMenu('more-menu', 'there')}><Share2 /> More apps</Button>}
    <Button wide variant="quiet" onClick={() => { save(); void copyCaption(); onShared(`${thing}-download`) }} disabled={!url}><Download /> Save {thing}</Button>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="share-sheet__note">This may show your friends’ names. Hide names before posting?</p>
    {silent && <p className="share-sheet__note">This video has no sound, because it could not be added on this device.</p>}
  </Modal>
}
