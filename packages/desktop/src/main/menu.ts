import * as path from 'path'
import type { MenuItemConstructorOptions } from 'electron'
import type {
  MarkFlowLaunchBehavior,
  MarkFlowMenuAction,
  MarkFlowRecentPathKind,
  MarkFlowThemeSummary,
} from '@markflow/shared'

export interface OpenRecentMenuEntry {
  description: string
  kind: MarkFlowRecentPathKind
  label: string
  path: string
}

export interface OpenRecentMenuOptions {
  canClearAll: boolean
  canClearItems: boolean
  pinnableFolders: OpenRecentMenuEntry[]
  pinnedFolders: OpenRecentMenuEntry[]
  recentEntries: OpenRecentMenuEntry[]
  clearAll: () => void
  clearItems: () => void
  openEntry: (entry: OpenRecentMenuEntry) => void
  pinFolder: (folderPath: string) => void
  unpinFolder: (folderPath: string) => void
}

export interface LaunchOptionsMenuOptions {
  behavior: MarkFlowLaunchBehavior
  defaultFolderPath: string | null
  chooseDefaultFolder: () => void
  clearDefaultFolder: () => void
  selectBehavior: (behavior: MarkFlowLaunchBehavior) => void
}

export interface AppearanceMenuOptions {
  activeThemeId: string
  themes: MarkFlowThemeSummary[]
  selectTheme: (themeId: string) => void
}

interface ApplicationMenuOptions {
  appearanceMenu: AppearanceMenuOptions | null
  canRevealCurrentFile: () => boolean
  installCliTool: () => void
  isAlwaysOnTop: boolean
  isCliToolInstalled: () => boolean
  launchOptions: LaunchOptionsMenuOptions
  openRecent: OpenRecentMenuOptions
  revealCurrentFileInFolder: () => boolean
  sendMenuAction: (action: MarkFlowMenuAction) => void
  toggleAlwaysOnTop: () => void
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

function buildOpenRecentItem(
  entry: OpenRecentMenuEntry,
  openRecent: OpenRecentMenuOptions,
): MenuItemConstructorOptions {
  return {
    label: entry.label,
    sublabel: entry.description,
    click: () => openRecent.openEntry(entry),
  }
}

function buildFolderActionSubmenu(
  label: string,
  folders: OpenRecentMenuEntry[],
  onClick: (folderPath: string) => void,
  emptyLabel: string,
): MenuItemConstructorOptions {
  return {
    label,
    submenu:
      folders.length > 0
        ? folders.map((folder) => ({
            label: folder.label,
            sublabel: folder.description,
            click: () => onClick(folder.path),
          }))
        : [{ label: emptyLabel, enabled: false }],
  }
}

function buildOpenRecentSubmenu(openRecent: OpenRecentMenuOptions): MenuItemConstructorOptions[] {
  const submenu: MenuItemConstructorOptions[] = []

  if (openRecent.pinnedFolders.length > 0) {
    submenu.push({ label: 'Pinned Folders', enabled: false })
    submenu.push(...openRecent.pinnedFolders.map((entry) => buildOpenRecentItem(entry, openRecent)))
  }

  if (openRecent.recentEntries.length > 0) {
    if (submenu.length > 0) {
      submenu.push({ type: 'separator' })
    }
    submenu.push({ label: 'Recent Files and Folders', enabled: false })
    submenu.push(...openRecent.recentEntries.map((entry) => buildOpenRecentItem(entry, openRecent)))
  }

  if (submenu.length === 0) {
    submenu.push({ label: 'No Recent Files or Folders', enabled: false })
  }

  submenu.push({ type: 'separator' })
  submenu.push(
    buildFolderActionSubmenu('Pin Folder', openRecent.pinnableFolders, openRecent.pinFolder, 'No Recent Folders'),
  )
  submenu.push(
    buildFolderActionSubmenu('Unpin Folder', openRecent.pinnedFolders, openRecent.unpinFolder, 'No Pinned Folders'),
  )
  submenu.push({ type: 'separator' })
  submenu.push({
    label: 'Clear Items',
    enabled: openRecent.canClearItems,
    click: () => openRecent.clearItems(),
  })
  submenu.push({
    label: 'Clear Recent and Pinned Folders / Files',
    enabled: openRecent.canClearAll,
    click: () => openRecent.clearAll(),
  })

  return submenu
}

function buildLaunchOptionsSubmenu(launchOptions: LaunchOptionsMenuOptions): MenuItemConstructorOptions[] {
  const defaultFolderLabel = launchOptions.defaultFolderPath
    ? `Open Default Folder (${path.basename(launchOptions.defaultFolderPath) || launchOptions.defaultFolderPath})`
    : 'Open Default Folder'

  return [
    {
      label: 'Open New File',
      type: 'radio',
      checked: launchOptions.behavior === 'open-new-file',
      click: () => launchOptions.selectBehavior('open-new-file'),
    },
    {
      label: 'Restore Last Folder',
      type: 'radio',
      checked: launchOptions.behavior === 'restore-last-folder',
      click: () => launchOptions.selectBehavior('restore-last-folder'),
    },
    {
      label: 'Restore Last File and Folder',
      type: 'radio',
      checked: launchOptions.behavior === 'restore-last-file-and-folder',
      click: () => launchOptions.selectBehavior('restore-last-file-and-folder'),
    },
    { type: 'separator' },
    {
      label: defaultFolderLabel,
      type: 'radio',
      enabled: launchOptions.defaultFolderPath !== null,
      checked: launchOptions.behavior === 'open-default-folder',
      click: () => launchOptions.selectBehavior('open-default-folder'),
    },
    {
      label: 'Choose Default Folder…',
      click: () => launchOptions.chooseDefaultFolder(),
    },
    {
      label: 'Clear Default Folder',
      enabled: launchOptions.defaultFolderPath !== null,
      click: () => launchOptions.clearDefaultFolder(),
    },
  ]
}

function buildAppearanceSubmenu(appearanceMenu: AppearanceMenuOptions): MenuItemConstructorOptions[] {
  return appearanceMenu.themes.length > 0
    ? appearanceMenu.themes.map((theme) => ({
        label: theme.name,
        type: 'radio',
        checked: theme.id === appearanceMenu.activeThemeId,
        click: () => appearanceMenu.selectTheme(theme.id),
      }))
    : [{ label: 'No Themes Available', enabled: false }]
}

export function createApplicationMenuTemplate({
  appearanceMenu,
  canRevealCurrentFile,
  installCliTool,
  isAlwaysOnTop,
  isCliToolInstalled,
  launchOptions,
  openRecent,
  revealCurrentFileInFolder,
  sendMenuAction,
  toggleAlwaysOnTop,
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
        { label: 'Open Recent', submenu: buildOpenRecentSubmenu(openRecent) },
        { label: 'Launch Options', submenu: buildLaunchOptionsSubmenu(launchOptions) },
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
            { label: 'Export with Previous', click: () => sendMenuAction('export-with-previous') },
            {
              label: 'Export and Overwrite with Previous',
              click: () => sendMenuAction('export-overwrite-with-previous'),
            },
            { type: 'separator' },
            { label: 'HTML…', click: () => sendMenuAction('export-html') },
            { label: 'HTML (without styles)...', click: () => sendMenuAction('export-html-without-styles') },
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
        { label: 'Copy as Plain Text', click: () => sendMenuAction('copy-as-plain-text') },
        { label: 'Copy as Markdown', click: () => sendMenuAction('copy-as-markdown') },
        { label: 'Copy as HTML Code', click: () => sendMenuAction('copy-as-html-code') },
        { type: 'separator' },
        { role: 'paste' },
        { label: 'Paste as Plain Text', accelerator: 'CmdOrCtrl+Shift+V', role: 'pasteAndMatchStyle' },
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
        ...(appearanceMenu
          ? [{ label: 'Appearance', submenu: buildAppearanceSubmenu(appearanceMenu) } satisfies MenuItemConstructorOptions]
          : []),
        ...(appearanceMenu ? [{ type: 'separator' } satisfies MenuItemConstructorOptions] : []),
        { label: 'Toggle Sidebar', accelerator: 'Alt+CmdOrCtrl+S', click: () => sendMenuAction('toggle-sidebar') },
        { label: 'Toggle Outline', click: () => sendMenuAction('toggle-outline') },
        { label: 'Toggle Minimap', click: () => sendMenuAction('toggle-minimap') },
        { type: 'separator' },
        { label: 'Distraction Free Mode', click: () => sendMenuAction('toggle-distraction-free') },
        { label: 'Focus Mode', click: () => sendMenuAction('toggle-focus-mode') },
        { label: 'Typewriter Mode', click: () => sendMenuAction('toggle-typewriter-mode') },
        { label: 'Document Statistics', click: () => sendMenuAction('toggle-document-statistics') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: isAlwaysOnTop,
          click: () => toggleAlwaysOnTop(),
        },
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
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => sendMenuAction('navigate-back') },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => sendMenuAction('navigate-forward') },
        { type: 'separator' },
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

  if (isMac) {
    template.push({
      label: 'Help',
      submenu: [
        {
          label: isCliToolInstalled()
            ? "Reinstall 'markflow' Command in PATH"
            : "Install 'markflow' Command in PATH",
          click: () => installCliTool(),
        },
      ],
    })
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
