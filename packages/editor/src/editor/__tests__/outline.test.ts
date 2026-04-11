import { describe, expect, it } from 'vitest'
import {
  extractOutlineHeadings,
  findActiveHeadingAnchor,
  findHeadingAnchorPosition,
} from '../outline'

describe('outline helpers', () => {
  it('extracts heading hierarchy and de-duplicates anchors', () => {
    const doc = ['# Intro', '', '## Setup', '', '## Setup', '', '### Deep Dive'].join('\n')

    expect(extractOutlineHeadings(doc)).toEqual([
      { anchor: 'intro', from: 0, level: 1, lineNumber: 1, text: 'Intro' },
      { anchor: 'setup', from: 9, level: 2, lineNumber: 3, text: 'Setup' },
      { anchor: 'setup-1', from: 19, level: 2, lineNumber: 5, text: 'Setup' },
      { anchor: 'deep-dive', from: 29, level: 3, lineNumber: 7, text: 'Deep Dive' },
    ])
  })

  it('ignores fenced-code heading text and still tracks setext headings', () => {
    const doc = ['# Intro', '', '```md', '# not-a-heading', '```', '', 'Title', '===='].join('\n')

    expect(extractOutlineHeadings(doc).map((heading) => heading.text)).toEqual(['Intro', 'Title'])
    expect(findHeadingAnchorPosition(doc, '#not-a-heading')).toBeNull()
    expect(findHeadingAnchorPosition(doc, '#title')).toBe(doc.indexOf('Title'))
  })

  it('finds heading positions and the currently active heading anchor', () => {
    const doc = ['Intro', '', '# First', '', '## Second', '', '# Third'].join('\n')
    const headings = extractOutlineHeadings(doc)

    expect(findHeadingAnchorPosition(doc, '#second')).toBe(doc.indexOf('## Second'))
    expect(findHeadingAnchorPosition(doc, '#missing')).toBeNull()
    expect(findActiveHeadingAnchor(headings, 0)).toBeNull()
    expect(findActiveHeadingAnchor(headings, doc.indexOf('## Second'))).toBe('second')
    expect(findActiveHeadingAnchor(headings, doc.length)).toBe('third')
  })
})
