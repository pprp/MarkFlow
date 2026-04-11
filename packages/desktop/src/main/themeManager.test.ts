import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeManager } from './themeManager'

const { handleMock, removeHandlerMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: removeHandlerMock,
  },
}))

function createWindowStub() {
  return {
    webContents: {
      send: vi.fn(),
    },
  }
}

async function waitForExpectation(assertion: () => void, timeoutMs = 3000) {
  const start = Date.now()
  let lastError: unknown = null

  while (Date.now() - start < timeoutMs) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }

  throw lastError
}

describe('ThemeManager', () => {
  let tempDir: string

  beforeEach(() => {
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-theme-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('bootstraps built-in themes and persists theme switches', async () => {
    const window = createWindowStub()
    const manager = new ThemeManager(window as never, tempDir)

    await manager.initialize()

    expect(manager.getThemes()).toEqual(
      expect.arrayContaining([
        { id: 'midnight', name: 'Midnight' },
        { id: 'paper', name: 'Paper' },
      ]),
    )
    expect(manager.getThemes().length).toBeGreaterThanOrEqual(2)
    expect(manager.getCurrentTheme()).toEqual(
      expect.objectContaining({
        id: 'paper',
        name: 'Paper',
      }),
    )

    const theme = await manager.setTheme('midnight')
    expect(theme).toEqual(
      expect.objectContaining({
        id: 'midnight',
        name: 'Midnight',
      }),
    )
    expect(window.webContents.send).toHaveBeenCalledWith(
      'theme-updated',
      expect.objectContaining({ id: 'midnight' }),
    )

    const persisted = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'themes', 'theme-state.json'), 'utf8'),
    ) as { themeId: string }
    expect(persisted.themeId).toBe('midnight')

    await manager.dispose()

    const restored = new ThemeManager(createWindowStub() as never, tempDir)
    await restored.initialize()
    expect(restored.getCurrentTheme()).toEqual(
      expect.objectContaining({
        id: 'midnight',
      }),
    )
    await restored.dispose()
  })

  it('hot-reloads the active theme stylesheet when the file changes', async () => {
    const window = createWindowStub()
    const manager = new ThemeManager(window as never, tempDir)

    await manager.initialize()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const themePath = path.join(tempDir, 'themes', 'paper.css')
    window.webContents.send.mockClear()
    fs.writeFileSync(themePath, ':root { --mf-accent: #ff0055; }', 'utf8')

    await waitForExpectation(() => {
      expect(window.webContents.send).toHaveBeenCalledWith(
        'theme-updated',
        expect.objectContaining({
          id: 'paper',
          cssText: expect.stringContaining('#ff0055'),
        }),
      )
    })

    await manager.dispose()
  })
})
