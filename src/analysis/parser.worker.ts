/// <reference lib="webworker" />
import { parseChat } from './parseChat'

type Request = { file: File; includeAiChunks?: boolean }

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    const { result, diagnostics } = await parseChat(event.data.file, { includeAiChunks: event.data.includeAiChunks, onProgress: (progress) => postMessage({ type: 'progress', progress }) })
    postMessage({ type: 'done', result, diagnostics })
  } catch (error) { postMessage({ type: 'error', message: error instanceof Error ? error.message : 'P-100: The export could not be read.' }) }
}
