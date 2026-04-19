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

export const INITIAL_CONTENT = `# MarkFlow

*Write in flow, publish anywhere.*

> A warmer markdown workspace for academics, engineers, and technical writers who think in structure.

[See the editorial brief](https://example.com) for the design tone behind this starter bundle.

## The Bundle

MarkFlow now revolves around three surfaces working together:

1. **The bundle rail** keeps files, recent places, and outline in one editorial column.
2. **Overlay screens** let you jump, search, and command without breaking writing rhythm.
3. **The document canvas** stays focused on the page instead of the markdown syntax.

## Start Here

- Open a folder to turn this starter note into a living workspace.
- Use the left rail to move between files, recent drafts, and section structure.
- Press \`Cmd/Ctrl+Shift+P\` for the command palette, or \`Cmd/Ctrl+Shift+O\` for Quick Open.

## Publish-Ready Markdown

You can still write plain markdown, but MarkFlow presents it with a more editorial voice:

- **Bold**, *italic*, and \`inline code\` render inline
- [Links](https://example.com) behave like real reading surfaces
- Tables, math, diagrams, and callouts stay part of the same flow

### A Small Code Block

\`\`\`typescript
function publish(bundle: string): string {
  return \`Ship \${bundle} without losing the draft.\`
}
\`\`\`

### A Pull Quote

> Good writing software disappears until structure matters.

## Proof Surface

Inline math: $E = mc^2$ and $\\pi \\approx 3.14159$.

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

\`\`\`mermaid
graph TD
  A[Draft in flow] --> B[Shape the structure]
  B --> C[Review in context]
  C --> D[Publish anywhere]
\`\`\`

| Surface | Role | Feel |
|---------|------|------|
| Bundle rail | Navigate context | Warm + compact |
| Overlay screens | Jump fast | Glassy + intentional |
| Editor canvas | Stay with the prose | Quiet + readable |

## Next Moves

- Open a real folder
- Rename this starter note
- Try headings, tables, and a few longer sections
- Export when the draft feels finished

Happy writing.
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
