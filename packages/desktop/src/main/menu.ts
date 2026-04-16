import type { MenuItemConstructorOptions } from 'electron'
import type { MarkFlowMenuAction } from '@markflow/shared'

interface ApplicationMenuOptions {
  canRevealCurrentFile: () => boolean
  revealCurrentFileInFolder: () => boolean
  sendMenuAction: (action: MarkFlowMenuAction) => void
  platform?: NodeJS.Platform
}

function getRevealCurrentFileLabel(platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    return 'Reveal in Finder'
  }

  if (platform === 'win32') {
    return 'Show in File Explorer'
  }

  return 'Show in Folder'
}

export function createApplicationMenuTemplate({
  canRevealCurrentFile,
  revealCurrentFileInFolder,
  sendMenuAction,
  platform = process.platform,
}: ApplicationMenuOptions): MenuItemConstructorOptions[] {
  return [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-file') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open-file') },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => sendMenuAction('close-tab') },
        {
          label: 'Reopen Closed Tab',
          accelerator: 'Shift+CmdOrCtrl+T',
          click: () => sendMenuAction('reopen-closed-tab'),
        },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save-file') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('save-file-as') },
        {
          label: getRevealCurrentFileLabel(platform),
          enabled: canRevealCurrentFile(),
          click: () => {
            revealCurrentFileInFolder()
          },
        },
        { type: 'separator' },
        { label: 'Export as HTML…', click: () => sendMenuAction('export-html') },
        { label: 'Export as PDF…', click: () => sendMenuAction('export-pdf') },
        { label: 'Export as DOCX…', click: () => sendMenuAction('export-docx') },
        { label: 'Export as EPUB…', click: () => sendMenuAction('export-epub') },
        { label: 'Export as LaTeX…', click: () => sendMenuAction('export-latex') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => sendMenuAction('copy') },
        { label: 'Copy as Markdown', click: () => sendMenuAction('copy-as-markdown') },
        { label: 'Copy as HTML Code', click: () => sendMenuAction('copy-as-html-code') },
        { type: 'separator' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Clear Formatting', accelerator: 'CmdOrCtrl+\\', click: () => sendMenuAction('clear-formatting') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Toggle Minimap', click: () => sendMenuAction('toggle-minimap') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Next Tab', click: () => sendMenuAction('next-tab') },
        { label: 'Previous Tab', click: () => sendMenuAction('previous-tab') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]
}
