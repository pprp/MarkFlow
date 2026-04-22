import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  collectDocumentStyleText,
  prepareRenderedDocumentForExport,
  serializeRenderedDocumentForExport,
} from './htmlExport'

const preparedFixturePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '__fixtures__',
  'prepared-rendered-document.html',
)

function resetDom() {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('style')
}

function normalizeHtml(value: string) {
  return value.replace(/>\s+</g, '><').trim()
}

function makeRenderedRoot() {
  const root = document.createElement('div')
  root.className = 'cm-content'
  root.setAttribute('contenteditable', 'true')
  root.innerHTML = [
    '<div class="cm-line mf-h1" tabindex="0">Intro</div>',
    '<div class="cm-line">See <a class="mf-link" href="#setup" target="_blank" rel="noopener noreferrer">Setup</a>.</div>',
    '<div class="cm-line mf-code-block-first mf-code-block-with-lang" data-lang="ts">const value = 1</div>',
    '<div class="cm-line"><span class="mf-math-inline"><span class="katex">x^2</span></span></div>',
    '<div class="cm-line mf-table-row mf-table-header-row" data-mf-table-from="0"><span class="mf-table-cell">Name</span><span class="mf-table-cell">Value</span></div>',
    '<div class="cm-line"><img src="file:///tmp/diagram.png" alt="Diagram" loading="lazy"></div>',
    '<div class="cm-line mf-h2">Setup</div>',
  ].join('')
  return root
}

describe('html export serializer', () => {
  afterEach(() => {
    resetDom()
  })

  it('prepares a rendered document clone with heading ids and normalized internal links', () => {
    const prepared = prepareRenderedDocumentForExport({
      content: '# Intro\n\nSee [Setup](#setup).\n\n```ts\nconst value = 1\n```\n\n$x^2$\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n## Setup',
      renderedRoot: makeRenderedRoot(),
    })
    const expected = readFileSync(preparedFixturePath, 'utf8').trim()

    expect(normalizeHtml(prepared.outerHTML)).toBe(normalizeHtml(expected))
  })

  it('collects stylesheet text plus resolved MarkFlow CSS variables', () => {
    const style = document.createElement('style')
    style.textContent = '.cm-editor { color: var(--mf-fg); }'
    document.head.append(style)
    document.documentElement.style.setProperty('--mf-bg', 'rgb(17, 17, 17)')
    document.documentElement.style.setProperty('--mf-fg', 'rgb(244, 244, 244)')

    const cssText = collectDocumentStyleText(document)

    expect(cssText).toContain('.cm-editor {color: var(--mf-fg);}')
    expect(cssText).toContain('--mf-bg: rgb(17, 17, 17);')
    expect(cssText).toContain('--mf-fg: rgb(244, 244, 244);')
    expect(cssText).toContain('@page {')
  })

  it('serializes a standalone HTML document for export', () => {
    const style = document.createElement('style')
    style.textContent = '.mf-link { color: var(--mf-link-color); }'
    document.head.append(style)
    document.documentElement.style.setProperty('--mf-link-color', 'rgb(99, 66, 33)')

    const html = serializeRenderedDocumentForExport({
      content: '# Intro\n\n## Setup',
      document,
      headingNumberingEnabled: true,
      renderedRoot: makeRenderedRoot(),
      title: 'Doc & Test',
    })

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<title>Doc &amp; Test</title>')
    expect(html).toContain('data-mf-heading-numbering="true"')
    expect(html).toContain('id="intro"')
    expect(html).toContain('id="setup"')
    expect(html).toContain('.mf-link {color: var(--mf-link-color);}')
    expect(html).toContain('--mf-link-color: rgb(99, 66, 33);')
    expect(html).toContain('@page {')
  })

  it('uses YAML front matter title, author, and keywords as HTML export metadata', () => {
    const html = serializeRenderedDocumentForExport({
      content: [
        '---',
        'title: Export & Metadata',
        'author: Ada Lovelace',
        'keywords: [markflow, typora parity]',
        '---',
        '# Intro',
      ].join('\n'),
      document,
      headingNumberingEnabled: false,
      renderedRoot: makeRenderedRoot(),
      title: 'Fallback.md',
    })

    expect(html).toContain('<title>Export &amp; Metadata</title>')
    expect(html).toContain('<meta name="author" content="Ada Lovelace">')
    expect(html).toContain('<meta name="keywords" content="markflow, typora parity">')
    expect(html).toContain('id="intro"')
    expect(html).not.toContain('title-export-metadata')
  })
})
