import { app, BrowserWindow, shell, Menu } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { FileManager } from './fileManager'
import type { MarkFlowMenuAction } from '@markflow/shared'
import { createWindowOpenHandler, handleWillNavigate } from './externalLinks'
import { ThemeManager } from './themeManager'
import { SpellCheckManager } from './spellCheckManager'
import { ImageUploadManager } from './imageUploadManager'
import { createApplicationMenuTemplate } from './menu'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let fileManager: FileManager
let themeManager: ThemeManager | null = null
let spellCheckManager: SpellCheckManager | null = null
let imageUploadManager: ImageUploadManager | null = null
let pendingOpenFilePath: string | null = null

function sendMenuAction(action: MarkFlowMenuAction) {
  mainWindow?.webContents.send('menu-action', { action })
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
    mainWindow = null
  })

  // Handle file drops
  mainWindow.webContents.on('will-navigate', (event, url) => {
    handleWillNavigate(event, url, shell.openExternal)
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(createWindowOpenHandler(shell.openExternal))

  mainWindow.webContents.once('did-finish-load', () => {
    flushPendingFileOpen()
  })
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate({
        canRevealCurrentFile: () => fileManager?.canRevealCurrentFile() ?? false,
        revealCurrentFileInFolder: () => fileManager?.revealCurrentFileInFolder() ?? false,
        sendMenuAction,
      }),
    ),
  )
}

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
