import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeManager } from './themeManager'

const { handleMock, removeHandlerMock, nativeThemeMock, emitNativeThemeUpdated, resetNativeThemeMock } = vi.hoisted(
  () => {
    const updatedListeners = new Set<() => void>()
    const nativeThemeMock = {
      shouldUseDarkColors: false,
      on: vi.fn((_event: string, listener: () => void) => {
        updatedListeners.add(listener)
      }),
      removeListener: vi.fn((_event: string, listener: () => void) => {
        updatedListeners.delete(listener)
      }),
    }

    return {
      handleMock: vi.fn(),
      removeHandlerMock: vi.fn(),
      nativeThemeMock,
      emitNativeThemeUpdated: () => {
        for (const listener of [...updatedListeners]) {
          listener()
        }
      },
      resetNativeThemeMock: () => {
        updatedListeners.clear()
        nativeThemeMock.shouldUseDarkColors = false
        nativeThemeMock.on.mockClear()
        nativeThemeMock.removeListener.mockClear()
      },
    }
  },
)

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: removeHandlerMock,
  },
  nativeTheme: nativeThemeMock,
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
    resetNativeThemeMock()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-theme-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('persists separate light and dark themes and switches when the system appearance changes', async () => {
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
    expect(manager.getThemeState()).toEqual(
      expect.objectContaining({
        activeAppearance: 'light',
        lightThemeId: 'paper',
        darkThemeId: 'midnight',
        activeTheme: expect.objectContaining({
          id: 'paper',
          name: 'Paper',
        }),
      }),
    )

    const lightState = await manager.setThemeForAppearance('light', 'github')
    expect(lightState).toEqual(
      expect.objectContaining({
        activeAppearance: 'light',
        lightThemeId: 'github',
        darkThemeId: 'midnight',
        activeTheme: expect.objectContaining({
          id: 'github',
          name: 'GitHub',
        }),
      }),
    )
    expect(window.webContents.send).toHaveBeenCalledWith(
      'theme-updated',
      expect.objectContaining({
        activeAppearance: 'light',
        lightThemeId: 'github',
        darkThemeId: 'midnight',
        activeTheme: expect.objectContaining({ id: 'github' }),
      }),
    )

    const darkState = await manager.setThemeForAppearance('dark', 'night')
    expect(darkState).toEqual(
      expect.objectContaining({
        activeAppearance: 'light',
        lightThemeId: 'github',
        darkThemeId: 'night',
        activeTheme: expect.objectContaining({ id: 'github' }),
      }),
    )

    const persisted = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'themes', 'theme-state.json'), 'utf8'),
    ) as { lightThemeId: string; darkThemeId: string }
    expect(persisted).toEqual({
      lightThemeId: 'github',
      darkThemeId: 'night',
    })

    nativeThemeMock.shouldUseDarkColors = true
    window.webContents.send.mockClear()
    emitNativeThemeUpdated()

    await waitForExpectation(() => {
      expect(window.webContents.send).toHaveBeenCalledWith(
        'theme-updated',
        expect.objectContaining({
          activeAppearance: 'dark',
          lightThemeId: 'github',
          darkThemeId: 'night',
          activeTheme: expect.objectContaining({ id: 'night' }),
        }),
      )
    })

    await manager.dispose()

    const restored = new ThemeManager(createWindowStub() as never, tempDir)
    await restored.initialize()
    expect(restored.getThemeState()).toEqual(
      expect.objectContaining({
        activeAppearance: 'dark',
        lightThemeId: 'github',
        darkThemeId: 'night',
        activeTheme: expect.objectContaining({
          id: 'night',
        }),
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
          activeTheme: expect.objectContaining({
            id: 'paper',
            cssText: expect.stringContaining('#ff0055'),
          }),
        }),
      )
    })

    await manager.dispose()
  })
})
