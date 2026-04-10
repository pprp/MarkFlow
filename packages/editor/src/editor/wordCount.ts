export interface DocumentStats {
  words: number
  lines: number
  chars: number
  readingMinutes: number
  selectionWords: number
  selectionChars: number
}

const WORDS_PER_MINUTE = 200

/**
 * Strip markdown syntax from text before counting words so that
 * formatting markers (*, **, #, >, etc.) are not treated as words.
 */
export function stripMarkdownSyntax(text: string): string {
  let out = text
  // Remove YAML front matter first (before horizontal-rule stripping eats the --- fences)
  out = out.replace(/^---[\s\S]*?---\n?/, '')
  // Remove fenced code blocks (don't count code content as prose)
  out = out.replace(/```[\s\S]*?```/g, ' ')
  // Remove inline code
  out = out.replace(/`[^`\n]+`/g, ' ')
  // Remove images — keep no text
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  // Remove links — keep the link text
  out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Remove reference-style links [text][ref]
  out = out.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
  // Remove heading markers
  out = out.replace(/^#{1,6}\s+/gm, '')
  // Remove blockquote markers
  out = out.replace(/^>\s*/gm, '')
  // Remove unordered list markers
  out = out.replace(/^[ \t]*[-*+]\s+/gm, '')
  // Remove ordered list markers
  out = out.replace(/^[ \t]*\d+\.\s+/gm, '')
  // Remove horizontal rules
  out = out.replace(/^[-*_]{3,}\s*$/gm, '')
  // Remove bold/italic/strikethrough markers
  out = out.replace(/[*_~]{1,3}/g, '')
  return out
}

export function countWords(text: string): number {
  const stripped = stripMarkdownSyntax(text)
  return stripped.split(/\s+/).filter((w) => w.length > 0).length
}

export function computeStats(fullText: string, selectionText: string): DocumentStats {
  const words = countWords(fullText)
  const lines = fullText ? fullText.split('\n').length : 0
  const chars = fullText.length
  const readingMinutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  const selectionWords = selectionText ? countWords(selectionText) : 0
  const selectionChars = selectionText ? selectionText.length : 0

  return { words, lines, chars, readingMinutes, selectionWords, selectionChars }
}
