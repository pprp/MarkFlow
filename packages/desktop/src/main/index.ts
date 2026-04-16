import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { FileManager } from './fileManager'
import type { MarkFlowMenuAction, MarkFlowMenuActionPayload, MarkFlowWindowState } from '@markflow/shared'
import { createWindowOpenHandler, handleWillNavigate } from './externalLinks'
import { ThemeManager } from './themeManager'
import { SpellCheckManager } from './spellCheckManager'
import { ImageUploadManager } from './imageUploadManager'
import { createApplicationMenuTemplate } from './menu'
import { WindowStateManager } from './windowStateManager'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const PRIMARY_WINDOW_STATE_ID = 'primary'

let mainWindow: BrowserWindow | null = null
let fileManager: FileManager
let themeManager: ThemeManager | null = null
let spellCheckManager: SpellCheckManager | null = null
let imageUploadManager: ImageUploadManager | null = null
let windowStateManager: WindowStateManager | null = null
let pendingOpenFilePath: string | null = null

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

function queueFileOpen(filePath: string) {
  pendingOpenFilePath = filePath
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    flushPendingFileOpen()
  }
}

function flushPendingFileOpen() {
  if (!pendingOpenFilePath || !mainWindow) return

  const filePath = pendingOpenFilePath
  pendingOpenFilePath = null

  if (fs.existsSync(filePath)) {
    fileManager.openPath(filePath)
  }
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
  fileManager.registerIpcHandlers()
  fileManager.markSessionStarted()
  themeManager = new ThemeManager(mainWindow, app.getPath('userData'))
  themeManager.registerIpcHandlers()
  void themeManager.initialize()
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
    flushPendingFileOpen()
    sendWindowState()
  })
}

function buildMenu() {
  const openRecent = fileManager?.getOpenRecentMenuState()
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate({
        canRevealCurrentFile: () => fileManager?.canRevealCurrentFile() ?? false,
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

const cliFile = process.argv.find((arg) => arg.endsWith('.md'))
if (cliFile && fs.existsSync(cliFile)) {
  queueFileOpen(cliFile)
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
  queueFileOpen(filePath)

  if (app.isReady() && !mainWindow) {
    createWindow()
  }
})
