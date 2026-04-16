import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { createApplicationMenuTemplate } from './menu'

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
    const template = createApplicationMenuTemplate({
      canRevealCurrentFile: () => false,
      revealCurrentFileInFolder: vi.fn(() => false),
      sendMenuAction: vi.fn(),
      platform: 'darwin',
    })

    expect(getMenuItem(template, 'File', 'Reveal in Finder')).toEqual(
      expect.objectContaining({
        enabled: false,
      }),
    )
  })

  it('clicks through to reveal the current saved file', () => {
    const revealCurrentFileInFolder = vi.fn(() => true)
    const template = createApplicationMenuTemplate({
      canRevealCurrentFile: () => true,
      revealCurrentFileInFolder,
      sendMenuAction: vi.fn(),
      platform: 'linux',
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
    const template = createApplicationMenuTemplate({
      canRevealCurrentFile: () => true,
      revealCurrentFileInFolder: vi.fn(() => true),
      sendMenuAction,
      platform: 'linux',
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
    const template = createApplicationMenuTemplate({
      canRevealCurrentFile: () => true,
      revealCurrentFileInFolder: vi.fn(() => true),
      sendMenuAction,
      platform: 'linux',
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
    const template = createApplicationMenuTemplate({
      canRevealCurrentFile: () => true,
      revealCurrentFileInFolder: vi.fn(() => true),
      sendMenuAction,
      platform: 'linux',
    })
    const minimapItem = getMenuItem(template, 'View', 'Toggle Minimap')

    minimapItem?.click?.({} as never, {} as never, {} as never)

    expect(sendMenuAction).toHaveBeenCalledWith('toggle-minimap')
  })
})
