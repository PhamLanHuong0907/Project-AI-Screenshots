import fs from 'fs'
import path from 'path'
import { dialog, ipcMain, BrowserWindow } from 'electron'
import { z } from 'zod'
import { ScreenshotWatcher } from '../services/screenshotWatcher'
import { SettingsService } from '../services/settingsService'

export function registerSystemHandlers(
  watcher: ScreenshotWatcher,
  settingsService: SettingsService,
  getMainWindow: () => BrowserWindow | null,
  getQuickPopupWindow?: () => BrowserWindow | null
): void {
  ipcMain.handle('system:selectFolder', async (_event, defaultPath?: unknown) => {
    const win = getMainWindow()
    const safeDefault =
      typeof defaultPath === 'string' && defaultPath.trim().length > 0
        ? defaultPath.trim()
        : undefined

    const options: Electron.OpenDialogOptions = {
      title: 'Select Folder',
      defaultPath: safeDefault,
      properties: ['openDirectory', 'createDirectory']
    }

    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle('system:toggleMonitoring', async (_event, rawEnable: unknown) => {
    const enable = z.boolean().parse(rawEnable)
    if (enable) {
      return await watcher.start()
    } else {
      return await watcher.stop()
    }
  })

  ipcMain.handle('system:getPhysicalFolders', async (_event, targetRootPath?: unknown) => {
    try {
      const settings = settingsService.getPublicSettings()
      const rootDir =
        typeof targetRootPath === 'string' && targetRootPath.trim()
          ? targetRootPath.trim()
          : settings.destinationFolder

      if (!rootDir || !fs.existsSync(rootDir)) {
        return []
      }

      const results: string[] = []

      // Scan up to depth 3 to find real subfolders on disk
      async function scanDir(currentDir: string, currentRelative: string, depth: number): Promise<void> {
        if (depth > 3) return
        try {
          const entries = await fs.promises.readdir(currentDir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory()) {
              // Ignore hidden directories like .git or .temp
              if (entry.name.startsWith('.')) continue
              const relPath = currentRelative ? `${currentRelative}/${entry.name}` : entry.name
              results.push(relPath)
              await scanDir(path.join(currentDir, entry.name), relPath, depth + 1)
            }
          }
        } catch {
          // Ignore permissions or inaccessible directories
        }
      }

      await scanDir(rootDir, '', 1)
      return results.sort()
    } catch {
      return []
    }
  })

  ipcMain.handle('system:createPhysicalFolder', async (_event, folderName: unknown) => {
    try {
      const clean = z.string().min(1).parse(folderName).trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
      if (!clean) return false
      const settings = settingsService.getPublicSettings()
      const rootDir = settings.destinationFolder
      if (rootDir) {
        const fullPath = path.join(rootDir, clean)
        await fs.promises.mkdir(fullPath, { recursive: true })
      }
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('system:closeQuickPopup', () => {
    const popup = getQuickPopupWindow?.()
    if (popup && !popup.isDestroyed()) {
      popup.hide()
    }
  })

  ipcMain.handle('system:openMainWindow', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
}
