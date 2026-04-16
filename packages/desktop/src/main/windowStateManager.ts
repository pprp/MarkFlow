import * as fs from 'fs'
import * as path from 'path'
import type { BrowserWindow } from 'electron'

const WINDOW_STATE_DIRECTORY = 'window-state'

interface PersistedWindowState {
  alwaysOnTop: boolean
}

type WindowStateWindow = Pick<
  BrowserWindow,
  'isAlwaysOnTop' | 'setAlwaysOnTop'
>

function sanitizeWindowStateId(windowStateId: string): string {
  return windowStateId.replace(/[^a-z0-9_-]/gi, '_')
}

export class WindowStateManager {
  private state: PersistedWindowState = { alwaysOnTop: false }
  private readonly statePath: string

  constructor(
    private readonly window: WindowStateWindow,
    userDataPath: string,
    windowStateId = 'primary',
    private readonly onStateChanged?: () => void,
  ) {
    this.statePath = path.join(
      userDataPath,
      WINDOW_STATE_DIRECTORY,
      `${sanitizeWindowStateId(windowStateId)}.json`,
    )
  }

  async initialize() {
    const persistedState = this.readPersistedState()
    await this.setAlwaysOnTop(persistedState.alwaysOnTop)
  }

  dispose() {}

  isAlwaysOnTop(): boolean {
    return this.state.alwaysOnTop
  }

  async toggleAlwaysOnTop() {
    await this.setAlwaysOnTop(!this.window.isAlwaysOnTop())
  }

  private async setAlwaysOnTop(alwaysOnTop: boolean) {
    if (this.state.alwaysOnTop === alwaysOnTop && this.window.isAlwaysOnTop() === alwaysOnTop) {
      return
    }

    this.state = { alwaysOnTop }

    if (this.window.isAlwaysOnTop() !== alwaysOnTop) {
      this.window.setAlwaysOnTop(alwaysOnTop)
    }

    await this.persistState()
    this.onStateChanged?.()
  }

  private readPersistedState(): PersistedWindowState {
    try {
      const payload = JSON.parse(fs.readFileSync(this.statePath, 'utf-8')) as Partial<PersistedWindowState>
      return {
        alwaysOnTop: payload.alwaysOnTop === true,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read MarkFlow window state:', error)
      }
      return { alwaysOnTop: false }
    }
  }

  private async persistState() {
    try {
      await fs.promises.mkdir(path.dirname(this.statePath), { recursive: true })
      await fs.promises.writeFile(
        this.statePath,
        JSON.stringify({
          alwaysOnTop: this.state.alwaysOnTop,
        } satisfies PersistedWindowState),
        'utf-8',
      )
    } catch (error) {
      console.error('Failed to write MarkFlow window state:', error)
    }
  }
}
