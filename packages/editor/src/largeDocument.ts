export const LARGE_DOCUMENT_UI_THREAD_THRESHOLD_CHARS = 1_000_000

export const LARGE_DOCUMENT_CONTENT_SYNC_DELAY_MS = 200

export function isLargeInteractiveDocument(contentLength: number) {
  return contentLength >= LARGE_DOCUMENT_UI_THREAD_THRESHOLD_CHARS
}
