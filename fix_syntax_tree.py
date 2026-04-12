import glob
import re

def fix(path):
    with open(path, 'r') as f:
        content = f.read()

    # For functions other than getCodeRanges, we want from: minFrom, to: maxTo
    # We'll just replace all `from,\n    to,` inside `syntaxTree(view.state).iterate` 
    # to `from: minFrom,\n    to: maxTo,` EXCEPT if they are inside `getCodeRanges`
    # Or simpler:
    
    # We know the bug is `from,\n    to,\n    enter(node)` outside of `getCodeRanges`.
    # Actually, we can just replace ALL `from,\n    to,\n    enter` with `from: minFrom,\n    to: maxTo,\n    enter`.
    # AND THEN explicitly fix `getCodeRanges` again, but this time only the first occurrence or just using regex properly.
    
    # Replace all:
    content = re.sub(
        r'from,\s*to,\s*enter\(node\)',
        r'from: minFrom,\n    to: maxTo,\n    enter(node)',
        content
    )
    
    # Then fix getCodeRanges specifically:
    content = re.sub(
        r'(function getCodeRanges.*?syntaxTree\(.*?\)\.iterate\(\{.*?)\bfrom: minFrom,(.*?)to: maxTo,',
        r'\1from,\2to,',
        content,
        flags=re.DOTALL
    )

    with open(path, 'w') as f:
        f.write(content)

for p in glob.glob('packages/editor/src/editor/decorations/*.ts*'):
    fix(p)

print("Done")
