import { describe, it, expect } from 'vitest'
import { countWords, computeStats, stripMarkdownSyntax } from '../wordCount'

describe('stripMarkdownSyntax', () => {
  it('removes heading markers', () => {
    const stripped = stripMarkdownSyntax('# Hello World')
    expect(stripped.includes('#')).toBe(false)
    expect(stripped.includes('Hello')).toBe(true)
  })

  it('removes bold markers', () => {
    const stripped = stripMarkdownSyntax('**bold** text')
    expect(stripped.includes('*')).toBe(false)
    expect(stripped.includes('bold')).toBe(true)
  })

  it('removes italic markers', () => {
    const stripped = stripMarkdownSyntax('*italic* text')
    expect(stripped.includes('*')).toBe(false)
    expect(stripped.includes('italic')).toBe(true)
  })

  it('removes blockquote markers', () => {
    const stripped = stripMarkdownSyntax('> quoted text')
    expect(stripped.trim().startsWith('>')).toBe(false)
    expect(stripped.includes('quoted')).toBe(true)
  })

  it('removes unordered list markers', () => {
    const stripped = stripMarkdownSyntax('- item one\n- item two')
    expect(stripped.includes('- ')).toBe(false)
    expect(stripped.includes('item')).toBe(true)
  })

  it('removes ordered list markers', () => {
    const stripped = stripMarkdownSyntax('1. first\n2. second')
    expect(stripped.includes('1.')).toBe(false)
    expect(stripped.includes('first')).toBe(true)
  })

  it('removes fenced code blocks entirely', () => {
    const stripped = stripMarkdownSyntax('```js\nconst x = 1\n```')
    expect(stripped.includes('const')).toBe(false)
  })

  it('removes inline code', () => {
    const stripped = stripMarkdownSyntax('Use `const x = 1` here')
    expect(stripped.includes('const')).toBe(false)
    expect(stripped.includes('Use')).toBe(true)
  })

  it('keeps link text and removes URL', () => {
    const stripped = stripMarkdownSyntax('[click here](https://example.com)')
    expect(stripped.includes('click here')).toBe(true)
    expect(stripped.includes('https')).toBe(false)
  })

  it('removes image syntax entirely', () => {
    const stripped = stripMarkdownSyntax('![alt text](image.png)')
    expect(stripped.includes('alt text')).toBe(false)
    expect(stripped.includes('image.png')).toBe(false)
  })

  it('removes horizontal rules', () => {
    const stripped = stripMarkdownSyntax('---')
    expect(stripped.trim()).toBe('')
  })

  it('removes YAML front matter', () => {
    const stripped = stripMarkdownSyntax('---\ntitle: hello\n---\nBody text')
    expect(stripped.includes('title')).toBe(false)
    expect(stripped.includes('Body')).toBe(true)
  })
})

describe('countWords', () => {
  it('counts plain words', () => {
    expect(countWords('hello world foo')).toBe(3)
  })

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0)
  })

  it('excludes markdown heading markers', () => {
    expect(countWords('# Hello World')).toBe(2)
  })

  it('excludes fenced code content', () => {
    const text = 'Hello\n```js\nconst a = b\n```\nWorld'
    const count = countWords(text)
    expect(count).toBe(2) // only "Hello" and "World"
  })

  it('counts link text but not URLs', () => {
    const count = countWords('[click here](https://example.com)')
    expect(count).toBe(2) // "click" and "here"
  })

  it('excludes inline code', () => {
    const count = countWords('Use `some code` here')
    expect(count).toBe(2) // "Use" and "here"
  })
})

describe('computeStats', () => {
  it('returns correct word count', () => {
    const stats = computeStats('Hello world', '')
    expect(stats.words).toBe(2)
  })

  it('returns correct line count', () => {
    const stats = computeStats('line one\nline two\nline three', '')
    expect(stats.lines).toBe(3)
  })

  it('returns correct char count', () => {
    const stats = computeStats('abc', '')
    expect(stats.chars).toBe(3)
  })

  it('returns readingMinutes >= 1 for short text', () => {
    const stats = computeStats('hi', '')
    expect(stats.readingMinutes).toBeGreaterThanOrEqual(1)
  })

  it('returns selection word count', () => {
    const stats = computeStats('Hello world', 'Hello')
    expect(stats.selectionWords).toBe(1)
    expect(stats.selectionChars).toBe(5)
  })

  it('returns zero selection stats when no selection', () => {
    const stats = computeStats('Hello world', '')
    expect(stats.selectionWords).toBe(0)
    expect(stats.selectionChars).toBe(0)
  })

  it('longer text produces proportional reading time', () => {
    const longText = Array(400).fill('word').join(' ')
    const stats = computeStats(longText, '')
    expect(stats.readingMinutes).toBe(2)
  })
})
