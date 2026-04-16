export interface DocumentStats {
  words: number
  lines: number
  chars: number
  charsNoSpaces: number
  paragraphs: number
  readingMinutes: number
  selectionWords: number
  selectionChars: number
  selectionCharsNoSpaces: number
  selectionParagraphs: number
  selectionReadingMinutes: number
}

export interface DocumentStatsOptions {
  excludeFencedCode?: boolean
  readingWordsPerMinute?: number
}

const DEFAULT_WORDS_PER_MINUTE = 200

function normalizeOptions(options: DocumentStatsOptions = {}): Required<DocumentStatsOptions> {
  return {
    excludeFencedCode: options.excludeFencedCode !== false,
    readingWordsPerMinute:
      Number.isFinite(options.readingWordsPerMinute) && (options.readingWordsPerMinute ?? 0) > 0
        ? Math.round(options.readingWordsPerMinute as number)
        : DEFAULT_WORDS_PER_MINUTE,
  }
}

function stripYamlFrontMatter(text: string) {
  return text.replace(/^---[\s\S]*?---\n?/, '')
}

function removeFencedCodeContent(text: string) {
  return text.replace(/```[\s\S]*?```/g, '\n')
}

function removeFencedCodeMarkers(text: string) {
  return text.replace(/^```[^\n]*$/gm, '')
}

function getCharacterCountText(text: string, options: Required<DocumentStatsOptions>) {
  const withoutFrontMatter = stripYamlFrontMatter(text)
  return options.excludeFencedCode ? removeFencedCodeContent(withoutFrontMatter) : withoutFrontMatter
}

function countCharactersWithoutSpaces(text: string) {
  return text.replace(/\s+/g, '').length
}

function countReadingMinutes(words: number, wordsPerMinute: number) {
  if (words === 0) {
    return 0
  }

  return Math.max(1, Math.ceil(words / wordsPerMinute))
}

function countParagraphs(text: string, options: Required<DocumentStatsOptions>) {
  return stripMarkdownSyntax(text, options)
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .length
}

/**
 * Strip markdown syntax from text before counting words so that
 * formatting markers (*, **, #, >, etc.) are not treated as words.
 */
export function stripMarkdownSyntax(text: string, options: DocumentStatsOptions = {}): string {
  const normalizedOptions = normalizeOptions(options)
  let out = stripYamlFrontMatter(text)

  // Preserve code text when exclusion is disabled, but always hide the fence lines themselves.
  out = normalizedOptions.excludeFencedCode ? removeFencedCodeContent(out) : removeFencedCodeMarkers(out)
  out = out.replace(/`[^`\n]+`/g, ' ')
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  out = out.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
  out = out.replace(/^#{1,6}\s+/gm, '')
  out = out.replace(/^>\s*/gm, '')
  out = out.replace(/^[ \t]*[-*+]\s+/gm, '')
  out = out.replace(/^[ \t]*\d+\.\s+/gm, '')
  out = out.replace(/^[-*_]{3,}\s*$/gm, '')
  out = out.replace(/[*_~]{1,3}/g, '')
  return out
}

export function countWords(text: string, options: DocumentStatsOptions = {}): number {
  const stripped = stripMarkdownSyntax(text, options)
  return stripped.split(/\s+/).filter((word) => word.length > 0).length
}

export function computeStats(
  fullText: string,
  selectionText: string,
  options: DocumentStatsOptions = {},
): DocumentStats {
  const normalizedOptions = normalizeOptions(options)
  const countableFullText = getCharacterCountText(fullText, normalizedOptions)
  const countableSelectionText = selectionText
    ? getCharacterCountText(selectionText, normalizedOptions)
    : ''
  const words = countWords(fullText, normalizedOptions)
  const lines = fullText ? fullText.split('\n').length : 0
  const chars = countableFullText.length
  const charsNoSpaces = countCharactersWithoutSpaces(countableFullText)
  const paragraphs = countParagraphs(fullText, normalizedOptions)
  const readingMinutes = countReadingMinutes(words, normalizedOptions.readingWordsPerMinute)
  const selectionWords = selectionText ? countWords(selectionText, normalizedOptions) : 0
  const selectionChars = countableSelectionText.length
  const selectionCharsNoSpaces = countCharactersWithoutSpaces(countableSelectionText)
  const selectionParagraphs = selectionText ? countParagraphs(selectionText, normalizedOptions) : 0
  const selectionReadingMinutes = countReadingMinutes(
    selectionWords,
    normalizedOptions.readingWordsPerMinute,
  )

  return {
    words,
    lines,
    chars,
    charsNoSpaces,
    paragraphs,
    readingMinutes,
    selectionWords,
    selectionChars,
    selectionCharsNoSpaces,
    selectionParagraphs,
    selectionReadingMinutes,
  }
}
