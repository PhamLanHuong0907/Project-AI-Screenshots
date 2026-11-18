import 'dotenv/config'
import path from 'path'
import { app, BrowserWindow, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron'

// Suppress transient Chromium disk-cache lock warnings on Windows development reload
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
if (!app.isPackaged) {
  app.commandLine.appendSwitch('disable-http-cache')
}

import { closeDatabase, initDatabase } from './database/database'
import { ScreenshotRepository } from './database/screenshotRepository'
import { registerScreenshotHandlers } from './ipc/screenshotHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'
import { registerSystemHandlers } from './ipc/systemHandlers'
import { AIService } from './services/aiService'
import { FileOrganizer } from './services/fileOrganizer'
import { ImageService } from './services/imageService'
import { MetadataService } from './services/metadataService'
import { ScreenshotWatcher } from './services/screenshotWatcher'
import { SettingsService } from './services/settingsService'
import type { ScreenshotRecord, WatcherStatusEvent } from '../renderer/src/types/screenshot'

let mainWindow: BrowserWindow | null = null
let quickPopupWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let watcherInstance: ScreenshotWatcher | null = null

function getIconPath(): string {
  return path.join(__dirname, '../../resources/icon.png')
}

function createWindow(startMinimized = false): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'AI Screenshot Manager',
    icon: getIconPath(),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => {
    if (startMinimized) {
      win.minimize()
    } else {
      win.show()
    }
  })

  // Keep running in background / System Tray when the user closes the main window
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * Creates the floating Always-on-Top Quick-Confirm Popup Window at the bottom-right of the screen.
 * Allows the user to immediately inspect/edit the AI-generated filename and click Confirm
 * right after taking a screenshot without opening the main window.
 */
function createQuickPopupWindow(): BrowserWindow {
  const popupWidth = 440
  const popupHeight = 310

  const popup = new BrowserWindow({
    width: popupWidth,
    height: popupHeight,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'AI Screenshot Quick Confirm',
    icon: getIconPath(),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  popup.setAlwaysOnTop(true, 'screen-saver')
  popup.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void popup.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#quick-popup`)
  } else {
    void popup.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'quick-popup'
    })
  }

  return popup
}

function showQuickPopupAtBottomRight(focusWindow = false): void {
  if (!quickPopupWindow || quickPopupWindow.isDestroyed()) {
    quickPopupWindow = createQuickPopupWindow()
  }

  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workArea
    const [w, h] = quickPopupWindow.getSize()
    const x = Math.max(workArea.x + 16, workArea.x + workArea.width - w - 20)
    const y = Math.max(workArea.y + 16, workArea.y + workArea.height - h - 20)
    quickPopupWindow.setPosition(x, y, false)
  } catch {
    // Ignore display positioning errors
  }

  quickPopupWindow.setAlwaysOnTop(true, 'screen-saver')
  if (focusWindow) {
    quickPopupWindow.show()
    quickPopupWindow.focus()
  } else {
    quickPopupWindow.showInactive()
  }
}

function setupSystemTray(watcher: ScreenshotWatcher): void {
  try {
    const icon = nativeImage.createFromPath(getIconPath())
    tray = new Tray(icon)
    tray.setToolTip('AI Screenshot Manager — Đang theo dõi ảnh chụp màn hình')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Mở AI Screenshot Manager',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      },
      {
        label: 'Hiện hộp thoại xác nhận nhanh',
        click: () => {
          showQuickPopupAtBottomRight(true)
        }
      },
      {
        label: 'Bắt ảnh từ Clipboard (Win+Shift+S)',
        click: () => {
          void watcher.captureFromClipboard(true)
        }
      },
      { type: 'separator' },
      {
        label: 'Thoát hoàn toàn',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])

    tray.setContextMenu(contextMenu)
    tray.on('double-click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
      }
    })
  } catch (err) {
    console.error('Failed to initialize system tray:', err)
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.aiscreenshotmanager.app')
  }

  // 1. Initialize SQLite database in Electron userData directory
  const dbPath = path.join(app.getPath('userData'), 'ai-screenshot-manager.db')
  const db = initDatabase(dbPath)

  // 2. Initialize core services and repositories
  const repository = new ScreenshotRepository(db)
  const settingsService = new SettingsService()
  const imageService = new ImageService()
  const metadataService = new MetadataService(imageService)
  const aiService = new AIService(settingsService, imageService)
  const fileOrganizer = new FileOrganizer(repository, settingsService)
  const watcher = new ScreenshotWatcher(
    repository,
    settingsService,
    metadataService,
    aiService,
    fileOrganizer
  )
  fileOrganizer.setWatcher(watcher)
  watcherInstance = watcher

  // 3. Wire watcher real-time events to Renderer & Floating Quick-Confirm Popup
  watcher.on('new-screenshot', (record: ScreenshotRecord) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screenshots:new', record)
    }
    if (quickPopupWindow && !quickPopupWindow.isDestroyed()) {
      quickPopupWindow.webContents.send('screenshots:new', record)
    }
    // Immediately pop up the floating notification at bottom-right when a screenshot is captured!
    showQuickPopupAtBottomRight(record.status === 'review')
  })

  watcher.on('screenshot-updated', (record: ScreenshotRecord) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screenshots:updated', record)
    }
    if (quickPopupWindow && !quickPopupWindow.isDestroyed()) {
      quickPopupWindow.webContents.send('screenshots:updated', record)
    }

    // When AI finishes generating the filename (status === 'review') or fails, show and focus the popup
    // so the user can check the AI-generated filename and click Confirm right away!
    if (record.status === 'review' || record.status === 'failed') {
      showQuickPopupAtBottomRight(true)
    }

    const currentSettings = settingsService.getPublicSettings()
    if (currentSettings.enableNotifications && Notification.isSupported()) {
      try {
        if (record.status === 'saved') {
          new Notification({
            title: 'Đã đổi tên ảnh thành công!',
            body: `${record.original_name} → ${record.final_name}`
          }).show()
        } else if (record.status === 'review') {
          const notif = new Notification({
            title: `AI gợi ý tên: ${record.suggested_name}`,
            body: `Danh mục: ${record.category} — Nhấn để kiểm tra & xác nhận đổi tên`
          })
          notif.on('click', () => {
            showQuickPopupAtBottomRight(true)
          })
          notif.show()
        }
      } catch {
        // Ignore notification error
      }
    }
  })

  watcher.on('status', (status: WatcherStatusEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('watcher:status', status)
    }
  })

  // 4. Register secure IPC handlers
  registerScreenshotHandlers(
    repository,
    watcher,
    fileOrganizer,
    imageService,
    settingsService,
    () => mainWindow,
    () => quickPopupWindow
  )
  registerSettingsHandlers(settingsService, watcher, aiService)
  registerSystemHandlers(
    watcher,
    settingsService,
    () => mainWindow,
    () => quickPopupWindow
  )

  // 5. Create main application window, floating quick-confirm popup, and System Tray
  const initialSettings = settingsService.getPublicSettings()
  mainWindow = createWindow(initialSettings.startMinimized)
  quickPopupWindow = createQuickPopupWindow()
  setupSystemTray(watcher)

  // 6. Start automatic folder monitoring if enabled
  if (initialSettings.autoMonitorOnStartup) {
    await watcher.start(initialSettings.sourceFolder)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(false)
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

app.on('before-quit', async () => {
  isQuitting = true
  if (watcherInstance) {
    await watcherInstance.stop()
  }
  closeDatabase()
})
