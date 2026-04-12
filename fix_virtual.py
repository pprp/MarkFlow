import os
import glob
import re

def process_file(path):
    with open(path, 'r') as f:
        content = f.read()

    # 1. Add minFrom / maxTo
    # We want to add it right after "const builder = new RangeSetBuilder<Decoration>()"
    # or "const doc = view.state.doc"
    if 'const minFrom =' not in content:
        if 'const doc = view.state.doc' in content:
            content = content.replace(
                'const doc = view.state.doc',
                'const doc = view.state.doc\n  const minFrom = view.visibleRanges.length ? view.visibleRanges[0].from : 0\n  const maxTo = view.visibleRanges.length ? view.visibleRanges[view.visibleRanges.length - 1].to : doc.length'
            )
        elif 'const doc = state.doc' in content:
            content = content.replace(
                'const doc = state.doc',
                'const doc = state.doc\n  const minFrom = view.visibleRanges.length ? view.visibleRanges[0].from : 0\n  const maxTo = view.visibleRanges.length ? view.visibleRanges[view.visibleRanges.length - 1].to : doc.length'
            )

    # 2. Add from/to to syntaxTree iterate
    content = re.sub(
        r'syntaxTree\((view\.state|state)\)\.iterate\(\{\s*enter\(node\)',
        r'syntaxTree(\1).iterate({\n    from: minFrom,\n    to: maxTo,\n    enter(node)',
        content
    )

    # 3. Replace document line loops
    content = re.sub(
        r'for\s*\(\s*let\s+lineNumber\s*=\s*1\s*;\s*lineNumber\s*<=\s*doc\.lines\s*;\s*lineNumber\+\+\s*\)',
        r'const startLine = doc.lineAt(minFrom).number\n  const endLine = doc.lineAt(maxTo).number\n  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++)',
        content
    )

    # 4. Handle getCodeRanges in inlineDecorations.ts
    if 'function getCodeRanges(view: EditorView)' in content:
        content = content.replace('function getCodeRanges(view: EditorView)', 'function getCodeRanges(view: EditorView, from: number, to: number)')
        content = content.replace(
            'syntaxTree(view.state).iterate({\n    enter(node)',
            'syntaxTree(view.state).iterate({\n    from,\n    to,\n    enter(node)'
        )
        content = content.replace('getCodeRanges(view)', 'getCodeRanges(view, minFrom, maxTo)')

    with open(path, 'w') as f:
        f.write(content)

for path in glob.glob('packages/editor/src/editor/decorations/*.ts*'):
    process_file(path)

print("Done")
