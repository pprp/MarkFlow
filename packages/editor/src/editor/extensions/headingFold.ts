import { foldGutter, foldService, foldKeymap } from '@codemirror/language'
import { keymap } from '@codemirror/view'

const HEADING_RE = /^(#{1,6})\s/

export function headingFoldExtension() {
  return [
    foldGutter(),
    foldService.of((state, lineStart, _lineEnd) => {
      const line = state.doc.lineAt(lineStart)
      const match = HEADING_RE.exec(line.text)
      if (!match) return null

      const level = match[1].length
      let endPos = line.to

      for (let i = line.number + 1; i <= state.doc.lines; i++) {
        const nextLine = state.doc.line(i)
        const nextMatch = HEADING_RE.exec(nextLine.text)
        if (nextMatch && nextMatch[1].length <= level) {
          // Stop before this heading line
          endPos = state.doc.line(i - 1).to
          break
        }
        endPos = nextLine.to
      }

      if (endPos <= line.to) return null

      return { from: line.to, to: endPos }
    }),
    keymap.of(foldKeymap),
  ]
}
