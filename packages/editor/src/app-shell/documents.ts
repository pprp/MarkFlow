import type {
  MarkFlowDesktopAPI,
  MarkFlowDocument,
  MarkFlowFileLoadProgressPayload,
  MarkFlowFilePayload,
  MarkFlowLargeFileWindow,
  MarkFlowWindowSessionState,
} from '@markflow/shared'
import type { MarkFlowEditorSnapshot } from '../editor/MarkFlowEditor'
import { createEmptySymbolTable, type SymbolTable } from '../editor/indexer'
import type { NavigationLocation } from '../editor/navigationHistory'

export const INITIAL_CONTENT = `# Welcome to MarkFlow

*Write in flow, publish anywhere.*

## Features

- **WYSIWYG editing** — markdown syntax hides when you move your cursor away
- *Italic*, **bold**, and \`inline code\` rendered inline
- [Links](https://example.com) displayed as clickable text

## Getting Started

Start typing here! Try writing some markdown and watch it render in real time.

### Code Example

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

### A Quote

> The best way to predict the future is to invent it.
> — Alan Kay

### Task List

- [x] Set up CodeMirror 6
- [x] Implement inline decorations
- [ ] Add export support
- [x] Build plugin system

---

## Math — KaTeX

Inline math: $E = mc^2$ and $\\pi \\approx 3.14159$.

Display math:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Mermaid Diagram

\`\`\`mermaid
graph TD
  A[Start] --> B{Is it working?}
  B -->|Yes| C[Great!]
  B -->|No| D[Debug]
  D --> B
\`\`\`

## Table

| Feature   | Status  | Priority |
|-----------|---------|----------|
| Math      | ✅ Done  | High     |
| Mermaid   | ✅ Done  | High     |
| Tables    | ✅ Done  | Medium   |
| Export    | Partial | Low      |

## Image

![MarkFlow placeholder](https://via.placeholder.com/400x120?text=MarkFlow+Image+Test)

## Footnote

This has a footnote[^1] and another[^2].

[^1]: First footnote — rendered correctly.
[^2]: Second footnote — also rendered.

---

Happy writing!
`

let tabIdCounter = 0
let untitledTabCounter = 0

export interface DocumentTabState extends MarkFlowDocument {
  id: string
  recoveryTabId: string | null
  largeFile: MarkFlowLargeFileWindow | null
  persistedContent: string
  collapsedRanges: number[]
  cursorPosition: number
  viewportPosition: number | null
  selectionText: string
  symbolTable: SymbolTable
  snapshot: MarkFlowEditorSnapshot | null
  untitledLabel: string
}

export interface ClosedDocumentTabState {
  closedIndex: number
  tab: DocumentTabState
}

export interface AppStartupState {
  document: MarkFlowFilePayload | null
  folderPath: string | null
  windowSession: {
    documents: MarkFlowFilePayload[]
    activeFilePath: string | null
  } | null
}

export type MarkFlowStartupAPI = MarkFlowDesktopAPI & {
  getStartupState: () => Promise<AppStartupState>
}

export type PendingNavigationTarget = NavigationLocation & {
  preserveScroll?: boolean
}

function createTabId() {
  tabIdCounter += 1
  return `tab-${tabIdCounter}`
}

function createUntitledLabel(content: string) {
  if (content === INITIAL_CONTENT) {
    return 'Starter Document'
  }

  untitledTabCounter += 1
  return untitledTabCounter === 1 ? 'Untitled' : `Untitled ${untitledTabCounter}`
}

export function getLineNumberAtPosition(content: string, position: number) {
  const boundedPosition = Math.max(0, Math.min(position, content.length))
  let lineNumber = 1

  for (let index = 0; index < boundedPosition; index += 1) {
    if (content.charCodeAt(index) === 10) {
      lineNumber += 1
    }
  }

  return lineNumber
}

export function createDocumentTab(
  filePath: string | null,
  content: string,
  largeFile: MarkFlowLargeFileWindow | null = null,
): DocumentTabState {
  return {
    id: createTabId(),
    recoveryTabId: null,
    largeFile,
    filePath,
    content,
    persistedContent: content,
    isDirty: false,
    collapsedRanges: [],
    cursorPosition: 0,
    viewportPosition: null,
    selectionText: '',
    symbolTable: createEmptySymbolTable(),
    snapshot: null,
    untitledLabel: createUntitledLabel(content),
  }
}

export function getTotalLinesForTab(tab: DocumentTabState | null) {
  if (!tab) {
    return 1
  }

  return tab.largeFile?.totalLines ?? (tab.content.length ? tab.content.split('\n').length : 1)
}

export function getCurrentLineNumberForTab(tab: DocumentTabState | null) {
  if (!tab) {
    return 1
  }

  const localLineNumber = getLineNumberAtPosition(tab.content, tab.cursorPosition)
  if (!tab.largeFile) {
    return localLineNumber
  }

  return Math.min(tab.largeFile.totalLines, tab.largeFile.windowStartLine + localLineNumber - 1)
}

export function getTabLabel(
  tab: DocumentTabState,
  loadingFile: MarkFlowFileLoadProgressPayload | null = null,
) {
  if (tab.filePath) {
    return tab.filePath.split(/[\\/]/).at(-1) ?? tab.filePath
  }

  if (loadingFile?.filePath) {
    return loadingFile.filePath.split(/[\\/]/).at(-1) ?? loadingFile.filePath
  }

  return tab.untitledLabel
}

export function findTabIndex(tabs: readonly DocumentTabState[], tabId: string | null) {
  return tabs.findIndex((tab) => tab.id === tabId)
}

export function buildWindowSessionState(
  tabs: readonly DocumentTabState[],
  activeTabId: string | null,
): MarkFlowWindowSessionState {
  const filePaths = tabs.flatMap((tab) => (tab.filePath ? [tab.filePath] : []))
  const activeFilePath = tabs.find((tab) => tab.id === activeTabId)?.filePath ?? null
  return {
    filePaths,
    activeFilePath,
  }
}
