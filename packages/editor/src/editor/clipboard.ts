interface ClipboardSerialization {
  html: string
  text: string
}

interface InlineToken {
  content: string
  href?: string
  next: number
  type: 'code' | 'emphasis' | 'link' | 'strong'
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function matchInlineToken(source: string, start: number): InlineToken | null {
  if (source.startsWith('**', start)) {
    const end = source.indexOf('**', start + 2)
    if (end > start + 2) {
      return {
        type: 'strong',
        content: source.slice(start + 2, end),
        next: end + 2,
      }
    }
  }

  if (source.charAt(start) === '`') {
    const end = source.indexOf('`', start + 1)
    if (end > start + 1) {
      return {
        type: 'code',
        content: source.slice(start + 1, end),
        next: end + 1,
      }
    }
  }

  if (source.charAt(start) === '[') {
    const labelEnd = source.indexOf(']', start + 1)
    if (labelEnd > start + 1 && source.charAt(labelEnd + 1) === '(') {
      const hrefEnd = source.indexOf(')', labelEnd + 2)
      if (hrefEnd > labelEnd + 2) {
        return {
          type: 'link',
          content: source.slice(start + 1, labelEnd),
          href: source.slice(labelEnd + 2, hrefEnd),
          next: hrefEnd + 1,
        }
      }
    }
  }

  if (source.charAt(start) === '*' && source.charAt(start + 1) !== '*') {
    const end = source.indexOf('*', start + 1)
    if (end > start + 1) {
      return {
        type: 'emphasis',
        content: source.slice(start + 1, end),
        next: end + 1,
      }
    }
  }

  return null
}

function renderInlineMarkdown(source: string): ClipboardSerialization {
  let html = ''
  let text = ''
  let buffer = ''

  const flushText = () => {
    if (buffer.length === 0) {
      return
    }

    html += escapeHtml(buffer)
    text += buffer
    buffer = ''
  }

  for (let cursor = 0; cursor < source.length;) {
    const token = matchInlineToken(source, cursor)

    if (!token) {
      buffer += source.charAt(cursor)
      cursor += 1
      continue
    }

    flushText()

    if (token.type === 'code') {
      html += `<code>${escapeHtml(token.content)}</code>`
      text += token.content
      cursor = token.next
      continue
    }

    const renderedContent = renderInlineMarkdown(token.content)

    if (token.type === 'strong') {
      html += `<strong>${renderedContent.html}</strong>`
      text += renderedContent.text
      cursor = token.next
      continue
    }

    if (token.type === 'emphasis') {
      html += `<em>${renderedContent.html}</em>`
      text += renderedContent.text
      cursor = token.next
      continue
    }

    html += `<a href="${escapeHtml(token.href ?? '')}">${renderedContent.html}</a>`
    text += renderedContent.text
    cursor = token.next
  }

  flushText()
  return { html, text }
}

function renderParagraph(paragraph: string): ClipboardSerialization {
  const lines = paragraph.split('\n').map(renderInlineMarkdown)
  return {
    html: lines.map((line) => line.html).join('<br>'),
    text: lines.map((line) => line.text).join('\n'),
  }
}

export function serializeMarkdownSelectionForClipboard(markdown: string): ClipboardSerialization {
  const normalizedMarkdown = markdown.replace(/\r\n?/g, '\n')
  const paragraphs = normalizedMarkdown
    .split(/\n{2,}/)
    .filter((paragraph, index, allParagraphs) => paragraph.length > 0 || allParagraphs.length === 1)
  const renderedParagraphs = paragraphs.map(renderParagraph)

  return {
    html: renderedParagraphs.map((paragraph) => `<p>${paragraph.html}</p>`).join(''),
    text: renderedParagraphs.map((paragraph) => paragraph.text).join('\n\n'),
  }
}
