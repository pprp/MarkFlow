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
  nativeTheme: {
    themeSource: 'system',
    shouldUseDarkColors: false,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}))

function createWindowStub() {
  return { webContents: { send: vi.fn() } }
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

  it('initializes with the claude default theme and exposes the theme list', async () => {
    const window = createWindowStub()
    const manager = new ThemeManager(window as never, tempDir)

    await manager.initialize()

    expect(manager.getThemes()).toEqual(
      expect.arrayContaining([
        { id: 'claude', name: 'Claude' },
        { id: 'paper', name: 'Paper' },
        { id: 'midnight', name: 'Midnight' },
      ]),
    )
    expect(manager.getThemes().length).toBeGreaterThanOrEqual(3)
    expect(manager.getThemeState()).toEqual(
      expect.objectContaining({
        activeThemeId: 'claude',
        activeTheme: expect.objectContaining({ id: 'claude', name: 'Claude' }),
      }),
    )

    await manager.dispose()
  })

  it('persists the selected theme and restores it on next launch', async () => {
    const window = createWindowStub()
    const manager = new ThemeManager(window as never, tempDir)

    await manager.initialize()
    const githubTheme = await manager.setTheme('github')

    expect(githubTheme).toEqual(
      expect.objectContaining({ id: 'github', name: 'GitHub' }),
    )
    expect(manager.getThemeState()).toEqual(
      expect.objectContaining({
        activeThemeId: 'github',
        activeTheme: expect.objectContaining({ id: 'github' }),
      }),
    )
    expect(window.webContents.send).toHaveBeenCalledWith(
      'theme-updated',
      expect.objectContaining({
        activeThemeId: 'github',
        activeTheme: expect.objectContaining({ id: 'github' }),
      }),
    )

    const persisted = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'themes', 'theme-state.json'), 'utf8'),
    ) as { themeId: string }
    expect(persisted).toEqual({ themeId: 'github' })

    await manager.dispose()

    const restored = new ThemeManager(createWindowStub() as never, tempDir)
    await restored.initialize()
    expect(restored.getThemeState()).toEqual(
      expect.objectContaining({
        activeThemeId: 'github',
        activeTheme: expect.objectContaining({ id: 'github' }),
      }),
    )

    await restored.dispose()
  })

  it('hot-reloads the active theme stylesheet when the file changes', async () => {
    const window = createWindowStub()
    const manager = new ThemeManager(window as never, tempDir)

    await manager.initialize()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const themePath = path.join(tempDir, 'themes', 'claude.css')
    window.webContents.send.mockClear()
    fs.writeFileSync(themePath, ':root { --mf-accent: #ff0055; }', 'utf8')

    await waitForExpectation(() => {
      expect(window.webContents.send).toHaveBeenCalledWith(
        'theme-updated',
        expect.objectContaining({
          activeTheme: expect.objectContaining({
            id: 'claude',
            cssText: expect.stringContaining('#ff0055'),
          }),
        }),
      )
    })

    await manager.dispose()
  })
})
