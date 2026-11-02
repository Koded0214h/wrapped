import type { MockChatId } from './getAnalysis'

let pendingFile: File | undefined
let pendingMock: MockChatId | undefined

export function setPendingFile(file: File) { pendingFile = file; pendingMock = undefined }
export function setPendingMock(mock: MockChatId) { pendingMock = mock; pendingFile = undefined }
export function getPendingInput() { return { file: pendingFile, mock: pendingMock } }
export function clearPendingInput() { pendingFile = undefined; pendingMock = undefined }
