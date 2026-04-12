import glob

def fix(path):
    with open(path, 'r') as f:
        content = f.read()

    # 1. In getCodeRanges, minFrom/maxTo -> from/to
    # The function signature is `function getCodeRanges(view: EditorView, from: number, to: number)`
    # The syntaxTree call is:
    # syntaxTree(view.state).iterate({
    #     from: minFrom,
    #     to: maxTo,
    
    parts = content.split('function getCodeRanges(')
    if len(parts) > 1:
        # replace minFrom -> from and maxTo -> to ONLY inside getCodeRanges
        # To do this safely, we can just replace 'from: minFrom,' with 'from,' and 'to: maxTo,' with 'to,' 
        # in the chunk containing getCodeRanges up to the next top-level function or end of file.
        
        # But maybe easier: 
        chunk = parts[1]
        
        chunk = chunk.replace('from: minFrom,', 'from,')
        chunk = chunk.replace('to: maxTo,', 'to,')
        
        content = parts[0] + 'function getCodeRanges(' + chunk

    # 2. Make sure it's called with minFrom, maxTo everywhere
    content = content.replace('getCodeRanges(view)', 'getCodeRanges(view, minFrom, maxTo)')
    content = content.replace('getCodeRanges(view, minFrom, maxTo, minFrom, maxTo)', 'getCodeRanges(view, minFrom, maxTo)') # in case I double replaced

    with open(path, 'w') as f:
        f.write(content)

for p in glob.glob('packages/editor/src/editor/decorations/*.ts*'):
    fix(p)

print("Done")
