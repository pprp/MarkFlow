import { describe, expect, it } from 'vitest'
import {
  buildFuzzySearchPattern,
  countFuzzySearchMatches,
  createFuzzySearchQuery,
} from '../documentSearch'

describe('fuzzy-search helpers', () => {
  it('builds a line-bounded fuzzy regexp for subsequence queries', () => {
    expect(buildFuzzySearchPattern('mf')).toBe('m[^\\n]*?f')
    expect(buildFuzzySearchPattern('mf doc')).toBe('m[^\\n]*?f[^\\S\\n]+d[^\\n]*?o[^\\n]*?c')
    expect(buildFuzzySearchPattern('   ')).toBeNull()
  })

  it('counts case-insensitive fuzzy matches without crossing line boundaries', () => {
    const content = [
      'MarkFlow ships a focused search bar.',
      'meta flow keeps the editorial tempo steady.',
      'm',
      'f on a new line should not count.',
      'microfilm still matches.',
    ].join('\n')

    expect(countFuzzySearchMatches(content, 'mf')).toBe(3)
  })

  it('creates a regex-backed CodeMirror query for fuzzy navigation', () => {
    const query = createFuzzySearchQuery('mf')

    expect(query).not.toBeNull()
    expect(query?.regexp).toBe(true)
    expect(query?.search).toBe('m[^\\n]*?f')
  })
})
