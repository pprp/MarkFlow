import { extractOutlineHeadings } from '../editor/outline'
import { HEADING_NUMBERING_ATTRIBUTE } from '../headingNumbering'
import { DEFAULT_MARKDOWN_MODE, type MarkFlowMarkdownMode } from '../markdownMode'

const EXPORT_PAGE_CSS = `
html {
  background: var(--mf-bg);
}

body.mf-export-body {
  margin: 0;
  padding: 18mm 16mm;
  background: var(--mf-bg);
  color: var(--mf-fg);
  font-family: var(--mf-font-sans);
}

.mf-export-document {
  width: 100%;
  max-width: min(100%, var(--mf-content-width, 720px));
  margin: 0 auto;
}

.mf-export-document .cm-editor {
  height: auto !important;
  background: transparent !important;
}

.mf-export-document .cm-scroller {
  overflow: visible !important;
  padding: 0 !important;
  background: transparent !important;
}

.mf-export-document .cm-content {
  max-width: none;
  margin: 0;
  padding: 0 !important;
  min-height: 0 !important;
}

.mf-export-document .cm-line {
  overflow: visible;
}

.mf-export-document .mf-h1,
.mf-export-document .mf-h2,
.mf-export-document .mf-h3,
.mf-export-document .mf-h4,
.mf-export-document .mf-h5,
.mf-export-document .mf-h6 {
  break-after: avoid-page;
  page-break-after: avoid;
}

.mf-export-document pre,
.mf-export-document blockquote,
.mf-export-document img,
.mf-export-document svg,
.mf-export-document .mf-code-block-header,
.mf-export-document .mf-math-block,
.mf-export-document .mf-table-row,
.mf-export-document .mf-diagram,
.mf-export-document .mf-mermaid {
  break-inside: avoid;
  page-break-inside: avoid;
}

.mf-export-document a[href^="#"] {
  text-decoration: none;
}

.mf-export-document a[href^="#"]:hover {
  text-decoration: underline;
}

@page {
  size: A4;
  margin: 16mm 14mm;
}
`.trim()

const HEADING_SELECTOR = '.cm-line.mf-h1, .cm-line.mf-h2, .cm-line.mf-h3, .cm-line.mf-h4, .cm-line.mf-h5, .cm-line.mf-h6'

type PrepareRenderedDocumentOptions = {
  content: string
  markdownMode?: MarkFlowMarkdownMode
  renderedRoot: HTMLElement
}

type SerializeRenderedDocumentOptions = PrepareRenderedDocumentOptions & {
  document: Document
  headingNumberingEnabled: boolean
  title: string
}

type ExportMetadata = {
  title?: string
  author?: string
  keywords?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function unquoteYamlScalar(value: string) {
  const trimmed = value.trim()
  if (trimmed.length < 2) {
    return trimmed
  }

  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

function parseInlineYamlList(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null
  }

  return trimmed
    .slice(1, -1)
    .split(',')
    .map((item) => unquoteYamlScalar(item))
    .filter(Boolean)
}

function normalizeYamlMetadataValue(value: string) {
  const inlineList = parseInlineYamlList(value)
  if (inlineList) {
    return inlineList.join(', ')
  }

  return unquoteYamlScalar(value)
}

function parseYamlExportMetadata(content: string): ExportMetadata {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return {}
  }

  const closingFenceIndex = lines.findIndex((line, index) => {
    if (index === 0) {
      return false
    }

    const trimmed = line.trim()
    return trimmed === '---' || trimmed === '...'
  })
  if (closingFenceIndex < 0) {
    return {}
  }

  const metadata: ExportMetadata = {}
  for (const line of lines.slice(1, closingFenceIndex)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!match) {
      continue
    }

    const key = match[1].toLowerCase()
    const value = normalizeYamlMetadataValue(match[2])
    if (!value) {
      continue
    }

    if (key === 'title') {
      metadata.title = value
    } else if (key === 'author') {
      metadata.author = value
    } else if (key === 'keywords') {
      metadata.keywords = value
    }
  }

  return metadata
}

function stripYamlFrontMatter(content: string) {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return content
  }

  const closingFenceIndex = lines.findIndex((line, index) => {
    if (index === 0) {
      return false
    }

    const trimmed = line.trim()
    return trimmed === '---' || trimmed === '...'
  })

  return closingFenceIndex < 0 ? content : lines.slice(closingFenceIndex + 1).join('\n')
}

function stripEditorOnlyAttributes(root: HTMLElement) {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('[contenteditable], [spellcheck], [tabindex]'))]
  for (const element of elements) {
    element.removeAttribute('contenteditable')
    element.removeAttribute('spellcheck')
    element.removeAttribute('tabindex')
  }
}

function stripEditorOnlyElements(root: HTMLElement) {
  for (const element of root.querySelectorAll('.mf-diagram-actions')) {
    element.remove()
  }
}

function normalizeInternalLinks(root: HTMLElement) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    link.removeAttribute('target')
    link.removeAttribute('rel')
  }
}

function addHeadingAnchors(
  root: HTMLElement,
  content: string,
  markdownMode: MarkFlowMarkdownMode,
) {
  const headings = extractOutlineHeadings(stripYamlFrontMatter(content), markdownMode)
  const renderedHeadingNodes = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR))

  for (const [index, heading] of headings.entries()) {
    const node = renderedHeadingNodes[index]
    if (!node) {
      break
    }

    node.id = heading.anchor
    node.setAttribute('role', 'heading')
    node.setAttribute('aria-level', String(heading.level))
    node.dataset.mfHeadingAnchor = heading.anchor
  }
}

function eagerLoadImages(root: HTMLElement) {
  for (const image of root.querySelectorAll<HTMLImageElement>('img')) {
    image.loading = 'eager'
    image.decoding = 'sync'
    image.setAttribute('loading', 'eager')
    image.setAttribute('decoding', 'sync')
  }
}

function serializeStyleSheet(sheet: CSSStyleSheet) {
  try {
    return Array.from(sheet.cssRules)
      .map((rule) => rule.cssText)
      .join('\n')
  } catch {
    const owner = sheet.ownerNode
    if (owner instanceof HTMLStyleElement) {
      return owner.textContent ?? ''
    }

    return ''
  }
}

function collectMarkFlowCssVariables(document: Document) {
  const style = document.defaultView?.getComputedStyle(document.documentElement)
  if (!style) {
    return ''
  }

  const entries: string[] = []
  for (let index = 0; index < style.length; index += 1) {
    const name = style.item(index)
    if (!name.startsWith('--mf-')) {
      continue
    }

    const value = style.getPropertyValue(name).trim()
    if (!value) {
      continue
    }

    entries.push(`  ${name}: ${value};`)
  }

  if (entries.length === 0) {
    return ''
  }

  entries.sort()
  return `:root {\n${entries.join('\n')}\n}`
}

export function collectDocumentStyleText(document: Document) {
  const cssBlocks: string[] = []
  const seen = new Set<string>()

  for (const sheet of Array.from(document.styleSheets)) {
    const cssText = serializeStyleSheet(sheet as CSSStyleSheet).trim()
    if (!cssText || seen.has(cssText)) {
      continue
    }

    seen.add(cssText)
    cssBlocks.push(cssText)
  }

  const rootVariables = collectMarkFlowCssVariables(document).trim()
  if (rootVariables && !seen.has(rootVariables)) {
    cssBlocks.push(rootVariables)
  }

  cssBlocks.push(EXPORT_PAGE_CSS)
  return cssBlocks.join('\n\n')
}

export function prepareRenderedDocumentForExport({
  content,
  markdownMode = DEFAULT_MARKDOWN_MODE,
  renderedRoot,
}: PrepareRenderedDocumentOptions) {
  const clone = renderedRoot.cloneNode(true) as HTMLElement
  stripEditorOnlyAttributes(clone)
  stripEditorOnlyElements(clone)
  normalizeInternalLinks(clone)
  addHeadingAnchors(clone, content, markdownMode)
  eagerLoadImages(clone)
  return clone
}

export function serializeRenderedDocumentForExport({
  content,
  document,
  headingNumberingEnabled,
  markdownMode = DEFAULT_MARKDOWN_MODE,
  renderedRoot,
  title,
}: SerializeRenderedDocumentOptions) {
  const metadata = parseYamlExportMetadata(content)
  const preparedRoot = prepareRenderedDocumentForExport({
    content,
    markdownMode,
    renderedRoot,
  })
  const styles = collectDocumentStyleText(document)
  const metadataTags = [
    metadata.author ? `  <meta name="author" content="${escapeHtml(metadata.author)}">` : null,
    metadata.keywords ? `  <meta name="keywords" content="${escapeHtml(metadata.keywords)}">` : null,
  ].filter((tag): tag is string => tag !== null)
  const exportTitle = metadata.title ?? title

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
${metadataTags.length > 0 ? `${metadataTags.join('\n')}\n` : ''}  <title>${escapeHtml(exportTitle)}</title>
  <style>${styles}</style>
</head>
<body class="mf-export-body" ${HEADING_NUMBERING_ATTRIBUTE}="${headingNumberingEnabled ? 'true' : 'false'}">
  <div class="mf-export-document">
    <div class="cm-editor">
      <div class="cm-scroller">
        ${preparedRoot.outerHTML}
      </div>
    </div>
  </div>
</body>
</html>`
}
