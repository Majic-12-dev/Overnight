import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import { update } from './update'
import {
  mergePdf,
  splitPdf,
  rotatePdf,
  watermarkPdf,
  updateMetadata,
  compressPdf,
  encryptPdf,
  repairPdf,
} from './tools/pdf'
import {
  convertImages,
  resizeImages,
  compressImages,
  imagesToPdf,
  stripExif,
  filterImages,
  renameImages,
} from './tools/image'
import { mergeTextFiles } from './tools/text'
import { bulkRename, deleteEmptyFolders, scanLargeFiles, organizeFiles, deleteFiles } from './tools/file'
import { checksumFiles, processSecurity } from './tools/security'
import { processArchive } from './tools/archive'
import { ensureDir } from './utils/fs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId('com.docflow.pro')

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'DocFlow Pro',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

ipcMain.handle('app:get-default-output-dir', async () => {
  const outputDir = path.join(app.getPath('documents'), 'DocFlow Pro', 'Output')
  await ensureDir(outputDir)
  return outputDir
})

ipcMain.handle('app:select-output-dir', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

ipcMain.handle('app:select-file', async (_, payload: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    title: payload?.title,
    filters: payload?.filters,
  })
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

ipcMain.handle('app:reveal-path', async (_, targetPath: string) => {
  if (!targetPath) return
  try {
    const stats = await fs.stat(targetPath)
    if (stats.isDirectory()) {
      await shell.openPath(targetPath)
      return
    }
  } catch (error) {
    // Fall back to reveal below.
  }
  shell.showItemInFolder(targetPath)
})

ipcMain.handle('pdf:merge', async (_, payload) => mergePdf(payload))
ipcMain.handle('pdf:split', async (_, payload) => splitPdf(payload))
ipcMain.handle('pdf:rotate', async (_, payload) => rotatePdf(payload))
ipcMain.handle('pdf:watermark', async (_, payload) => watermarkPdf(payload))
ipcMain.handle('pdf:metadata', async (_, payload) => updateMetadata(payload))
ipcMain.handle('pdf:encrypt', async (_, payload) => encryptPdf(payload))
ipcMain.handle('pdf:compress', async (_, payload) => compressPdf(payload))
ipcMain.handle('pdf:repair', async (_, payload) => repairPdf(payload))

ipcMain.handle('image:convert', async (_, payload) => convertImages(payload))
ipcMain.handle('image:resize', async (_, payload) => resizeImages(payload))
ipcMain.handle('image:compress', async (_, payload) => compressImages(payload))
ipcMain.handle('image:to-pdf', async (_, payload) => imagesToPdf(payload))
ipcMain.handle('image:strip-exif', async (_, payload) => stripExif(payload))
ipcMain.handle('image:filter', async (_, payload) => filterImages(payload))
ipcMain.handle('image:rename', async (_, payload) => renameImages(payload))

ipcMain.handle('text:merge', async (_, payload) => mergeTextFiles(payload))

ipcMain.handle('file:bulk-rename', async (_, payload) => bulkRename(payload))
ipcMain.handle('file:delete-empty', async (_, payload) => deleteEmptyFolders(payload))
ipcMain.handle('file:scan-large', async (_, payload) => scanLargeFiles(payload))
ipcMain.handle('file:organize', async (_, payload) => organizeFiles(payload))
ipcMain.handle('file:delete', async (_, payload: { items: { sourcePath: string }[] }) => {
  const documentsDir = app.getPath('documents')
  const trashBaseDir = path.join(documentsDir, 'DocFlow Pro', '.docflow_trash')
  return deleteFiles({ items: payload.items }, trashBaseDir)
})

ipcMain.handle('security:checksum', async (_, payload) => checksumFiles(payload))
ipcMain.handle('security:process', async (_, payload) => processSecurity(payload))
ipcMain.handle('archive:process', async (_, payload) => processArchive(payload))