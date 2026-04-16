import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { detectFrontMatter } from '../decorations/yamlFrontMatter'

export interface SpellCheckExtensionOptions {
  language?: string | null
}

/**
 * Builds a decoration set that marks code/link regions with spellcheck=false
 * so the browser skips spell checking inside code and links.
 */
function buildSpellCheckExclusions(view: EditorView): DecorationSet {
  // Collect all ranges that should be excluded
  const exclusionRanges: { from: number; to: number }[] = []

  // Add Front Matter exclusion
  const fmRange = detectFrontMatter(view.state.doc)
  if (fmRange) {
    const from = view.state.doc.line(fmRange.firstLine).from
    const to = view.state.doc.line(fmRange.lastLine).to
    exclusionRanges.push({ from, to })
  }

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const name = node.type.name
        if (
          name === 'InlineCode' ||
          name === 'FencedCode' ||
          name === 'CodeBlock' ||
          name === 'Link' ||
          name === 'URL'
        ) {
          exclusionRanges.push({ from: node.from, to: node.to })
        }
      },
    })
  }

  // Sort ranges and add to builder
  exclusionRanges.sort((a, b) => a.from - b.from)

  const builder = new RangeSetBuilder<Decoration>()
  const noSpellCheck = Decoration.mark({ attributes: { spellcheck: 'false' } })
  
  let currentPos = -1
  for (const { from, to } of exclusionRanges) {
    if (from < currentPos) continue // Skip overlapping
    if (to > from) {
      builder.add(from, to, noSpellCheck)
      currentPos = to
    }
  }

  return builder.finish()
}

export const spellCheckExclusionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildSpellCheckExclusions(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildSpellCheckExclusions(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

/**
 * Spell check extension: enables browser native spell checking on the editor
 * but excludes code blocks, inline code, and links from spell checking.
 */
export function spellCheckExtension(options: SpellCheckExtensionOptions = {}) {
  const contentAttributes: Record<string, string> = { spellcheck: 'true' }

  if (options.language) {
    contentAttributes.lang = options.language
  }

  return [
    EditorView.contentAttributes.of(contentAttributes),
    spellCheckExclusionPlugin,
  ]
}
