import re

path = 'packages/editor/src/editor/decorations/footnoteDecoration.ts'
with open(path, 'r') as f:
    content = f.read()

# Fix getBlockCodeRanges signature
content = content.replace('function getBlockCodeRanges(view: EditorView)', 'function getBlockCodeRanges(view: EditorView, minFrom: number, maxTo: number)')

# Fix call site
content = content.replace('getBlockCodeRanges(view)', 'getBlockCodeRanges(view, minFrom, maxTo)')

with open(path, 'w') as f:
    f.write(content)
