import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { createApplicationMenuTemplate } from './menu'

function createOpenRecentOptions() {
  return {
    pinnedFolders: [],
    recentEntries: [],
    pinnableFolders: [],
    canClearItems: false,
    canClearAll: false,
    openEntry: vi.fn(),
    pinFolder: vi.fn(),
    unpinFolder: vi.fn(),
    clearItems: vi.fn(),
    clearAll: vi.fn(),
  }
}

function createMenuTemplate(overrides: Partial<Parameters<typeof createApplicationMenuTemplate>[0]> = {}) {
  return createApplicationMenuTemplate({
    canRevealCurrentFile: () => true,
    isAlwaysOnTop: false,
    openRecent: createOpenRecentOptions(),
    revealCurrentFileInFolder: vi.fn(() => true),
    sendMenuAction: vi.fn(),
    toggleAlwaysOnTop: vi.fn(),
    toggleFullscreen: vi.fn(),
    platform: 'linux',
    ...overrides,
  })
}

function getMenuItem(
  template: MenuItemConstructorOptions[],
  menuLabel: string,
  itemLabel: string,
): MenuItemConstructorOptions | undefined {
  const menu = template.find((item) => item.label === menuLabel)
  const submenu = Array.isArray(menu?.submenu) ? menu.submenu : []
  return submenu.find((item) => item.label === itemLabel)
}

describe('createApplicationMenuTemplate', () => {
  it('disables the reveal item for untitled documents', () => {
    const template = createMenuTemplate({
      canRevealCurrentFile: () => false,
      platform: 'darwin',
      revealCurrentFileInFolder: vi.fn(() => false),
    })

    expect(getMenuItem(template, 'File', 'Reveal in Finder')).toEqual(
      expect.objectContaining({
        enabled: false,
      }),
    )
  })

  it('clicks through to reveal the current saved file', () => {
    const revealCurrentFileInFolder = vi.fn(() => true)
    const template = createMenuTemplate({
      revealCurrentFileInFolder,
    })
    const revealItem = getMenuItem(template, 'File', 'Show in Folder')

    revealItem?.click?.({} as never, {} as never, {} as never)

    expect(revealItem).toEqual(
      expect.objectContaining({
        enabled: true,
      }),
    )
    expect(revealCurrentFileInFolder).toHaveBeenCalledTimes(1)
  })

  it('routes copy actions through explicit renderer menu events', () => {
    const sendMenuAction = vi.fn()
    const template = createMenuTemplate({
      sendMenuAction,
    })
    const copyItem = getMenuItem(template, 'Edit', 'Copy')
    const copyAsMarkdownItem = getMenuItem(template, 'Edit', 'Copy as Markdown')
    const copyAsHtmlCodeItem = getMenuItem(template, 'Edit', 'Copy as HTML Code')

    copyItem?.click?.({} as never, {} as never, {} as never)
    copyAsMarkdownItem?.click?.({} as never, {} as never, {} as never)
    copyAsHtmlCodeItem?.click?.({} as never, {} as never, {} as never)

    expect(sendMenuAction.mock.calls).toEqual([
      ['copy'],
      ['copy-as-markdown'],
      ['copy-as-html-code'],
    ])
  })

  it('exposes close and reopen tab menu actions', () => {
    const sendMenuAction = vi.fn()
    const template = createMenuTemplate({
      sendMenuAction,
    })
    const closeTabItem = getMenuItem(template, 'File', 'Close Tab')
    const reopenClosedTabItem = getMenuItem(template, 'File', 'Reopen Closed Tab')

    closeTabItem?.click?.({} as never, {} as never, {} as never)
    reopenClosedTabItem?.click?.({} as never, {} as never, {} as never)

    expect(sendMenuAction.mock.calls).toContainEqual(['close-tab'])
    expect(sendMenuAction.mock.calls).toContainEqual(['reopen-closed-tab'])
  })

  it('routes the View minimap toggle through the renderer menu bridge', () => {
    const sendMenuAction = vi.fn()
    const template = createMenuTemplate({
      sendMenuAction,
    })
    const minimapItem = getMenuItem(template, 'View', 'Toggle Minimap')

    minimapItem?.click?.({} as never, {} as never, {} as never)

    expect(sendMenuAction).toHaveBeenCalledWith('toggle-minimap')
  })

  it('routes the document statistics item through the renderer menu bridge', () => {
    const sendMenuAction = vi.fn()
    const template = createMenuTemplate({
      sendMenuAction,
    })
    const statisticsItem = getMenuItem(template, 'View', 'Document Statistics')

    statisticsItem?.click?.({} as never, {} as never, {} as never)

    expect(sendMenuAction).toHaveBeenCalledWith('toggle-document-statistics')
  })

  it('routes navigation history actions through the Go menu bridge', () => {
    const sendMenuAction = vi.fn()
    const template = createMenuTemplate({
      sendMenuAction,
    })
    const backItem = getMenuItem(template, 'Go', 'Back')
    const forwardItem = getMenuItem(template, 'Go', 'Forward')

    backItem?.click?.({} as never, {} as never, {} as never)
    forwardItem?.click?.({} as never, {} as never, {} as never)

    expect(backItem).toEqual(
      expect.objectContaining({
        accelerator: 'CmdOrCtrl+[',
      }),
    )
    expect(forwardItem).toEqual(
      expect.objectContaining({
        accelerator: 'CmdOrCtrl+]',
      }),
    )
    expect(sendMenuAction.mock.calls).toContainEqual(['navigate-back'])
    expect(sendMenuAction.mock.calls).toContainEqual(['navigate-forward'])
  })

  it('routes clear formatting through the renderer menu bridge', () => {
    const sendMenuAction = vi.fn()
    const template = createMenuTemplate({
      sendMenuAction,
    })
    const clearFormattingItem = getMenuItem(template, 'Format', 'Clear Formatting')

    clearFormattingItem?.click?.({} as never, {} as never, {} as never)

    expect(clearFormattingItem).toEqual(
      expect.objectContaining({
        accelerator: 'CmdOrCtrl+\\',
      }),
    )
    expect(sendMenuAction).toHaveBeenCalledWith('clear-formatting')
  })

  it('routes distraction-free mode through the renderer menu bridge', () => {
    const sendMenuAction = vi.fn()
    const template = createMenuTemplate({
      sendMenuAction,
    })
    const distractionFreeItem = getMenuItem(template, 'View', 'Distraction Free Mode')

    distractionFreeItem?.click?.({} as never, {} as never, {} as never)

    expect(sendMenuAction).toHaveBeenCalledWith('toggle-distraction-free')
  })

  it('uses platform-specific fullscreen accelerators and toggles the window directly', () => {
    const toggleFullscreen = vi.fn()
    const linuxTemplate = createMenuTemplate({
      toggleFullscreen,
    })
    const macTemplate = createMenuTemplate({
      toggleFullscreen,
      platform: 'darwin',
    })
    const linuxFullscreenItem = getMenuItem(linuxTemplate, 'View', 'Toggle Fullscreen')
    const macFullscreenItem = getMenuItem(macTemplate, 'View', 'Toggle Fullscreen')

    linuxFullscreenItem?.click?.({} as never, {} as never, {} as never)

    expect(linuxFullscreenItem).toEqual(
      expect.objectContaining({
        accelerator: 'F11',
      }),
    )
    expect(macFullscreenItem).toEqual(
      expect.objectContaining({
        accelerator: 'Ctrl+Command+F',
      }),
    )
    expect(toggleFullscreen).toHaveBeenCalledTimes(1)
  })

  it('reflects and toggles the Always on Top window state from the View menu', () => {
    const toggleAlwaysOnTop = vi.fn()
    const uncheckedTemplate = createMenuTemplate({
      toggleAlwaysOnTop,
    })
    const checkedTemplate = createMenuTemplate({
      isAlwaysOnTop: true,
      toggleAlwaysOnTop,
    })
    const uncheckedItem = getMenuItem(uncheckedTemplate, 'View', 'Always on Top')
    const checkedItem = getMenuItem(checkedTemplate, 'View', 'Always on Top')

    uncheckedItem?.click?.({} as never, {} as never, {} as never)

    expect(uncheckedItem).toEqual(
      expect.objectContaining({
        type: 'checkbox',
        checked: false,
      }),
    )
    expect(checkedItem).toEqual(
      expect.objectContaining({
        checked: true,
      }),
    )
    expect(toggleAlwaysOnTop).toHaveBeenCalledTimes(1)
  })

  it('serializes pinned folders, recent entries, and clear actions under File > Open Recent', () => {
    const openEntry = vi.fn()
    const pinFolder = vi.fn()
    const clearItems = vi.fn()
    const clearAll = vi.fn()
    const template = createMenuTemplate({
      openRecent: {
        pinnedFolders: [
          { kind: 'folder', label: 'workspace', description: '/Users/pprp/workspace', path: '/Users/pprp/workspace' },
        ],
        recentEntries: [
          { kind: 'file', label: 'alpha.md', description: '/notes', path: '/notes/alpha.md' },
          { kind: 'folder', label: 'docs', description: '/Users/pprp/docs', path: '/Users/pprp/docs' },
        ],
        pinnableFolders: [
          { kind: 'folder', label: 'docs', description: '/Users/pprp/docs', path: '/Users/pprp/docs' },
        ],
        canClearItems: true,
        canClearAll: true,
        openEntry,
        pinFolder,
        unpinFolder: vi.fn(),
        clearItems,
        clearAll,
      },
    })
    const fileMenu = template.find((item) => item.label === 'File')
    const fileSubmenu = Array.isArray(fileMenu?.submenu) ? fileMenu.submenu : []
    const openRecentItem = fileSubmenu.find((item) => item.label === 'Open Recent')
    const openRecentSubmenu = Array.isArray(openRecentItem?.submenu) ? openRecentItem.submenu : []
    const workspaceItem = openRecentSubmenu.find((item) => item.label === 'workspace')
    const alphaItem = openRecentSubmenu.find((item) => item.label === 'alpha.md')
    const pinFolderItem = openRecentSubmenu.find((item) => item.label === 'Pin Folder')
    const pinFolderSubmenu = Array.isArray(pinFolderItem?.submenu) ? pinFolderItem.submenu : []
    const clearItemsItem = openRecentSubmenu.find((item) => item.label === 'Clear Items')
    const clearAllItem = openRecentSubmenu.find(
      (item) => item.label === 'Clear Recent and Pinned Folders / Files',
    )

    workspaceItem?.click?.({} as never, {} as never, {} as never)
    alphaItem?.click?.({} as never, {} as never, {} as never)
    pinFolderSubmenu[0]?.click?.({} as never, {} as never, {} as never)
    clearItemsItem?.click?.({} as never, {} as never, {} as never)
    clearAllItem?.click?.({} as never, {} as never, {} as never)

    expect(openRecentSubmenu.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Pinned Folders',
        'workspace',
        'Recent Files and Folders',
        'alpha.md',
        'docs',
        'Pin Folder',
        'Unpin Folder',
        'Clear Items',
        'Clear Recent and Pinned Folders / Files',
      ]),
    )
    expect(openEntry.mock.calls).toEqual([
      [{ kind: 'folder', label: 'workspace', description: '/Users/pprp/workspace', path: '/Users/pprp/workspace' }],
      [{ kind: 'file', label: 'alpha.md', description: '/notes', path: '/notes/alpha.md' }],
    ])
    expect(pinFolder).toHaveBeenCalledWith('/Users/pprp/docs')
    expect(clearItems).toHaveBeenCalledTimes(1)
    expect(clearAll).toHaveBeenCalledTimes(1)
  })
})
