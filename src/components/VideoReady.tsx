import { useEffect, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'

// Sharing needs its own tap: making the video takes far longer than a browser keeps the first one.
export function VideoReady({ file, silent, shareText, onShared, onClose }: { file: File; silent: boolean; shareText: string; onShared: (target: string) => void; onClose: () => void }) {
  // Made and released in the same effect, so React's double mount in development gets a fresh one.
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  const canShare = Boolean(navigator.canShare?.({ files: [file] }))
  const save = () => { const link = document.createElement('a'); link.download = file.name; link.href = url; link.click(); onShared('video-download') }
  const share = async () => {
    setError('')
    try { await navigator.share({ files: [file], text: shareText }); onShared('video-native') }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError('Sharing did not work here. Save the video, then post it from your gallery.') }
  }
  return <Modal title="Your video is ready" onClose={onClose}>
    <video className="video-ready" src={url || undefined} controls playsInline autoPlay muted loop />
    <div className="video-ready__actions">
      {canShare && <Button wide onClick={share}><Share2 /> Share video</Button>}
      <Button wide variant={canShare ? 'secondary' : 'primary'} onClick={save}><Download /> Save video</Button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {silent && <p className="video-ready__note">This video has no sound, because it could not be added on this device.</p>}
  </Modal>
}
