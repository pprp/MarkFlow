import * as fs from 'fs'
import * as path from 'path'
import { ipcMain, nativeTheme, type BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import type {
  MarkFlowAppearance,
  MarkFlowThemePayload,
  MarkFlowThemeState,
  MarkFlowThemeSummary,
} from '@markflow/shared'

interface ThemeFile extends MarkFlowThemeSummary {
  filePath: string
}

interface ThemeState {
  themeId?: string
  lightThemeId?: string
  darkThemeId?: string
}

interface ResolvedThemeState {
  lightThemeId: string
  darkThemeId: string
}

const DEFAULT_THEME_IDS: Record<MarkFlowAppearance, string> = {
  light: 'paper',
  dark: 'midnight',
}

const DEFAULT_THEME_STATE: ResolvedThemeState = {
  lightThemeId: DEFAULT_THEME_IDS.light,
  darkThemeId: DEFAULT_THEME_IDS.dark,
}

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
  {
    id: 'github',
    name: 'GitHub',
    cssText: `:root {
  --mf-bg: #ffffff;
  --mf-bg-secondary: #f6f8fa;
  --mf-bg-tertiary: #ffffff;
  --mf-bg-code: #f6f8fa;
  --mf-fg: #24292e;
  --mf-fg-secondary: #586069;
  --mf-fg-muted: #6a737d;
  --mf-heading-color: #24292e;
  --mf-border: #e1e4e8;
  --mf-border-light: #eaecef;
  --mf-hr-color: #e1e4e8;
  --mf-accent: #0366d6;
  --mf-accent-hover: #005cc5;
  --mf-accent-light: rgba(3, 102, 214, 0.08);
  --mf-link-color: #0366d6;
  --mf-code-fg: #e01e5a;
  --mf-blockquote-border: #dfe2e5;
  --mf-blockquote-fg: #6a737d;
  --mf-selection: rgba(3, 102, 214, 0.15);
  --mf-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --mf-font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --mf-font-size: 16px;
  --mf-line-height: 1.6;
  --mf-content-width: 780px;
}`
  },
  {
    id: 'night',
    name: 'Night',
    cssText: `:root {
  --mf-bg: #1d1f21;
  --mf-bg-secondary: #282a2e;
  --mf-bg-tertiary: #282a2e;
  --mf-bg-code: #282a2e;
  --mf-fg: #c5c8c6;
  --mf-fg-secondary: #969896;
  --mf-fg-muted: #707780;
  --mf-heading-color: #e0e2e0;
  --mf-fill: rgba(255, 255, 255, 0.06);
  --mf-fill-secondary: rgba(255, 255, 255, 0.04);
  --mf-border: #373b41;
  --mf-border-light: #2d2f31;
  --mf-hr-color: #373b41;
  --mf-accent: #81a2be;
  --mf-accent-hover: #a8c0d6;
  --mf-accent-light: rgba(129, 162, 190, 0.12);
  --mf-link-color: #81a2be;
  --mf-code-fg: #cc6666;
  --mf-blockquote-border: #4a4e58;
  --mf-blockquote-fg: #969896;
  --mf-selection: rgba(129, 162, 190, 0.25);
  --mf-font-size: 15px;
  --mf-line-height: 1.7;
}`
  },
  {
    id: 'newsprint',
    name: 'Newsprint',
    cssText: `:root {
  --mf-bg: #f4ecd8;
  --mf-bg-secondary: #ede0c4;
  --mf-bg-tertiary: #f4ecd8;
  --mf-bg-code: #e8dcc4;
  --mf-fg: #2c2416;
  --mf-fg-secondary: #5c4a2a;
  --mf-fg-muted: #8a7055;
  --mf-heading-color: #1a1208;
  --mf-border: #c8ab80;
  --mf-border-light: #d8c098;
  --mf-hr-color: #c0a070;
  --mf-accent: #7c4a1e;
  --mf-accent-hover: #5e3614;
  --mf-accent-light: rgba(124, 74, 30, 0.10);
  --mf-link-color: #7c4a1e;
  --mf-code-fg: #8b3220;
  --mf-blockquote-border: #c0a070;
  --mf-blockquote-fg: #6a5438;
  --mf-selection: rgba(124, 74, 30, 0.18);
  --mf-font-sans: Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif;
  --mf-font-display: "Palatino Linotype", Palatino, Georgia, "Book Antiqua", serif;
  --mf-font-size: 17px;
  --mf-line-height: 1.82;
  --mf-content-width: 680px;
}`
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    cssText: `:root {
  --mf-bg: #002240;
  --mf-bg-secondary: #00294d;
  --mf-bg-tertiary: #00294d;
  --mf-bg-code: #003359;
  --mf-fg: #b0d1e8;
  --mf-fg-secondary: #7daec8;
  --mf-fg-muted: #5a8fa8;
  --mf-heading-color: #e0f0ff;
  --mf-fill: rgba(255, 255, 255, 0.05);
  --mf-fill-secondary: rgba(255, 255, 255, 0.03);
  --mf-border: #1a4a6a;
  --mf-border-light: #0f3655;
  --mf-hr-color: #1a4a6a;
  --mf-accent: #ffc600;
  --mf-accent-hover: #ffdd4a;
  --mf-accent-light: rgba(255, 198, 0, 0.12);
  --mf-link-color: #ffc600;
  --mf-code-fg: #ff9d00;
  --mf-blockquote-border: #1a5a80;
  --mf-blockquote-fg: #6a9ab8;
  --mf-selection: rgba(255, 198, 0, 0.20);
  --mf-font-size: 15px;
  --mf-line-height: 1.68;
}`
  },
  {
    id: 'pixyll',
    name: 'Pixyll',
    cssText: `:root {
  --mf-bg: #ffffff;
  --mf-bg-secondary: #f9f9f9;
  --mf-bg-tertiary: #ffffff;
  --mf-bg-code: #f5f5f5;
  --mf-fg: #333333;
  --mf-fg-secondary: #666666;
  --mf-fg-muted: #999999;
  --mf-heading-color: #111111;
  --mf-border: #eeeeee;
  --mf-border-light: #f5f5f5;
  --mf-hr-color: #eeeeee;
  --mf-accent: #2568ba;
  --mf-accent-hover: #1a50a0;
  --mf-accent-light: rgba(37, 104, 186, 0.08);
  --mf-link-color: #2568ba;
  --mf-code-fg: #c7254e;
  --mf-blockquote-border: #cccccc;
  --mf-blockquote-fg: #888888;
  --mf-selection: rgba(37, 104, 186, 0.15);
  --mf-font-sans: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --mf-font-display: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --mf-font-size: 16px;
  --mf-line-height: 1.75;
  --mf-content-width: 740px;
}`
  },
  {
    id: 'forest',
    name: 'Forest',
    cssText: `:root {
  --mf-bg: #f0f4f0;
  --mf-bg-secondary: #e4ece4;
  --mf-bg-tertiary: #f0f4f0;
  --mf-bg-code: #e8f0e8;
  --mf-fg: #1c2e1c;
  --mf-fg-secondary: #3a5a3a;
  --mf-fg-muted: #5a7a5a;
  --mf-heading-color: #122212;
  --mf-border: #c0d4c0;
  --mf-border-light: #d4e4d4;
  --mf-hr-color: #b0c8b0;
  --mf-accent: #2d7d2d;
  --mf-accent-hover: #1f611f;
  --mf-accent-light: rgba(45, 125, 45, 0.10);
  --mf-link-color: #2d7d2d;
  --mf-code-fg: #8b4513;
  --mf-blockquote-border: #a8c8a8;
  --mf-blockquote-fg: #507050;
  --mf-selection: rgba(45, 125, 45, 0.15);
  --mf-font-size: 15px;
  --mf-line-height: 1.72;
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
  private currentThemeId = DEFAULT_THEME_IDS.light
  private themeState: ResolvedThemeState = { ...DEFAULT_THEME_STATE }
  private watcher: FSWatcher | null = null
  private readonly handleNativeThemeUpdated = () => {
    void this.applyThemeForAppearance(this.getCurrentAppearance(), { emit: true })
  }

  constructor(
    private window: BrowserWindow,
    userDataPath: string,
  ) {
    this.themeDir = path.join(userDataPath, 'themes')
    this.statePath = path.join(this.themeDir, 'theme-state.json')
  }

  registerIpcHandlers() {
    ipcMain.removeHandler('get-themes')
    ipcMain.removeHandler('get-theme-state')
    ipcMain.removeHandler('get-current-theme')
    ipcMain.removeHandler('set-theme')
    ipcMain.removeHandler('set-theme-for-appearance')

    ipcMain.handle('get-themes', () => this.getThemes())
    ipcMain.handle('get-theme-state', () => this.getThemeState())
    ipcMain.handle('get-current-theme', () => this.getCurrentTheme())
    ipcMain.handle('set-theme', async (_event, themeId: string) => this.setTheme(themeId))
    ipcMain.handle('set-theme-for-appearance', async (_event, appearance: MarkFlowAppearance, themeId: string) =>
      this.setThemeForAppearance(appearance, themeId),
    )
  }

  async initialize() {
    this.ensureThemeFiles()
    this.themeState = this.readPersistedThemeState()
    this.currentThemeId = this.getThemeIdForAppearance(this.getCurrentAppearance())
    await this.watchThemeFile(this.currentThemeId)
    nativeTheme.removeListener('updated', this.handleNativeThemeUpdated)
    nativeTheme.on('updated', this.handleNativeThemeUpdated)
  }

  async dispose() {
    nativeTheme.removeListener('updated', this.handleNativeThemeUpdated)

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
    return this.getThemeState()?.activeTheme ?? null
  }

  getThemeState(): MarkFlowThemeState | null {
    this.ensureThemeFiles()
    const theme =
      this.findTheme(this.currentThemeId) ?? this.findTheme(DEFAULT_THEME_IDS[this.getCurrentAppearance()])

    return {
      activeAppearance: this.getCurrentAppearance(),
      lightThemeId: this.themeState.lightThemeId,
      darkThemeId: this.themeState.darkThemeId,
      activeTheme: theme ? this.readThemePayload(theme) : null,
    }
  }

  async setTheme(themeId: string): Promise<MarkFlowThemePayload | null> {
    const state = await this.setThemeForAppearance(this.getCurrentAppearance(), themeId)
    return state?.activeTheme ?? null
  }

  async setThemeForAppearance(
    appearance: MarkFlowAppearance,
    themeId: string,
  ): Promise<MarkFlowThemeState | null> {
    this.ensureThemeFiles()
    const theme = this.findTheme(themeId)
    if (!theme) {
      return null
    }

    this.themeState = {
      ...this.themeState,
      [this.getStateKeyForAppearance(appearance)]: theme.id,
    }
    this.persistThemeState()

    if (appearance === this.getCurrentAppearance()) {
      await this.applyThemeById(theme.id, { emit: true })
      return this.getThemeState()
    }

    const state = this.getThemeState()
    if (state) {
      this.emitThemeState(state)
    }
    return state
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
      this.persistThemeState()
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

  private readPersistedThemeState(): ResolvedThemeState {
    try {
      const raw = fs.readFileSync(this.statePath, 'utf8')
      const state = JSON.parse(raw) as ThemeState

      const legacyThemeId = this.findTheme(state.themeId ?? '')?.id ?? null
      if (legacyThemeId && !state.lightThemeId && !state.darkThemeId) {
        const currentAppearance = this.getCurrentAppearance()
        return {
          lightThemeId: currentAppearance === 'light' ? legacyThemeId : DEFAULT_THEME_IDS.light,
          darkThemeId: currentAppearance === 'dark' ? legacyThemeId : DEFAULT_THEME_IDS.dark,
        }
      }

      return {
        lightThemeId: this.resolvePersistedThemeId(state.lightThemeId, 'light'),
        darkThemeId: this.resolvePersistedThemeId(state.darkThemeId, 'dark'),
      }
    } catch {
      return { ...DEFAULT_THEME_STATE }
    }
  }

  private resolvePersistedThemeId(themeId: string | null | undefined, appearance: MarkFlowAppearance) {
    return this.findTheme(themeId ?? '')?.id ?? DEFAULT_THEME_IDS[appearance]
  }

  private getCurrentAppearance(): MarkFlowAppearance {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  private getStateKeyForAppearance(appearance: MarkFlowAppearance): keyof ResolvedThemeState {
    return appearance === 'dark' ? 'darkThemeId' : 'lightThemeId'
  }

  private getThemeIdForAppearance(appearance: MarkFlowAppearance) {
    return this.themeState[this.getStateKeyForAppearance(appearance)]
  }

  private persistThemeState() {
    fs.writeFileSync(this.statePath, JSON.stringify(this.themeState, null, 2), 'utf8')
  }

  private async applyThemeForAppearance(
    appearance: MarkFlowAppearance,
    options: { emit: boolean },
  ): Promise<MarkFlowThemePayload | null> {
    return this.applyThemeById(this.getThemeIdForAppearance(appearance), options)
  }

  private async applyThemeById(
    themeId: string,
    options: { emit: boolean },
  ): Promise<MarkFlowThemePayload | null> {
    const theme =
      this.findTheme(themeId) ??
      this.findTheme(DEFAULT_THEME_IDS[this.getCurrentAppearance()]) ??
      this.findTheme(DEFAULT_THEME_IDS.light)
    if (!theme) {
      return null
    }

    this.currentThemeId = theme.id
    await this.watchThemeFile(theme.id)

    const payload = this.readThemePayload(theme)
    if (options.emit) {
      const state = this.getThemeState()
      if (state) {
        this.emitThemeState(state)
      }
    }

    return payload
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
      const state = this.getThemeState()
      if (state) {
        this.emitThemeState(state)
      }
    })
  }

  private emitThemeState(state: MarkFlowThemeState) {
    this.window.webContents.send('theme-updated', state)
  }
}
