import { EditorView } from '@codemirror/view'

const PLAIN_TEXT_PASTE_SHORTCUT_WINDOW_MS = 1000

function isPlainTextPasteShortcut(event: KeyboardEvent) {
  return !event.altKey && (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'v'
}

function hasClipboardType(event: ClipboardEvent, type: string) {
  return event.clipboardData?.types.includes(type) ?? false
}

function htmlToMarkdown(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return convertNodeToMarkdown(doc.body).trim()
}

function convertNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const children = Array.from(el.childNodes).map(convertNodeToMarkdown).join('')

  switch (tag) {
    case 'h1':
      return `# ${children}\n\n`
    case 'h2':
      return `## ${children}\n\n`
    case 'h3':
      return `### ${children}\n\n`
    case 'h4':
      return `#### ${children}\n\n`
    case 'h5':
      return `##### ${children}\n\n`
    case 'h6':
      return `###### ${children}\n\n`
    case 'strong':
    case 'b':
      return `**${children}**`
    case 'em':
    case 'i':
      return `*${children}*`
    case 'a': {
      const href = el.getAttribute('href') ?? ''
      return `[${children}](${href})`
    }
    case 'li':
      return `- ${children}\n`
    case 'ul':
    case 'ol':
      return `\n${children}\n`
    case 'br':
      return '\n'
    case 'p':
      return `${children}\n\n`
    case 'code':
      return `\`${children}\``
    case 'pre':
      return `\`\`\`\n${children}\n\`\`\`\n\n`
    case 'blockquote':
      return children
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n') + '\n\n'
    default:
      return children
  }
}

function insertTextAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
  return { from, to, insertedText: text }
}

function countOccurrencesBefore(text: string, searchText: string, beforeIndex: number) {
  if (!searchText) {
    return 0
  }

  let occurrenceCount = 0
  let fromIndex = 0
  while (fromIndex < beforeIndex) {
    const foundAt = text.indexOf(searchText, fromIndex)
    if (foundAt < 0 || foundAt >= beforeIndex) {
      break
    }

    occurrenceCount += 1
    fromIndex = foundAt + searchText.length
  }

  return occurrenceCount
}

export function smartPasteExtension() {
  let plainTextPasteShortcutExpiresAt = 0

  return EditorView.domEventHandlers({
    keydown(event) {
      if (isPlainTextPasteShortcut(event)) {
        plainTextPasteShortcutExpiresAt = Date.now() + PLAIN_TEXT_PASTE_SHORTCUT_WINDOW_MS
      }

      return false
    },
    blur() {
      plainTextPasteShortcutExpiresAt = 0
      return false
    },
    paste(event, view) {
      const shouldPastePlainText = Date.now() <= plainTextPasteShortcutExpiresAt
      plainTextPasteShortcutExpiresAt = 0

      if (shouldPastePlainText) {
        if (hasClipboardType(event, 'text/plain')) {
          event.preventDefault()
          insertTextAtCursor(view, event.clipboardData?.getData('text/plain') ?? '')
          return true
        }
        return false
      }

      // Handle image paste (MF-029)
      const files = event.clipboardData?.files
      if (files && files.length > 0) {
        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
        if (imageFile) {
          event.preventDefault()
          const fileName = imageFile.name || 'image.png'
          const placeholderMarkdown = `![image](./${fileName})`
          const occurrenceIndex = countOccurrencesBefore(
            view.state.doc.toString(),
            placeholderMarkdown,
            view.state.selection.main.from,
          )
          insertTextAtCursor(view, placeholderMarkdown)

          // Fire a custom event so the desktop layer can copy the file
          view.dom.dispatchEvent(
            new CustomEvent('mf-image-paste', {
              detail: {
                file: imageFile,
                markdownText: placeholderMarkdown,
                occurrenceIndex,
              },
              bubbles: true,
              composed: true,
            }),
          )
          return true
        }
      }

      // Handle HTML paste (MF-026)
      if (hasClipboardType(event, 'text/html')) {
        const html = event.clipboardData?.getData('text/html') ?? ''
        if (html) {
          event.preventDefault()
          const markdown = htmlToMarkdown(html)
          insertTextAtCursor(view, markdown)
          return true
        }
      }

      // Fall through to default paste behavior
      return false
    },
  })
}
