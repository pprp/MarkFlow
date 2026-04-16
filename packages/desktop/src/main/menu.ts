import type { MenuItemConstructorOptions } from 'electron'
import type { MarkFlowMenuAction } from '@markflow/shared'

interface ApplicationMenuOptions {
  canRevealCurrentFile: () => boolean
  revealCurrentFileInFolder: () => boolean
  sendMenuAction: (action: MarkFlowMenuAction) => void
  toggleFullscreen: () => void
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
  toggleFullscreen,
  platform = process.platform,
}: ApplicationMenuOptions): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-file') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open-file') },
        { type: 'separator' },
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
        {
          label: 'Export',
          submenu: [
            { label: 'HTML…', click: () => sendMenuAction('export-html') },
            { label: 'PDF…', click: () => sendMenuAction('export-pdf') },
            { label: 'Word (DOCX)…', click: () => sendMenuAction('export-docx') },
            { label: 'EPUB…', click: () => sendMenuAction('export-epub') },
            { label: 'LaTeX…', click: () => sendMenuAction('export-latex') },
          ],
        },
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
        {
          label: 'Find in Files…',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => sendMenuAction('global-search'),
        },
      ],
    },
    {
      label: 'Format',
      submenu: [
        { label: 'Bold', accelerator: 'CmdOrCtrl+B', click: () => sendMenuAction('format-bold') },
        { label: 'Italic', accelerator: 'CmdOrCtrl+I', click: () => sendMenuAction('format-italic') },
        {
          label: 'Strikethrough',
          accelerator: 'CmdOrCtrl+Shift+X',
          click: () => sendMenuAction('format-strikethrough'),
        },
        { label: 'Inline Code', accelerator: 'CmdOrCtrl+E', click: () => sendMenuAction('format-code') },
        { type: 'separator' },
        { label: 'Heading 1', accelerator: 'CmdOrCtrl+1', click: () => sendMenuAction('format-heading-1') },
        { label: 'Heading 2', accelerator: 'CmdOrCtrl+2', click: () => sendMenuAction('format-heading-2') },
        { label: 'Heading 3', accelerator: 'CmdOrCtrl+3', click: () => sendMenuAction('format-heading-3') },
        { type: 'separator' },
        { label: 'Insert Link', accelerator: 'CmdOrCtrl+K', click: () => sendMenuAction('format-link') },
        { type: 'separator' },
        { label: 'Clear Formatting', accelerator: 'CmdOrCtrl+\\', click: () => sendMenuAction('clear-formatting') },
      ],
    },
    {
      label: 'Insert',
      submenu: [
        { label: 'Image…', click: () => sendMenuAction('insert-image') },
        { label: 'Table', click: () => sendMenuAction('insert-table') },
        { label: 'Horizontal Rule', click: () => sendMenuAction('insert-hr') },
        { type: 'separator' },
        { label: 'Code Block', click: () => sendMenuAction('insert-code-block') },
        { label: 'Math Block', click: () => sendMenuAction('insert-math') },
        { label: 'Blockquote', click: () => sendMenuAction('insert-blockquote') },
        { label: 'Task List', click: () => sendMenuAction('insert-task-list') },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette…',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => sendMenuAction('command-palette'),
        },
        {
          label: 'Quick Open…',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendMenuAction('quick-open'),
        },
        { type: 'separator' },
        { label: 'Toggle Sidebar', accelerator: 'Alt+CmdOrCtrl+S', click: () => sendMenuAction('toggle-sidebar') },
        { label: 'Toggle Outline', click: () => sendMenuAction('toggle-outline') },
        { label: 'Toggle Minimap', click: () => sendMenuAction('toggle-minimap') },
        { type: 'separator' },
        { label: 'Distraction Free Mode', click: () => sendMenuAction('toggle-distraction-free') },
        { label: 'Focus Mode', click: () => sendMenuAction('toggle-focus-mode') },
        { label: 'Typewriter Mode', click: () => sendMenuAction('toggle-typewriter-mode') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: isMac ? 'Ctrl+Command+F' : 'F11',
          click: () => toggleFullscreen(),
        },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Go to Line…', accelerator: 'CmdOrCtrl+G', click: () => sendMenuAction('go-to-line') },
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'CmdOrCtrl+Shift+]', click: () => sendMenuAction('next-tab') },
        { label: 'Previous Tab', accelerator: 'CmdOrCtrl+Shift+[', click: () => sendMenuAction('previous-tab') },
      ],
    },
  ]

  if (isMac) {
    template.push({ role: 'windowMenu' })
  }

  template.push({
    label: 'Develop',
    submenu: [
      { role: 'reload' },
      { role: 'toggleDevTools' },
    ],
  })

  return template
}
