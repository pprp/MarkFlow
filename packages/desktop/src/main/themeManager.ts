import * as fs from 'fs'
import * as path from 'path'
import { ipcMain, type BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import type { MarkFlowThemePayload, MarkFlowThemeSummary } from '@markflow/shared'

interface ThemeFile extends MarkFlowThemeSummary {
  filePath: string
}

interface ThemeState {
  themeId: string
}

const DEFAULT_THEME_ID = 'paper'

const BUILTIN_THEMES: Array<{ id: string; name: string; cssText: string }> = [
  {
    id: 'paper',
    name: 'Paper',
    cssText: `:root {
  --mf-bg: #fbf6ec;
  --mf-bg-secondary: #f2ead9;
  --mf-bg-code: #f6efe2;
  --mf-fg: #2d241c;
  --mf-fg-muted: #7f6f62;
  --mf-heading-color: #201913;
  --mf-border: #decfbb;
  --mf-border-light: #eadfce;
  --mf-hr-color: #d4c2a6;
  --mf-accent: #9c5f2f;
  --mf-accent-hover: #7d4820;
  --mf-link-color: #9c5f2f;
  --mf-code-fg: #b4543f;
  --mf-blockquote-border: #d6c2ab;
  --mf-blockquote-fg: #7d6f61;
  --mf-selection: #e7d5b8;
}`
  },
  {
    id: 'midnight',
    name: 'Midnight',
    cssText: `:root {
  --mf-bg: #111827;
  --mf-bg-secondary: #182235;
  --mf-bg-code: #1e293b;
  --mf-fg: #dbe4f3;
  --mf-fg-muted: #94a3b8;
  --mf-heading-color: #f8fafc;
  --mf-border: #2f3f56;
  --mf-border-light: #243246;
  --mf-hr-color: #334155;
  --mf-accent: #38bdf8;
  --mf-accent-hover: #7dd3fc;
  --mf-link-color: #7dd3fc;
  --mf-code-fg: #fda4af;
  --mf-blockquote-border: #3b4f69;
  --mf-blockquote-fg: #93a4ba;
  --mf-selection: #1d4f7a;
}`
  },
]

function formatThemeName(themeId: string) {
  return themeId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export class ThemeManager {
  private readonly themeDir: string
  private readonly statePath: string
  private currentThemeId = DEFAULT_THEME_ID
  private watcher: FSWatcher | null = null

  constructor(
    private window: BrowserWindow,
    userDataPath: string,
  ) {
    this.themeDir = path.join(userDataPath, 'themes')
    this.statePath = path.join(this.themeDir, 'theme-state.json')
  }

  registerIpcHandlers() {
    ipcMain.removeHandler('get-themes')
    ipcMain.removeHandler('get-current-theme')
    ipcMain.removeHandler('set-theme')

    ipcMain.handle('get-themes', () => this.getThemes())
    ipcMain.handle('get-current-theme', () => this.getCurrentTheme())
    ipcMain.handle('set-theme', async (_event, themeId: string) => this.setTheme(themeId))
  }

  async initialize() {
    this.ensureThemeFiles()
    this.currentThemeId = this.readPersistedThemeId()
    await this.watchThemeFile(this.currentThemeId)
  }

  async dispose() {
    if (!this.watcher) {
      return
    }

    await this.watcher.close()
    this.watcher = null
  }

  getThemes(): MarkFlowThemeSummary[] {
    this.ensureThemeFiles()
    return this.readThemeFiles().map(({ id, name }) => ({ id, name }))
  }

  getCurrentTheme(): MarkFlowThemePayload | null {
    this.ensureThemeFiles()
    const theme = this.findTheme(this.currentThemeId) ?? this.findTheme(DEFAULT_THEME_ID)
    if (!theme) {
      return null
    }

    return this.readThemePayload(theme)
  }

  async setTheme(themeId: string): Promise<MarkFlowThemePayload | null> {
    this.ensureThemeFiles()
    const theme = this.findTheme(themeId)
    if (!theme) {
      return null
    }

    this.currentThemeId = theme.id
    this.persistThemeId(theme.id)
    await this.watchThemeFile(theme.id)

    const payload = this.readThemePayload(theme)
    this.emitTheme(payload)
    return payload
  }

  private ensureThemeFiles() {
    fs.mkdirSync(this.themeDir, { recursive: true })

    for (const theme of BUILTIN_THEMES) {
      const filePath = path.join(this.themeDir, `${theme.id}.css`)
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, theme.cssText, 'utf8')
      }
    }

    if (!fs.existsSync(this.statePath)) {
      this.persistThemeId(DEFAULT_THEME_ID)
    }
  }

  private readThemeFiles(): ThemeFile[] {
    return fs
      .readdirSync(this.themeDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
      .map((entry) => {
        const id = path.basename(entry.name, '.css')
        return {
          id,
          name: BUILTIN_THEMES.find((theme) => theme.id === id)?.name ?? formatThemeName(id),
          filePath: path.join(this.themeDir, entry.name),
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  private findTheme(themeId: string) {
    return this.readThemeFiles().find((theme) => theme.id === themeId) ?? null
  }

  private readThemePayload(theme: ThemeFile): MarkFlowThemePayload {
    return {
      id: theme.id,
      name: theme.name,
      cssText: fs.readFileSync(theme.filePath, 'utf8'),
    }
  }

  private readPersistedThemeId() {
    try {
      const raw = fs.readFileSync(this.statePath, 'utf8')
      const state = JSON.parse(raw) as ThemeState
      return this.findTheme(state.themeId)?.id ?? DEFAULT_THEME_ID
    } catch {
      return DEFAULT_THEME_ID
    }
  }

  private persistThemeId(themeId: string) {
    fs.writeFileSync(this.statePath, JSON.stringify({ themeId }, null, 2), 'utf8')
  }

  private async watchThemeFile(themeId: string) {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    const theme = this.findTheme(themeId)
    if (!theme) {
      return
    }

    this.watcher = chokidar.watch(theme.filePath, {
      ignoreInitial: true,
    })

    this.watcher.on('change', () => {
      const payload = this.getCurrentTheme()
      if (payload) {
        this.emitTheme(payload)
      }
    })
  }

  private emitTheme(theme: MarkFlowThemePayload) {
    this.window.webContents.send('theme-updated', theme)
  }
}
