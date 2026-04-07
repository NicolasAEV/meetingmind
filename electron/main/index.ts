import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Store from 'electron-store'
import { setupAudioIPC }       from '../services/audio/index.js'
import { setupTranscriberIPC } from '../services/transcription/engine.js'
import { setupLLMIPC }         from '../services/ai/orchestrator.js'
import type { AppSettings }    from '../../src/types.js'
import { DEFAULT_SETTINGS }    from '../../src/constants/settings.js'

// ─── Paths ────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env['APP_ROOT'] = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST       = path.join(process.env['APP_ROOT'], 'dist')
const PRELOAD_PATH        = path.join(__dirname, 'preload.cjs')

process.env['VITE_PUBLIC'] = VITE_DEV_SERVER_URL
  ? path.join(process.env['APP_ROOT'], 'public')
  : RENDERER_DIST

// ─── Persistent settings via electron-store ───────────────────────────────────
const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS,
})

// ─── Window ───────────────────────────────────────────────────────────────────
let win: BrowserWindow | null = null

function createWindow(): void {
  const savedOpacity = (store.get('opacity') as number | undefined) ?? 0.95

  win = new BrowserWindow({
    width:            1400,
    height:           900,
    minWidth:         960,
    minHeight:        600,
    frame:            false,     // Custom title bar
    transparent:      true,      // Allows glass-morphism effects
    backgroundColor: '#00000000',
    opacity:          savedOpacity,
    show:             false,     // Show after content loads
    webPreferences: {
      preload:          PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,   // Required for preload to import Node modules
    },
  })

  // ── Load app ───────────────────────────────────────────────────────────────
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Show window once content is painted (avoids white flash)
  win.once('ready-to-show', () => {
    win?.show()
    if ((store.get('alwaysOnTop') as boolean | undefined) === true) {
      win?.setAlwaysOnTop(true, 'screen-saver')
    }
  })

  // Open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // ── IPC: window controls ──────────────────────────────────────────────────
  ipcMain.handle('window:minimize', () => win?.minimize())

  ipcMain.handle('window:maximize', () => {
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })

  ipcMain.handle('window:close', () => win?.close())

  ipcMain.handle('window:set-opacity', (_e, opacity: number) => {
    const clamped = Math.max(0.2, Math.min(1, opacity))
    win?.setOpacity(clamped)
    store.set('opacity', clamped)
  })

  ipcMain.handle('window:set-always-on-top', (_e, value: boolean) => {
    win?.setAlwaysOnTop(value, 'screen-saver')
    store.set('alwaysOnTop', value)
  })

  // ── IPC: settings ─────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => store.store)

  ipcMain.handle('settings:save', (_e, patch: Partial<AppSettings>) => {
    for (const [key, value] of Object.entries(patch)) {
      store.set(key as keyof AppSettings, value)
    }
  })

  // ── Feature IPC ───────────────────────────────────────────────────────────
  setupAudioIPC()
  setupTranscriberIPC(win)
  setupLLMIPC(win)

  // Cleanup handlers when window closes
  win.on('closed', () => {
    ipcMain.removeHandler('window:minimize')
    ipcMain.removeHandler('window:maximize')
    ipcMain.removeHandler('window:close')
    ipcMain.removeHandler('window:set-opacity')
    ipcMain.removeHandler('window:set-always-on-top')
    ipcMain.removeHandler('settings:get')
    ipcMain.removeHandler('settings:save')
    ipcMain.removeHandler('audio:get-sources')
    ipcMain.removeHandler('ollama:list-models')
    win = null
  })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
