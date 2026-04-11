const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const newTest = `
  it('adjusts layout correctly on pane resize', () => {
    const { container } = render(
      <MarkFlowEditor content="Split" viewMode="split" onChange={vi.fn()} />,
    )

    const divider = container.querySelector('.mf-split-divider')
    expect(divider).not.toBeNull()

    const splitContainer = container.querySelector('.mf-split-container')
    expect(splitContainer).not.toBeNull()
    
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 1000,
      height: 500,
      top: 0,
      left: 0,
      bottom: 500,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: () => {}
    }));

    const panes = container.querySelectorAll('.mf-split-pane')
    expect(panes).toHaveLength(2)

    // Initial state (ratio 0.5)
    expect((panes[0] as HTMLElement).style.flex).toBe('0.5')
    expect((panes[1] as HTMLElement).style.flex).toBe('0.5')

    // Simulate pointer down, move, and up
    fireEvent.pointerDown(divider as Element, { pointerId: 1 })
    fireEvent.pointerMove(divider as Element, { pointerId: 1, clientX: 300 })
    fireEvent.pointerUp(divider as Element, { pointerId: 1 })

    // 300 / 1000 = 0.3
    expect((panes[0] as HTMLElement).style.flex).toBe('0.3')
    expect((panes[1] as HTMLElement).style.flex).toBe('0.7')
    
    // Limits
    fireEvent.pointerDown(divider as Element, { pointerId: 1 })
    fireEvent.pointerMove(divider as Element, { pointerId: 1, clientX: 50 })
    fireEvent.pointerUp(divider as Element, { pointerId: 1 })
    
    // Should cap at 0.1
    expect((panes[0] as HTMLElement).style.flex).toBe('0.1')
    expect((panes[1] as HTMLElement).style.flex).toBe('0.9')
  })
})
`;

content = content.replace(/}\)\n$/, newTest);
fs.writeFileSync(filePath, content, 'utf8');
