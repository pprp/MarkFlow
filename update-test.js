const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const newTest = `
  it('renders split view correctly and syncs changes from source to preview', () => {
    const { container, rerender } = render(
      <MarkFlowEditor content="Hello" viewMode="split" onChange={vi.fn()} />,
    )

    const editors = container.querySelectorAll('.cm-editor')
    expect(editors).toHaveLength(2)

    const sourceView = EditorView.findFromDOM(editors[0] as HTMLElement)
    const previewView = EditorView.findFromDOM(editors[1] as HTMLElement)

    expect(sourceView).not.toBeNull()
    expect(previewView).not.toBeNull()

    expect(sourceView!.state.doc.toString()).toBe('Hello')
    expect(previewView!.state.doc.toString()).toBe('Hello')

    // Modify source and check if preview updates
    sourceView!.dispatch({
      changes: { from: 5, insert: ' world' }
    })
    
    // After dispatch, onChange is typically called. The parent component usually rerenders.
    // In this component test, we simulate the parent rerender with the new content
    rerender(<MarkFlowEditor content="Hello world" viewMode="split" onChange={vi.fn()} />)

    expect(previewView!.state.doc.toString()).toBe('Hello world')
  })
})
`;

content = content.replace(/}\)\n$/, newTest);
fs.writeFileSync(filePath, content, 'utf8');
