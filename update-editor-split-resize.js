const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/MarkFlowEditor.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const importReplacement = `import { useRef, useEffect, useState, useCallback } from 'react'`;
content = content.replace(/import { useRef, useEffect, useState } from 'react'/, importReplacement);

const newRenderMethod = `  const [splitRatio, setSplitRatio] = useState(0.5)
  const isDraggingRef = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !splitContainerRef.current) return
    const rect = splitContainerRef.current.getBoundingClientRect()
    let newRatio = (e.clientX - rect.left) / rect.width
    // Keep it reasonable (between 10% and 90%)
    if (newRatio < 0.1) newRatio = 0.1
    if (newRatio > 0.9) newRatio = 0.9
    setSplitRatio(newRatio)
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  if (viewMode === 'split') {
    return (
      <div className="mf-split-container" ref={splitContainerRef}>
        <div className="mf-split-pane" style={{ flex: splitRatio }}>
          <div ref={containerRef} className="mf-editor-container" style={{ height: '100%' }} />
          <FloatingToolbar view={editorView} />
        </div>
        <div 
          className="mf-split-divider" 
          aria-hidden="true" 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div className="mf-split-pane" style={{ flex: 1 - splitRatio }}>
          <div ref={previewContainerRef} className="mf-editor-container" style={{ height: '100%' }} />
        </div>
      </div>
    )
  }`;

const splitViewRegex = /  if \(viewMode === 'split'\) \{[\s\S]*?    \)/;
content = content.replace(splitViewRegex, newRenderMethod);

fs.writeFileSync(filePath, content, 'utf8');
