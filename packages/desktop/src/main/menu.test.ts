import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { createApplicationMenuTemplate } from './menu'

function getFileMenuItem(
  template: MenuItemConstructorOptions[],
  label: string,
): MenuItemConstructorOptions | undefined {
  const fileMenu = template.find((item) => item.label === 'File')
  const submenu = Array.isArray(fileMenu?.submenu) ? fileMenu.submenu : []
  return submenu.find((item) => item.label === label)
}

describe('createApplicationMenuTemplate', () => {
  it('disables the reveal item for untitled documents', () => {
    const template = createApplicationMenuTemplate({
      canRevealCurrentFile: () => false,
      revealCurrentFileInFolder: vi.fn(() => false),
      sendMenuAction: vi.fn(),
      platform: 'darwin',
    })

    expect(getFileMenuItem(template, 'Reveal in Finder')).toEqual(
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
    const revealItem = getFileMenuItem(template, 'Show in Folder')

    revealItem?.click?.({} as never, {} as never, {} as never)

    expect(revealItem).toEqual(
      expect.objectContaining({
        enabled: true,
      }),
    )
    expect(revealCurrentFileInFolder).toHaveBeenCalledTimes(1)
  })
})
