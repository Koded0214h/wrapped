import type { AnalysisResult } from './types'
import { idbDelete, idbGet, idbSet } from '../lib/idb'

const KEY = 'current'
const CACHE_VERSION = 4
type CachedAnalysis = { version: number; analysis: AnalysisResult }

export const saveAnalysis = (analysis: AnalysisResult) => idbSet('analysis', KEY, { version: CACHE_VERSION, analysis } satisfies CachedAnalysis)
export async function loadAnalysis() {
  const cached = await idbGet<CachedAnalysis | AnalysisResult>('analysis', KEY)
  if (cached && 'version' in cached && cached.version === CACHE_VERSION) return cached.analysis
  if (cached) await idbDelete('analysis', KEY)
  return undefined
}
export const clearAnalysis = () => idbDelete('analysis', KEY)
