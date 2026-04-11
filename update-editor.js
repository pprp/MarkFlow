const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/MarkFlowEditor.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the Split View effect
const splitViewPattern = /  \/\/ Split view: create\/destroy the preview pane[\s\S]*?  \/\/ Keep split preview in sync with content changes/m;

const newSplitViewLogic = `  // Split view: create/destroy the preview pane
  useEffect(() => {
    if (viewMode !== 'split') {
      // Destroy preview pane when leaving split mode
      if (previewViewRef.current) {
        previewViewRef.current.destroy()
        previewViewRef.current = null
      }
      return
    }

    if (!previewContainerRef.current) return

    const previewState = EditorState.create({
      doc: content,
      extensions: [
        baseTheme,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.editable.of(false),
        EditorView.lineWrapping,
        ...getWysiwygExtensions(filePath),
      ],
    })

    const previewView = new EditorView({
      state: previewState,
      parent: previewContainerRef.current,
    })

    previewViewRef.current = previewView

    // Synchronize scroll position between source and preview
    const sourceView = viewRef.current
    if (sourceView) {
      let isSyncingLeft = false
      let isSyncingRight = false

      const handleSourceScroll = () => {
        if (!previewViewRef.current || isSyncingLeft) return
        isSyncingRight = true
        
        const sourceScroll = sourceView.scrollDOM
        const previewScroll = previewViewRef.current.scrollDOM
        
        const sourceRange = sourceScroll.scrollHeight - sourceScroll.clientHeight
        const previewRange = previewScroll.scrollHeight - previewScroll.clientHeight
        
        if (sourceRange > 0 && previewRange > 0) {
          const percentage = sourceScroll.scrollTop / sourceRange
          previewScroll.scrollTop = percentage * previewRange
        }
        
        // Reset flag after a short delay to allow the scroll event to fire and be ignored
        requestAnimationFrame(() => {
          isSyncingRight = false
        })
      }

      const handlePreviewScroll = () => {
        if (!viewRef.current || isSyncingRight) return
        isSyncingLeft = true
        
        const sourceScroll = viewRef.current.scrollDOM
        const previewScroll = previewView.scrollDOM
        
        const sourceRange = sourceScroll.scrollHeight - sourceScroll.clientHeight
        const previewRange = previewScroll.scrollHeight - previewScroll.clientHeight
        
        if (sourceRange > 0 && previewRange > 0) {
          const percentage = previewScroll.scrollTop / previewRange
          sourceScroll.scrollTop = percentage * sourceRange
        }
        
        requestAnimationFrame(() => {
          isSyncingLeft = false
        })
      }

      sourceView.scrollDOM.addEventListener('scroll', handleSourceScroll)
      previewView.scrollDOM.addEventListener('scroll', handlePreviewScroll)

      // Initial sync
      handleSourceScroll()

      return () => {
        sourceView.scrollDOM.removeEventListener('scroll', handleSourceScroll)
        previewView.scrollDOM.removeEventListener('scroll', handlePreviewScroll)
        previewView.destroy()
        previewViewRef.current = null
      }
    }

    return () => {
      previewView.destroy()
      previewViewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  // Keep split preview in sync with content changes`;

content = content.replace(splitViewPattern, newSplitViewLogic);
fs.writeFileSync(filePath, content, 'utf8');
