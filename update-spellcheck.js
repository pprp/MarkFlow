const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/extensions/spellCheck.ts');
let content = fs.readFileSync(filePath, 'utf8');

const importReplacement = `import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { detectFrontMatter } from '../decorations/yamlFrontMatter'`;

content = content.replace(/import \{ EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet \} from '@codemirror\/view'\nimport \{ RangeSetBuilder \} from '@codemirror\/state'\nimport \{ syntaxTree \} from '@codemirror\/language'/, importReplacement);

const detectLogic = `function buildSpellCheckExclusions(view: EditorView): DecorationSet {
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
}`;

content = content.replace(/function buildSpellCheckExclusions[\s\S]*?return builder\.finish\(\)\n\}/, detectLogic);

fs.writeFileSync(filePath, content, 'utf8');
