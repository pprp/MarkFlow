import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WindowStateManager } from './windowStateManager'

function createWindowStub(initialAlwaysOnTop = false) {
  let alwaysOnTop = initialAlwaysOnTop

  return {
    window: {
      isAlwaysOnTop: vi.fn(() => alwaysOnTop),
      setAlwaysOnTop: vi.fn((nextAlwaysOnTop: boolean) => {
        alwaysOnTop = nextAlwaysOnTop
      }),
    },
  }
}

describe('WindowStateManager', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-window-state-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('persists Always on Top toggles and restores them on the next launch', async () => {
    const firstWindow = createWindowStub()
    const firstManager = new WindowStateManager(firstWindow.window as never, tempDir)

    await firstManager.initialize()
    await firstManager.toggleAlwaysOnTop()

    expect(firstWindow.window.setAlwaysOnTop).toHaveBeenCalledWith(true)
    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, 'window-state', 'primary.json'), 'utf-8')),
    ).toEqual({
      alwaysOnTop: true,
    })

    const restoredWindow = createWindowStub()
    const restoredManager = new WindowStateManager(restoredWindow.window as never, tempDir)

    await restoredManager.initialize()

    expect(restoredWindow.window.setAlwaysOnTop).toHaveBeenCalledWith(true)
    expect(restoredManager.isAlwaysOnTop()).toBe(true)
  })

  it('keeps persisted Always on Top state isolated per window identifier', async () => {
    const pinnedWindow = createWindowStub()
    const pinnedManager = new WindowStateManager(pinnedWindow.window as never, tempDir, 'window-a')
    await pinnedManager.initialize()
    await pinnedManager.toggleAlwaysOnTop()

    const unpinnedWindow = createWindowStub()
    const unpinnedManager = new WindowStateManager(unpinnedWindow.window as never, tempDir, 'window-b')
    await unpinnedManager.initialize()

    expect(pinnedManager.isAlwaysOnTop()).toBe(true)
    expect(unpinnedManager.isAlwaysOnTop()).toBe(false)
    expect(fs.existsSync(path.join(tempDir, 'window-state', 'window-a.json'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'window-state', 'window-b.json'))).toBe(false)
  })

  it('invokes the state-change callback when the persisted Always on Top value changes', async () => {
    const onStateChanged = vi.fn()
    const window = createWindowStub()
    const manager = new WindowStateManager(window.window as never, tempDir, 'primary', onStateChanged)

    await manager.initialize()
    await manager.toggleAlwaysOnTop()

    expect(manager.isAlwaysOnTop()).toBe(true)
    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, 'window-state', 'primary.json'), 'utf-8')),
    ).toEqual({
      alwaysOnTop: true,
    })
    expect(onStateChanged).toHaveBeenCalledTimes(1)
  })
})
