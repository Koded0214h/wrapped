import type { AggregateChat } from './types'
import type { AnalysisProgress } from './getAnalysis'

export type ParserDiagnostics = { format: 'android' | 'ios' | 'unknown'; clock: '12h' | '24h'; dateOrder: string; unknownPct: number; capped: boolean; mediaPct?: number; languageHint?: string }

export function parseExport(file: File, options: { includeAiChunks?: boolean; signal?: AbortSignal; onProgress?: (progress: AnalysisProgress) => void; onDiagnostics?: (diagnostics: ParserDiagnostics) => void } = {}) {
  return new Promise<AggregateChat>((resolve, reject) => {
    const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })
    const timeout = window.setTimeout(() => { worker.terminate(); reject(new Error('P-108: Parsing took longer than 60 seconds. Try a smaller export.')) }, 60000)
    const stop = () => { clearTimeout(timeout); worker.terminate() }
    options.signal?.addEventListener('abort', () => { stop(); reject(new DOMException('Cancelled', 'AbortError')) }, { once: true })
    worker.onerror = () => { stop(); reject(new Error('P-109: The parser worker stopped unexpectedly.')) }
    worker.onmessage = (event) => {
      if (event.data.type === 'progress') options.onProgress?.(event.data.progress)
      if (event.data.type === 'error') { stop(); reject(new Error(event.data.message)) }
      if (event.data.type === 'done') { options.onDiagnostics?.(event.data.diagnostics); stop(); resolve(event.data.result) }
    }
    worker.postMessage({ file, includeAiChunks: options.includeAiChunks })
  })
}
