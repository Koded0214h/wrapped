import type { AnalysisResult } from './types'
import { idbDelete, idbGet, idbSet } from '../lib/idb'
import { withoutRawText } from './factPrivacy'

const KEY = 'current'
export const ANALYSIS_SCHEMA_VERSION = 13
const CACHE_VERSION = ANALYSIS_SCHEMA_VERSION
type CachedAnalysis = { version: number; analysis: AnalysisResult }

// The quoted laugh message is not written to disk. This tab-only copy lets it survive a
// reload or the redirect to the payment page, and goes away when the tab closes.
const QUOTE = 'chat-wrapped-quote'
function keepQuote(analysis?: AnalysisResult) {
  try {
    const quote = analysis?.facts.find((fact) => fact.id === 'laugh_moment')?.detail
    if (quote) sessionStorage.setItem(QUOTE, JSON.stringify({ quote, range: analysis!.range }))
    else sessionStorage.removeItem(QUOTE)
  } catch { /* storage unavailable */ }
}
function withQuote(analysis: AnalysisResult): AnalysisResult {
  try {
    const saved = JSON.parse(sessionStorage.getItem(QUOTE) ?? 'null') as { quote: string; range: AnalysisResult['range'] } | null
    if (!saved || saved.range.start !== analysis.range.start || saved.range.end !== analysis.range.end) return analysis
    return { ...analysis, facts: analysis.facts.map((fact) => fact.id === 'laugh_moment' ? { ...fact, detail: saved.quote } : fact) }
  } catch { return analysis }
}

export const saveAnalysis = (analysis: AnalysisResult) => {
  keepQuote(analysis)
  const { aiChunks: _aiChunks, ...cacheable } = analysis
  const safeAnalysis = { ...cacheable, facts: analysis.facts.map(withoutRawText) }
  return idbSet('analysis', KEY, { version: CACHE_VERSION, analysis: safeAnalysis } satisfies CachedAnalysis)
}
export async function loadAnalysis() {
  const cached = await idbGet<CachedAnalysis | AnalysisResult>('analysis', KEY)
  if (cached && 'version' in cached && cached.version === CACHE_VERSION) return withQuote(cached.analysis)
  if (cached) await idbDelete('analysis', KEY)
  return undefined
}
export const clearAnalysis = () => { keepQuote(); return idbDelete('analysis', KEY) }
