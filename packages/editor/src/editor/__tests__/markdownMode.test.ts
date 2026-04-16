import { describe, expect, it } from 'vitest'
import { getMarkdownParser } from '../../markdownMode'

function firstBlockName(text: string, mode: 'tolerant' | 'strict') {
  const cursor = getMarkdownParser(mode).parse(text).cursor()
  expect(cursor.firstChild()).toBe(true)
  return cursor.name
}

function listItemRanges(text: string, mode: 'tolerant' | 'strict') {
  const ranges: Array<[number, number]> = []

  getMarkdownParser(mode).parse(text).iterate({
    enter(node) {
      if (node.name === 'ListItem') {
        ranges.push([node.from, node.to])
      }
    },
  })

  return ranges
}

describe('markdown mode parser', () => {
  it('treats ATX headings without marker whitespace as headings only in tolerant mode', () => {
    expect(firstBlockName('###Header\n', 'strict')).toBe('Paragraph')
    expect(firstBlockName('###Header\n', 'tolerant')).toBe('ATXHeading3')
    expect(firstBlockName('### Header\n', 'strict')).toBe('ATXHeading3')
  })

  it('switches ordered-list paragraph indentation between tolerant and strict rules', () => {
    const fixture = '1. aaa\n  bbb\n'

    expect(listItemRanges(fixture, 'strict')).toEqual([[0, 6]])
    expect(listItemRanges(fixture, 'tolerant')).toEqual([[0, 12]])
  })

  it('switches ordered sublist indentation between tolerant and strict rules', () => {
    const fixture = '10. aaa\n  1. ccc\n'

    expect(listItemRanges(fixture, 'strict')).toEqual([
      [0, 7],
      [8, 16],
    ])
    expect(listItemRanges(fixture, 'tolerant')).toEqual([
      [0, 16],
      [10, 16],
    ])
  })
})
