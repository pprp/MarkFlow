import { app, BrowserWindow, shell, Menu } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { FileManager } from './fileManager'
import type { MarkFlowMenuAction } from '@markflow/shared'
import { createWindowOpenHandler, handleWillNavigate } from './externalLinks'
import { ThemeManager } from './themeManager'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let fileManager: FileManager
let themeManager: ThemeManager | null = null
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

  fileManager = new FileManager(mainWindow)
  fileManager.registerIpcHandlers()
  themeManager = new ThemeManager(mainWindow, app.getPath('userData'))
  themeManager.registerIpcHandlers()
  void themeManager.initialize()
  buildMenu()

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'editor', 'index.html'))
  }

  mainWindow.on('closed', () => {
    void themeManager?.dispose()
    themeManager = null
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
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-file') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open-file') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save-file') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('save-file-as') },
        { type: 'separator' },
        { label: 'Export as HTML…', click: () => sendMenuAction('export-html') },
        { label: 'Export as PDF…', click: () => sendMenuAction('export-pdf') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const cliFile = process.argv.find((arg) => arg.endsWith('.md'))
if (cliFile && fs.existsSync(cliFile)) {
  queueFileOpen(cliFile)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
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
