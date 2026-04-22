import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import * as path from 'path'
import { FileManager } from './fileManager'
import type { MarkFlowMenuAction, MarkFlowMenuActionPayload, MarkFlowWindowState } from '@markflow/shared'
import { createWindowOpenHandler, handleWillNavigate } from './externalLinks'
import { ThemeManager } from './themeManager'
import { SpellCheckManager } from './spellCheckManager'
import { ImageUploadManager } from './imageUploadManager'
import { createApplicationMenuTemplate } from './menu'
import { WindowStateManager } from './windowStateManager'
import { installCliTool, isCliToolInstalled } from './cliInstaller'
import {
  parseLaunchArgumentsFromArgv,
  parseLaunchTargetsFromArgv,
  type LaunchStartupBehaviorOverride,
  type LaunchTarget,
} from './launchTargets'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const PRIMARY_WINDOW_STATE_ID = 'primary'

let mainWindow: BrowserWindow | null = null
let fileManager: FileManager
let themeManager: ThemeManager | null = null
let spellCheckManager: SpellCheckManager | null = null
let imageUploadManager: ImageUploadManager | null = null
let windowStateManager: WindowStateManager | null = null
let pendingLaunchTargets: LaunchTarget[] = []
let initialStartupBehaviorOverride: LaunchStartupBehaviorOverride | null = null

function sendMenuAction(action: MarkFlowMenuAction, payload: Omit<MarkFlowMenuActionPayload, 'action'> = {}) {
  mainWindow?.webContents.send('menu-action', { action, ...payload })
}

function getWindowState(): MarkFlowWindowState {
  return {
    isAlwaysOnTop: mainWindow?.isAlwaysOnTop() ?? false,
    isFullscreen: mainWindow?.isFullScreen() ?? false,
  }
}

function sendWindowState() {
  mainWindow?.webContents.send('window-state-changed', getWindowState())
}

function toggleFullscreen() {
  if (!mainWindow) {
    return
  }

  mainWindow.setFullScreen(!mainWindow.isFullScreen())
}

async function toggleAlwaysOnTop() {
  if (!windowStateManager) {
    return
  }

  await windowStateManager.toggleAlwaysOnTop()
}

async function openPendingTarget(target: LaunchTarget) {
  if (target.kind === 'file') {
    await fileManager.openExistingPath(target.path)
    return
  }

  const openedFolder = await fileManager.openExistingFolderPath(target.path)
  if (openedFolder) {
    sendMenuAction('open-recent-folder', { path: openedFolder.folderPath })
  }
}

async function flushPendingLaunchTargets() {
  if (!mainWindow || mainWindow.webContents.isLoading() || pendingLaunchTargets.length === 0) {
    return
  }

  const targets = [...pendingLaunchTargets]
  pendingLaunchTargets = []

  for (const target of targets) {
    await openPendingTarget(target)
  }
}

function queueLaunchTarget(target: LaunchTarget) {
  const isDuplicate = pendingLaunchTargets.some(
    (pendingTarget) => pendingTarget.kind === target.kind && pendingTarget.path === target.path,
  )
  if (!isDuplicate) {
    pendingLaunchTargets.push(target)
  }

  if (mainWindow && !mainWindow.webContents.isLoading()) {
    void flushPendingLaunchTargets()
  }
}

function queueLaunchPath(candidatePath: string) {
  const targets = parseLaunchTargetsFromArgv([candidatePath])
  if (!targets[0]) {
    return
  }

  queueLaunchTarget(targets[0])
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FFFFFF',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  fileManager = new FileManager(mainWindow, () => buildMenu())
  fileManager.setStartupLaunchBehaviorOverride(initialStartupBehaviorOverride)
  fileManager.registerIpcHandlers()
  fileManager.markSessionStarted()
  themeManager = new ThemeManager(mainWindow, app.getPath('userData'))
  themeManager.registerIpcHandlers()
  void themeManager.initialize().then(() => {
    buildMenu()
  })
  spellCheckManager = new SpellCheckManager(mainWindow, app.getPath('userData'))
  spellCheckManager.registerIpcHandlers()
  void spellCheckManager.initialize()
  imageUploadManager = new ImageUploadManager(app.getPath('userData'))
  imageUploadManager.registerIpcHandlers()
  void imageUploadManager.initialize()
  windowStateManager = new WindowStateManager(mainWindow, app.getPath('userData'), PRIMARY_WINDOW_STATE_ID, () => {
    buildMenu()
    sendWindowState()
  })
  void windowStateManager.initialize()
  buildMenu()

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'editor', 'index.html'))
  }

  mainWindow.on('closed', () => {
    fileManager.dispose()
    void themeManager?.dispose()
    themeManager = null
    spellCheckManager = null
    imageUploadManager = null
    windowStateManager?.dispose()
    windowStateManager = null
    mainWindow = null
  })

  mainWindow.on('enter-full-screen', sendWindowState)
  mainWindow.on('leave-full-screen', sendWindowState)

  // Handle file drops
  mainWindow.webContents.on('will-navigate', (event, url) => {
    handleWillNavigate(event, url, shell.openExternal)
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(createWindowOpenHandler(shell.openExternal))

  mainWindow.webContents.once('did-finish-load', () => {
    sendWindowState()
    void flushPendingLaunchTargets()
  })
}

function buildMenu() {
  const openRecent = fileManager?.getOpenRecentMenuState()
  const launchOptions = fileManager?.getLaunchOptionsMenuState()
  const nextThemeState = themeManager?.getThemeState() ?? null
  const nextThemes = themeManager?.getThemes() ?? []
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate({
        appearanceMenu:
          nextThemeState
            ? {
                activeThemeId:
                  nextThemeState.activeThemeId ??
                  nextThemeState.activeTheme?.id ??
                  nextThemeState.lightThemeId,
                themes: nextThemes,
                selectTheme: (themeId) => {
                  void themeManager?.setTheme(themeId).then(() => {
                    buildMenu()
                  })
                },
              }
            : null,
        canRevealCurrentFile: () => fileManager?.canRevealCurrentFile() ?? false,
        launchOptions: launchOptions ?? {
          behavior: 'open-new-file',
          defaultFolderPath: null,
          chooseDefaultFolder: () => {},
          clearDefaultFolder: () => {},
          selectBehavior: () => {},
        },
        openRecent: openRecent ?? {
          pinnedFolders: [],
          recentEntries: [],
          pinnableFolders: [],
          canClearItems: false,
          canClearAll: false,
          openEntry: () => {},
          pinFolder: () => {},
          unpinFolder: () => {},
          clearItems: () => {},
          clearAll: () => {},
        },
        revealCurrentFileInFolder: () => fileManager?.revealCurrentFileInFolder() ?? false,
        sendMenuAction: (action) => sendMenuAction(action),
        installCliTool: () => { void installCliTool() },
        isCliToolInstalled,
        isAlwaysOnTop: windowStateManager?.isAlwaysOnTop() ?? false,
        toggleAlwaysOnTop: () => {
          void toggleAlwaysOnTop()
        },
        toggleFullscreen,
      }),
    ),
  )
}

ipcMain.handle('get-window-state', () => getWindowState())

const launchArguments = parseLaunchArgumentsFromArgv(isDev ? process.argv.slice(2) : process.argv.slice(1))
initialStartupBehaviorOverride = launchArguments.startupBehaviorOverride
for (const target of launchArguments.targets) {
  queueLaunchTarget(target)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  fileManager?.markSessionClosed()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Handle file open from macOS Finder
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  queueLaunchPath(filePath)

  if (app.isReady() && !mainWindow) {
    createWindow()
  }
})
