import { useApp } from '../store/useApp'
import { MessageCircleHeart } from 'lucide-react'

export function Brand() {
  const setStep = useApp((s) => s.setStep)
  return <button className="brand" onClick={() => setStep('landing')} aria-label="Back to Chat Wrapped home">
    <span className="brand__mark"><MessageCircleHeart size={18} strokeWidth={2.6} /></span>
    <span>Chat Wrapped</span>
  </button>
}
