import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnalysisResult, ChatType } from '../analysis/types'
import type { ThemeId } from '../themes/themes'
import type { FontId } from '../themes/fonts'
import { saveAnalysis } from '../analysis/analysisCache'

export type Step = 'landing' | 'choose' | 'guide' | 'upload' | 'ai-consent' | 'processing' | 'story'
export type Purchase = 'core' | 'everything' | 'theme' | 'font' | 'savage' | 'watermark' | 'awards'

type AppState = {
  step: Step
  chatType: ChatType
  analysis: AnalysisResult | null
  unlocked: boolean
  owned: Purchase[]
  theme: ThemeId
  font: FontId
  savage: boolean
  hideNames: boolean
  autoAdvance: boolean
  setStep: (step: Step) => void
  setChatType: (type: ChatType) => void
  setAnalysis: (data: AnalysisResult) => void
  unlock: (purchase: Purchase) => void
  setTheme: (theme: ThemeId) => void
  setFont: (font: FontId) => void
  setSavage: (value: boolean) => void
  setHideNames: (value: boolean) => void
  setAutoAdvance: (value: boolean) => void
  reset: () => void
}

export const useApp = create<AppState>()(persist((set) => ({
  step: 'landing',
  chatType: 'group',
  analysis: null,
  unlocked: false,
  owned: [],
  theme: 'sunset',
  font: 'bricolage',
  savage: false,
  hideNames: false,
  autoAdvance: false,
  setStep: (step) => set({ step }),
  setChatType: (chatType) => set({ chatType }),
  setAnalysis: (analysis) => { set({ analysis }); void saveAnalysis(analysis) },
  unlock: (purchase) => set((state) => purchase === 'core'
    ? { unlocked: true, owned: [...new Set([...state.owned, purchase])] }
    : purchase === 'everything'
      ? { unlocked: true, owned: ['core', 'everything', 'theme', 'font', 'savage', 'watermark', 'awards'] }
      : { owned: [...new Set([...state.owned, purchase])] }),
  setTheme: (theme) => set({ theme }),
  setFont: (font) => set({ font }),
  setSavage: (savage) => set({ savage }),
  setHideNames: (hideNames) => set({ hideNames }),
  setAutoAdvance: (autoAdvance) => set({ autoAdvance }),
  reset: () => set({ step: 'landing', analysis: null, unlocked: false, owned: [], theme: 'sunset', font: 'bricolage', savage: false, hideNames: false })
}), { name: 'chat-wrapped-v0', partialize: ({ step, chatType, unlocked, owned, theme, font, savage, hideNames }) => ({ step, chatType, unlocked, owned, theme, font, savage, hideNames }) }))
