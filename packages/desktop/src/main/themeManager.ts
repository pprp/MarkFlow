import * as fs from 'fs'
import * as path from 'path'
import { ipcMain, type BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import type {
  MarkFlowThemePayload,
  MarkFlowThemeState,
  MarkFlowThemeSummary,
} from '@markflow/shared'

interface ThemeFile extends MarkFlowThemeSummary {
  filePath: string
}

interface PersistedThemeState {
  themeId?: string
}

const DEFAULT_THEME_ID = 'claude'

const BUILTIN_THEMES: Array<{ id: string; name: string; cssText: string }> = [
  {
    id: 'claude',
    name: 'Claude',
    cssText: `:root {
  --mf-bg:              #FFFFFF;
  --mf-bg-secondary:    #F9F8F6;
  --mf-bg-tertiary:     #F1F0EE;
  --mf-bg-code:         #F5F4F2;
  --mf-bg-elevated:     #FFFFFF;
  --mf-fg:              #1A1A1A;
  --mf-fg-secondary:    rgba(26, 26, 26, 0.58);
  --mf-fg-muted:        rgba(26, 26, 26, 0.38);
  --mf-heading-color:   #0D0D0D;
  --mf-fill:            rgba(26, 26, 26, 0.07);
  --mf-fill-secondary:  rgba(26, 26, 26, 0.04);
  --mf-fill-tertiary:   rgba(26, 26, 26, 0.025);
  --mf-border:          rgba(26, 26, 26, 0.10);
  --mf-border-light:    rgba(26, 26, 26, 0.06);
  --mf-hr-color:        rgba(26, 26, 26, 0.08);
  --mf-accent:          #D97757;
  --mf-accent-hover:    #C5643F;
  --mf-accent-light:    rgba(217, 119, 87, 0.10);
  --mf-accent-pressed:  rgba(217, 119, 87, 0.18);
  --mf-accent-subtle:   rgba(217, 119, 87, 0.06);
  --mf-link-color:      #C5643F;
  --mf-code-fg:         #B45450;
  --mf-blockquote-border: rgba(217, 119, 87, 0.22);
  --mf-blockquote-fg:   rgba(26, 26, 26, 0.48);
  --mf-selection:       rgba(217, 119, 87, 0.13);
  --mf-shadow-xs: 0 1px 2px rgba(26, 20, 10, 0.05);
  --mf-shadow-sm: 0 1px 3px rgba(26, 20, 10, 0.06), 0 1px 2px rgba(26, 20, 10, 0.03);
  --mf-shadow:    0 4px 20px rgba(26, 20, 10, 0.07), 0 1px 6px rgba(26, 20, 10, 0.03);
}`
  },
  {
    id: 'paper',
    name: 'Paper',
    cssText: `:root {
  --mf-bg:              #FBF7F0;
  --mf-bg-secondary:    #F4EDE0;
  --mf-bg-tertiary:     #ECE3D0;
  --mf-bg-code:         #F0E8D8;
  --mf-bg-elevated:     #FEFCF8;
  --mf-fg:              #2C2118;
  --mf-fg-secondary:    rgba(44, 33, 24, 0.60);
  --mf-fg-muted:        rgba(44, 33, 24, 0.40);
  --mf-heading-color:   #1C140E;
  --mf-fill:            rgba(44, 33, 24, 0.08);
  --mf-fill-secondary:  rgba(44, 33, 24, 0.05);
  --mf-fill-tertiary:   rgba(44, 33, 24, 0.03);
  --mf-border:          #D8C9B4;
  --mf-border-light:    #E8DAC8;
  --mf-hr-color:        #D0BEA4;
  --mf-accent:          #96582A;
  --mf-accent-hover:    #7A4420;
  --mf-accent-light:    rgba(150, 88, 42, 0.10);
  --mf-accent-pressed:  rgba(150, 88, 42, 0.18);
  --mf-accent-subtle:   rgba(150, 88, 42, 0.06);
  --mf-link-color:      #96582A;
  --mf-code-fg:         #A8422E;
  --mf-blockquote-border: #CDBFA8;
  --mf-blockquote-fg:   rgba(44, 33, 24, 0.52);
  --mf-selection:       rgba(150, 88, 42, 0.16);
  --mf-shadow-xs: 0 1px 2px rgba(44, 30, 10, 0.08);
  --mf-shadow-sm: 0 1px 3px rgba(44, 30, 10, 0.09), 0 1px 2px rgba(44, 30, 10, 0.05);
  --mf-shadow:    0 4px 20px rgba(44, 30, 10, 0.10), 0 1px 6px rgba(44, 30, 10, 0.05);
}`
  },
  {
    id: 'midnight',
    name: 'Midnight',
    cssText: `:root {
  --mf-bg:              #0F1117;
  --mf-bg-secondary:    #161820;
  --mf-bg-tertiary:     #1E2130;
  --mf-bg-code:         #181A24;
  --mf-bg-elevated:     #1C1F2E;
  --mf-fg:              #CDD6F4;
  --mf-fg-secondary:    rgba(205, 214, 244, 0.62);
  --mf-fg-muted:        rgba(205, 214, 244, 0.38);
  --mf-heading-color:   #E6ECF8;
  --mf-fill:            rgba(205, 214, 244, 0.08);
  --mf-fill-secondary:  rgba(205, 214, 244, 0.04);
  --mf-fill-tertiary:   rgba(205, 214, 244, 0.025);
  --mf-border:          rgba(205, 214, 244, 0.12);
  --mf-border-light:    rgba(205, 214, 244, 0.07);
  --mf-hr-color:        rgba(205, 214, 244, 0.10);
  --mf-accent:          #89B4FA;
  --mf-accent-hover:    #B4D0FF;
  --mf-accent-light:    rgba(137, 180, 250, 0.14);
  --mf-accent-pressed:  rgba(137, 180, 250, 0.22);
  --mf-accent-subtle:   rgba(137, 180, 250, 0.07);
  --mf-link-color:      #89B4FA;
  --mf-code-fg:         #F38BA8;
  --mf-blockquote-border: rgba(137, 180, 250, 0.30);
  --mf-blockquote-fg:   rgba(205, 214, 244, 0.48);
  --mf-selection:       rgba(137, 180, 250, 0.22);
  --mf-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.30);
  --mf-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.36), 0 1px 2px rgba(0, 0, 0, 0.24);
  --mf-shadow:    0 4px 20px rgba(0, 0, 0, 0.44), 0 2px 6px rgba(0, 0, 0, 0.28);
}`
  },
  {
    id: 'github',
    name: 'GitHub',
    cssText: `:root {
  --mf-bg:              #FFFFFF;
  --mf-bg-secondary:    #F6F8FA;
  --mf-bg-tertiary:     #EAEEF2;
  --mf-bg-code:         #F6F8FA;
  --mf-bg-elevated:     #FFFFFF;
  --mf-fg:              #1F2328;
  --mf-fg-secondary:    rgba(31, 35, 40, 0.60);
  --mf-fg-muted:        rgba(31, 35, 40, 0.40);
  --mf-heading-color:   #1F2328;
  --mf-fill:            rgba(31, 35, 40, 0.07);
  --mf-fill-secondary:  rgba(31, 35, 40, 0.04);
  --mf-fill-tertiary:   rgba(31, 35, 40, 0.025);
  --mf-border:          #D0D7DE;
  --mf-border-light:    #E8ECF0;
  --mf-hr-color:        #D0D7DE;
  --mf-accent:          #0969DA;
  --mf-accent-hover:    #0550AE;
  --mf-accent-light:    rgba(9, 105, 218, 0.08);
  --mf-accent-pressed:  rgba(9, 105, 218, 0.16);
  --mf-accent-subtle:   rgba(9, 105, 218, 0.05);
  --mf-link-color:      #0969DA;
  --mf-code-fg:         #CF222E;
  --mf-blockquote-border: #D0D7DE;
  --mf-blockquote-fg:   rgba(31, 35, 40, 0.52);
  --mf-selection:       rgba(9, 105, 218, 0.14);
  --mf-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --mf-font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --mf-font-size: 15px;
  --mf-line-height: 1.6;
  --mf-content-width: 760px;
  --mf-shadow-xs: 0 1px 2px rgba(31, 35, 40, 0.06);
  --mf-shadow-sm: 0 1px 3px rgba(31, 35, 40, 0.08), 0 1px 2px rgba(31, 35, 40, 0.04);
  --mf-shadow:    0 4px 20px rgba(31, 35, 40, 0.10), 0 1px 6px rgba(31, 35, 40, 0.04);
}`
  },
  {
    id: 'night',
    name: 'Night',
    cssText: `:root {
  --mf-bg:              #1E2127;
  --mf-bg-secondary:    #252931;
  --mf-bg-tertiary:     #2C313A;
  --mf-bg-code:         #282C34;
  --mf-bg-elevated:     #2C313A;
  --mf-fg:              #ABB2BF;
  --mf-fg-secondary:    rgba(171, 178, 191, 0.65);
  --mf-fg-muted:        rgba(171, 178, 191, 0.40);
  --mf-heading-color:   #D8DEE9;
  --mf-fill:            rgba(171, 178, 191, 0.08);
  --mf-fill-secondary:  rgba(171, 178, 191, 0.05);
  --mf-fill-tertiary:   rgba(171, 178, 191, 0.03);
  --mf-border:          #3E4451;
  --mf-border-light:    #323842;
  --mf-hr-color:        #3E4451;
  --mf-accent:          #61AFEF;
  --mf-accent-hover:    #88C5F7;
  --mf-accent-light:    rgba(97, 175, 239, 0.12);
  --mf-accent-pressed:  rgba(97, 175, 239, 0.20);
  --mf-accent-subtle:   rgba(97, 175, 239, 0.06);
  --mf-link-color:      #61AFEF;
  --mf-code-fg:         #E06C75;
  --mf-blockquote-border: rgba(97, 175, 239, 0.28);
  --mf-blockquote-fg:   rgba(171, 178, 191, 0.52);
  --mf-selection:       rgba(97, 175, 239, 0.22);
  --mf-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.28);
  --mf-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.34), 0 1px 2px rgba(0, 0, 0, 0.22);
  --mf-shadow:    0 4px 20px rgba(0, 0, 0, 0.40), 0 2px 6px rgba(0, 0, 0, 0.26);
}`
  },
  {
    id: 'newsprint',
    name: 'Newsprint',
    cssText: `:root {
  --mf-bg:              #F5EDDA;
  --mf-bg-secondary:    #EDE3CA;
  --mf-bg-tertiary:     #E4D9BC;
  --mf-bg-code:         #EAE0CC;
  --mf-bg-elevated:     #FAF4E6;
  --mf-fg:              #261D0E;
  --mf-fg-secondary:    rgba(38, 29, 14, 0.62);
  --mf-fg-muted:        rgba(38, 29, 14, 0.42);
  --mf-heading-color:   #160E04;
  --mf-fill:            rgba(38, 29, 14, 0.08);
  --mf-fill-secondary:  rgba(38, 29, 14, 0.05);
  --mf-fill-tertiary:   rgba(38, 29, 14, 0.03);
  --mf-border:          #C4A878;
  --mf-border-light:    #D8BC94;
  --mf-hr-color:        #BCA070;
  --mf-accent:          #7A4218;
  --mf-accent-hover:    #5E3010;
  --mf-accent-light:    rgba(122, 66, 24, 0.10);
  --mf-accent-pressed:  rgba(122, 66, 24, 0.18);
  --mf-accent-subtle:   rgba(122, 66, 24, 0.06);
  --mf-link-color:      #7A4218;
  --mf-code-fg:         #8B3220;
  --mf-blockquote-border: #C0A070;
  --mf-blockquote-fg:   rgba(38, 29, 14, 0.52);
  --mf-selection:       rgba(122, 66, 24, 0.16);
  --mf-font-sans: Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif;
  --mf-font-display: "Palatino Linotype", Palatino, Georgia, "Book Antiqua", serif;
  --mf-font-size: 17px;
  --mf-line-height: 1.82;
  --mf-content-width: 680px;
  --mf-shadow-xs: 0 1px 2px rgba(38, 29, 14, 0.10);
  --mf-shadow-sm: 0 1px 3px rgba(38, 29, 14, 0.12), 0 1px 2px rgba(38, 29, 14, 0.06);
  --mf-shadow:    0 4px 20px rgba(38, 29, 14, 0.14), 0 1px 6px rgba(38, 29, 14, 0.06);
}`
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    cssText: `:root {
  --mf-bg:              #00213A;
  --mf-bg-secondary:    #002848;
  --mf-bg-tertiary:     #003259;
  --mf-bg-code:         #003054;
  --mf-bg-elevated:     #00304E;
  --mf-fg:              #A8CCDF;
  --mf-fg-secondary:    rgba(168, 204, 223, 0.65);
  --mf-fg-muted:        rgba(168, 204, 223, 0.40);
  --mf-heading-color:   #D8EEFF;
  --mf-fill:            rgba(168, 204, 223, 0.07);
  --mf-fill-secondary:  rgba(168, 204, 223, 0.04);
  --mf-fill-tertiary:   rgba(168, 204, 223, 0.025);
  --mf-border:          rgba(168, 204, 223, 0.18);
  --mf-border-light:    rgba(168, 204, 223, 0.10);
  --mf-hr-color:        rgba(168, 204, 223, 0.15);
  --mf-accent:          #FFC200;
  --mf-accent-hover:    #FFD44A;
  --mf-accent-light:    rgba(255, 194, 0, 0.12);
  --mf-accent-pressed:  rgba(255, 194, 0, 0.22);
  --mf-accent-subtle:   rgba(255, 194, 0, 0.07);
  --mf-link-color:      #FFC200;
  --mf-code-fg:         #FF9D44;
  --mf-blockquote-border: rgba(255, 194, 0, 0.32);
  --mf-blockquote-fg:   rgba(168, 204, 223, 0.55);
  --mf-selection:       rgba(255, 194, 0, 0.22);
  --mf-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.36);
  --mf-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.42), 0 1px 2px rgba(0, 0, 0, 0.28);
  --mf-shadow:    0 4px 20px rgba(0, 0, 0, 0.50), 0 2px 6px rgba(0, 0, 0, 0.32);
}`
  },
  {
    id: 'forest',
    name: 'Forest',
    cssText: `:root {
  --mf-bg:              #F2F6F0;
  --mf-bg-secondary:    #E6EDE2;
  --mf-bg-tertiary:     #D8E4D2;
  --mf-bg-code:         #EAF0E6;
  --mf-bg-elevated:     #F8FAF6;
  --mf-fg:              #1A2C1A;
  --mf-fg-secondary:    rgba(26, 44, 26, 0.62);
  --mf-fg-muted:        rgba(26, 44, 26, 0.40);
  --mf-heading-color:   #0E1E0E;
  --mf-fill:            rgba(26, 44, 26, 0.08);
  --mf-fill-secondary:  rgba(26, 44, 26, 0.05);
  --mf-fill-tertiary:   rgba(26, 44, 26, 0.03);
  --mf-border:          #B8CEAC;
  --mf-border-light:    #CCE0C0;
  --mf-hr-color:        #AABEA0;
  --mf-accent:          #2D7A3A;
  --mf-accent-hover:    #205E2C;
  --mf-accent-light:    rgba(45, 122, 58, 0.10);
  --mf-accent-pressed:  rgba(45, 122, 58, 0.18);
  --mf-accent-subtle:   rgba(45, 122, 58, 0.06);
  --mf-link-color:      #2D7A3A;
  --mf-code-fg:         #7A3B1A;
  --mf-blockquote-border: #A8C8A0;
  --mf-blockquote-fg:   rgba(26, 44, 26, 0.52);
  --mf-selection:       rgba(45, 122, 58, 0.15);
  --mf-shadow-xs: 0 1px 2px rgba(14, 30, 14, 0.08);
  --mf-shadow-sm: 0 1px 3px rgba(14, 30, 14, 0.10), 0 1px 2px rgba(14, 30, 14, 0.05);
  --mf-shadow:    0 4px 20px rgba(14, 30, 14, 0.12), 0 1px 6px rgba(14, 30, 14, 0.05);
}`
  },
  {
    id: 'rose',
    name: 'Rose Pine',
    cssText: `:root {
  --mf-bg:              #191724;
  --mf-bg-secondary:    #1F1D2E;
  --mf-bg-tertiary:     #26233A;
  --mf-bg-code:         #1F1D2E;
  --mf-bg-elevated:     #26233A;
  --mf-fg:              #E0DEF4;
  --mf-fg-secondary:    rgba(224, 222, 244, 0.62);
  --mf-fg-muted:        rgba(224, 222, 244, 0.38);
  --mf-heading-color:   #F0EEF8;
  --mf-fill:            rgba(224, 222, 244, 0.07);
  --mf-fill-secondary:  rgba(224, 222, 244, 0.04);
  --mf-fill-tertiary:   rgba(224, 222, 244, 0.025);
  --mf-border:          rgba(224, 222, 244, 0.12);
  --mf-border-light:    rgba(224, 222, 244, 0.07);
  --mf-hr-color:        rgba(224, 222, 244, 0.10);
  --mf-accent:          #C4A7E7;
  --mf-accent-hover:    #D8C0F8;
  --mf-accent-light:    rgba(196, 167, 231, 0.13);
  --mf-accent-pressed:  rgba(196, 167, 231, 0.22);
  --mf-accent-subtle:   rgba(196, 167, 231, 0.07);
  --mf-link-color:      #C4A7E7;
  --mf-code-fg:         #EB6F92;
  --mf-blockquote-border: rgba(196, 167, 231, 0.28);
  --mf-blockquote-fg:   rgba(224, 222, 244, 0.50);
  --mf-selection:       rgba(196, 167, 231, 0.20);
  --mf-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.32);
  --mf-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.38), 0 1px 2px rgba(0, 0, 0, 0.24);
  --mf-shadow:    0 4px 20px rgba(0, 0, 0, 0.46), 0 2px 6px rgba(0, 0, 0, 0.28);
}`
  },
  {
    id: 'solarized',
    name: 'Solarized',
    cssText: `:root {
  --mf-bg:              #FDF6E3;
  --mf-bg-secondary:    #F5EDCF;
  --mf-bg-tertiary:     #EDE5C4;
  --mf-bg-code:         #F0E8D2;
  --mf-bg-elevated:     #FFFBF0;
  --mf-fg:              #657B83;
  --mf-fg-secondary:    rgba(101, 123, 131, 0.75);
  --mf-fg-muted:        rgba(101, 123, 131, 0.50);
  --mf-heading-color:   #002B36;
  --mf-fill:            rgba(101, 123, 131, 0.09);
  --mf-fill-secondary:  rgba(101, 123, 131, 0.05);
  --mf-fill-tertiary:   rgba(101, 123, 131, 0.03);
  --mf-border:          #DDD3AB;
  --mf-border-light:    #EBE2C0;
  --mf-hr-color:        #D4CAAA;
  --mf-accent:          #268BD2;
  --mf-accent-hover:    #1A6EAA;
  --mf-accent-light:    rgba(38, 139, 210, 0.10);
  --mf-accent-pressed:  rgba(38, 139, 210, 0.18);
  --mf-accent-subtle:   rgba(38, 139, 210, 0.06);
  --mf-link-color:      #268BD2;
  --mf-code-fg:         #DC322F;
  --mf-blockquote-border: #B5AC84;
  --mf-blockquote-fg:   rgba(101, 123, 131, 0.70);
  --mf-selection:       rgba(38, 139, 210, 0.15);
  --mf-shadow-xs: 0 1px 2px rgba(0, 43, 54, 0.08);
  --mf-shadow-sm: 0 1px 3px rgba(0, 43, 54, 0.10), 0 1px 2px rgba(0, 43, 54, 0.05);
  --mf-shadow:    0 4px 20px rgba(0, 43, 54, 0.12), 0 1px 6px rgba(0, 43, 54, 0.05);
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
    ipcMain.removeHandler('get-theme-state')
    ipcMain.removeHandler('get-current-theme')
    ipcMain.removeHandler('set-theme')
    ipcMain.removeHandler('set-theme-for-appearance')
    ipcMain.removeHandler('set-theme-appearance-preference')

    ipcMain.handle('get-themes', () => this.getThemes())
    ipcMain.handle('get-theme-state', () => this.getThemeState())
    ipcMain.handle('get-current-theme', () => this.getCurrentTheme())
    ipcMain.handle('set-theme', async (_event, themeId: string) => this.setTheme(themeId))
    // Legacy handlers — kept so old renderers don't crash on missing channel
    ipcMain.handle('set-theme-for-appearance', async (_event, _appearance: string, themeId: string) =>
      this.setTheme(themeId),
    )
    ipcMain.handle('set-theme-appearance-preference', async () => this.getThemeState())
  }

  async initialize() {
    this.ensureThemeFiles()
    this.currentThemeId = this.readPersistedThemeId()
    await this.watchThemeFile(this.currentThemeId)
  }

  async dispose() {
    if (!this.watcher) return
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
      this.findTheme(this.currentThemeId) ?? this.findTheme(DEFAULT_THEME_ID)
    return {
      activeThemeId: theme?.id ?? DEFAULT_THEME_ID,
      activeTheme: theme ? this.readThemePayload(theme) : null,
    }
  }

  async setTheme(themeId: string): Promise<MarkFlowThemePayload | null> {
    this.ensureThemeFiles()
    const theme = this.findTheme(themeId)
    if (!theme) return null

    this.currentThemeId = theme.id
    this.persistThemeState()
    await this.watchThemeFile(theme.id)

    const state = this.getThemeState()
    if (state) this.emitThemeState(state)
    return state?.activeTheme ?? null
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
          name: BUILTIN_THEMES.find((t) => t.id === id)?.name ?? formatThemeName(id),
          filePath: path.join(this.themeDir, entry.name),
        }
      })
      .sort((a, b) => {
        // Claude first, then alphabetical
        if (a.id === DEFAULT_THEME_ID) return -1
        if (b.id === DEFAULT_THEME_ID) return 1
        return a.name.localeCompare(b.name)
      })
  }

  private findTheme(themeId: string) {
    return this.readThemeFiles().find((t) => t.id === themeId) ?? null
  }

  private readThemePayload(theme: ThemeFile): MarkFlowThemePayload {
    return {
      id: theme.id,
      name: theme.name,
      cssText: fs.readFileSync(theme.filePath, 'utf8'),
    }
  }

  private readPersistedThemeId(): string {
    try {
      const raw = fs.readFileSync(this.statePath, 'utf8')
      const state = JSON.parse(raw) as PersistedThemeState
      // Accept both new "themeId" and legacy "lightThemeId"
      const id = state.themeId ?? (state as Record<string, unknown>)['lightThemeId']
      return this.findTheme(String(id ?? ''))?.id ?? DEFAULT_THEME_ID
    } catch {
      return DEFAULT_THEME_ID
    }
  }

  private persistThemeState() {
    const state: PersistedThemeState = { themeId: this.currentThemeId }
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf8')
  }

  private async watchThemeFile(themeId: string) {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    const theme = this.findTheme(themeId)
    if (!theme) return

    this.watcher = chokidar.watch(theme.filePath, { ignoreInitial: true })
    this.watcher.on('change', () => {
      const state = this.getThemeState()
      if (state) this.emitThemeState(state)
    })
  }

  private emitThemeState(state: MarkFlowThemeState) {
    this.window.webContents.send('theme-updated', state)
  }
}
