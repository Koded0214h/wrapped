import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnalysisResult, ChatType } from '../analysis/types'
import type { ThemeId } from '../themes/themes'
import type { FontId } from '../themes/fonts'
import { saveAnalysis } from '../analysis/analysisCache'
import { appConfig } from '../config/appConfig'

export type Step = 'landing' | 'choose' | 'guide' | 'upload' | 'ai-consent' | 'processing' | 'story'
export type Purchase = 'everything' | 'theme' | 'font' | 'savage' | 'watermark' | 'awards'

type AppState = {
  step: Step
  chatType: ChatType
  analysis: AnalysisResult | null
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

const everything: Purchase[] = ['everything', 'theme', 'font', 'savage', 'watermark', 'awards']

// Free launch opens every style; shared cards still carry the site link.
export const ownsPurchase = (owned: Purchase[], item: Purchase) => appConfig.freeAccess ? item !== 'watermark' : owned.includes(item) || owned.includes('everything')

export const useApp = create<AppState>()(persist((set) => ({
  step: 'landing',
  chatType: 'group',
  analysis: null,
  owned: [],
  theme: 'sunset',
  font: 'gluten',
  savage: false,
  hideNames: false,
  autoAdvance: false,
  setStep: (step) => set({ step }),
  setChatType: (chatType) => set({ chatType }),
  setAnalysis: (analysis) => { set({ analysis }); void saveAnalysis(analysis) },
  unlock: (purchase) => set((state) => ({ owned: [...new Set([...state.owned, ...(purchase === 'everything' ? everything : [purchase])])] })),
  setTheme: (theme) => set({ theme }),
  setFont: (font) => set({ font }),
  setSavage: (savage) => set({ savage }),
  setHideNames: (hideNames) => set({ hideNames }),
  setAutoAdvance: (autoAdvance) => set({ autoAdvance }),
  reset: () => set({ step: 'landing', analysis: null, owned: [], theme: 'sunset', font: 'gluten', savage: false, hideNames: false })
}), { name: 'chat-wrapped-v0', version: 1,
  // Version 1 made Gluten the free display face; Bricolage, the old default, became an extra.
  migrate: (saved, version) => { const state = saved as { font?: FontId }; if (version < 1 && state.font === 'bricolage') state.font = 'gluten'; return state as never },
  partialize: ({ step, chatType, owned, theme, font, savage, hideNames }) => ({
  // The chosen file lives only in memory, so a reload mid-upload must restart at the picker.
  step: step === 'processing' || step === 'ai-consent' ? 'upload' as const : step, chatType, owned, theme, font, savage, hideNames }) }))
