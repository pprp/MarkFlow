import {
  DEFAULT_MARKDOWN_MODE,
  getMarkdownParser,
  type MarkFlowMarkdownMode,
} from '../markdownMode'

export interface OutlineHeading {
  anchor: string
  from: number
  level: number
  lineNumber: number
  text: string
}

const headingLevels = new Map<string, number>([
  ['ATXHeading1', 1],
  ['ATXHeading2', 2],
  ['ATXHeading3', 3],
  ['ATXHeading4', 4],
  ['ATXHeading5', 5],
  ['ATXHeading6', 6],
  ['SetextHeading1', 1],
  ['SetextHeading2', 2],
])

function lineNumberAt(content: string, position: number) {
  let lineNumber = 1

  for (let index = 0; index < position; index += 1) {
    if (content[index] === '\n') {
      lineNumber += 1
    }
  }

  return lineNumber
}

function extractHeadingText(name: string, rawHeading: string) {
  if (name.startsWith('ATXHeading')) {
    return rawHeading.replace(/^#{1,6}\s*/, '').replace(/\s*#*\s*$/, '').trim()
  }

  if (name.startsWith('SetextHeading')) {
    return rawHeading.split('\n')[0]?.trim() ?? ''
  }

  return rawHeading.trim()
}

export function normalizeHeadingAnchor(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function normalizeHeadingHref(href: string) {
  if (!href.startsWith('#')) {
    return null
  }

  const targetAnchor = normalizeHeadingAnchor(decodeURIComponent(href.slice(1)))
  return targetAnchor || null
}

export function extractOutlineHeadings(
  content: string,
  markdownMode: MarkFlowMarkdownMode = DEFAULT_MARKDOWN_MODE,
): OutlineHeading[] {
  const headings: OutlineHeading[] = []
  const seenAnchors = new Map<string, number>()
  getMarkdownParser(markdownMode).parse(content).iterate({
    enter(node) {
      const level = headingLevels.get(node.name)
      if (!level) {
        return
      }

      const text = extractHeadingText(node.name, content.slice(node.from, node.to))
      const baseAnchor = normalizeHeadingAnchor(text)
      if (!baseAnchor) {
        return false
      }

      const duplicateIndex = seenAnchors.get(baseAnchor) ?? 0
      seenAnchors.set(baseAnchor, duplicateIndex + 1)

      headings.push({
        anchor: duplicateIndex === 0 ? baseAnchor : `${baseAnchor}-${duplicateIndex}`,
        from: node.from,
        level,
        lineNumber: lineNumberAt(content, node.from),
        text,
      })

      return false
    },
  })

  return headings
}

export function findHeadingAnchorPosition(
  content: string,
  href: string,
  anchorLookup?: ReadonlyMap<string, number>,
  markdownMode: MarkFlowMarkdownMode = DEFAULT_MARKDOWN_MODE,
) {
  const targetAnchor = normalizeHeadingHref(href)
  if (!targetAnchor) {
    return null
  }

  if (anchorLookup) {
    return anchorLookup.get(targetAnchor) ?? null
  }

  return (
    extractOutlineHeadings(content, markdownMode).find((heading) => heading.anchor === targetAnchor)?.from ??
    null
  )
}

export function findActiveHeadingAnchor(headings: OutlineHeading[], position: number) {
  let activeAnchor: string | null = null

  for (const heading of headings) {
    if (heading.from > position) {
      break
    }

    activeAnchor = heading.anchor
  }

  return activeAnchor
}
