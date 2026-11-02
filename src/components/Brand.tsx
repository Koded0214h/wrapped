import { MessageCircleHeart } from 'lucide-react'

export function Brand() {
  return <button className="brand" onClick={() => window.location.reload()} aria-label="Back to Chat Wrapped home">
    <span className="brand__mark"><MessageCircleHeart size={18} strokeWidth={2.6} /></span>
    <span>Chat Wrapped</span>
  </button>
}
