import { afterEach, describe, expect, it } from 'vitest'
import {
  HEADING_NUMBERING_CSS,
  loadLocalHeadingNumberingPreference,
  persistLocalHeadingNumberingPreference,
} from '../headingNumbering'

describe('heading numbering styles', () => {
  afterEach(() => {
    persistLocalHeadingNumberingPreference(false)
  })

  it('defines CSS counter prefixes for rendered headings and outline entries', () => {
    expect(HEADING_NUMBERING_CSS).toContain('[data-mf-heading-numbering="true"] .cm-content {')
    expect(HEADING_NUMBERING_CSS).toContain('content: counter(mf-editor-h1) ". ";')
    expect(HEADING_NUMBERING_CSS).toContain('content: counter(mf-editor-h1) "." counter(mf-editor-h2) ". ";')
    expect(HEADING_NUMBERING_CSS).toContain(
      'content: counter(mf-editor-h1) "." counter(mf-editor-h2) "." counter(mf-editor-h3) ". ";',
    )
    expect(HEADING_NUMBERING_CSS).toContain(
      'content: counter(mf-editor-h1) "." counter(mf-editor-h2) "." counter(mf-editor-h3) "." counter(mf-editor-h4) ". ";',
    )
    expect(HEADING_NUMBERING_CSS).toContain('content: counter(mf-outline-h1) ". ";')
    expect(HEADING_NUMBERING_CSS).toContain('content: counter(mf-outline-h1) "." counter(mf-outline-h2) ". ";')
    expect(HEADING_NUMBERING_CSS).toContain(
      'content: counter(mf-outline-h1) "." counter(mf-outline-h2) "." counter(mf-outline-h3) ". ";',
    )
    expect(HEADING_NUMBERING_CSS).toContain(
      'content: counter(mf-outline-h1) "." counter(mf-outline-h2) "." counter(mf-outline-h3) "." counter(mf-outline-h4) ". ";',
    )
  })

  it('persists the local heading numbering preference', () => {
    expect(loadLocalHeadingNumberingPreference()).toBe(false)

    persistLocalHeadingNumberingPreference(true)
    expect(loadLocalHeadingNumberingPreference()).toBe(true)

    persistLocalHeadingNumberingPreference(false)
    expect(loadLocalHeadingNumberingPreference()).toBe(false)
  })
})
