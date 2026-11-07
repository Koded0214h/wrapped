import type { AnalysisResult } from './types'
import { idbDelete, idbGet, idbSet } from '../lib/idb'

const KEY = 'current'
export const ANALYSIS_SCHEMA_VERSION = 12
const CACHE_VERSION = ANALYSIS_SCHEMA_VERSION
type CachedAnalysis = { version: number; analysis: AnalysisResult }

export const saveAnalysis = (analysis: AnalysisResult) => {
  const { aiChunks: _aiChunks, ...cacheable } = analysis
  const safeAnalysis = { ...cacheable, facts: analysis.facts.map((fact) => { const { sourceExcerpt: _sourceExcerpt, ...safeFact } = fact; return safeFact }) }
  return idbSet('analysis', KEY, { version: CACHE_VERSION, analysis: safeAnalysis } satisfies CachedAnalysis)
}
export async function loadAnalysis() {
  const cached = await idbGet<CachedAnalysis | AnalysisResult>('analysis', KEY)
  if (cached && 'version' in cached && cached.version === CACHE_VERSION) return cached.analysis
  if (cached) await idbDelete('analysis', KEY)
  return undefined
}
export const clearAnalysis = () => idbDelete('analysis', KEY)
