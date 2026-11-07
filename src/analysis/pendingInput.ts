import type { MockChatId } from './getAnalysis'

let pendingFile: File | undefined
let pendingMock: MockChatId | undefined
let pendingAiMode: 'facts-only' | 'with-quotes' = 'facts-only'

export function setPendingFile(file: File) { pendingFile = file; pendingMock = undefined }
export function setPendingMock(mock: MockChatId) { pendingMock = mock; pendingFile = undefined }
export function setPendingAiMode(mode: 'facts-only' | 'with-quotes') { pendingAiMode = mode }
export function getPendingInput() { return { file: pendingFile, mock: pendingMock, aiMode: pendingAiMode } }
export function clearPendingInput() { pendingFile = undefined; pendingMock = undefined; pendingAiMode = 'facts-only' }
