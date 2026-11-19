import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { dialog, ipcMain, BrowserWindow } from 'electron'
import { z } from 'zod'
import { ScreenshotWatcher } from '../services/screenshotWatcher'
import { SettingsService } from '../services/settingsService'

const execFileAsync = promisify(execFile)

function resolveOllamaBinary(): string | null {
  const localAppData = process.env.LOCALAPPDATA || ''
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const candidates = [
    path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
    path.join(programFiles, 'Ollama', 'ollama.exe')
  ]
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

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

  ipcMain.handle('system:installOllama', async () => {
    const existing = resolveOllamaBinary()
    if (existing) {
      return {
        success: true,
        message: `Ollama đã được cài đặt sẵn trên máy (${existing}).`
      }
    }

    try {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          'irm https://ollama.com/install.ps1 | iex'
        ],
        { timeout: 600000, windowsHide: false }
      )
      return {
        success: true,
        message: 'Đã cài đặt Ollama thành công! Bạn có thể bấm "Tải Model" ngay bây giờ.'
      }
    } catch (err) {
      return {
        success: false,
        message: `Không thể cài đặt Ollama tự động: ${(err as Error).message}`
      }
    }
  })

  ipcMain.handle('system:pullOllamaModel', async (_event, rawModel: unknown) => {
    const model = z.string().min(1).max(80).parse(rawModel).trim()
    const exePath = resolveOllamaBinary() || 'ollama'

    try {
      await execFileAsync(exePath, ['pull', model], {
        timeout: 900000,
        windowsHide: true
      })
      return {
        success: true,
        message: `Đã tải xong model "${model}"! Bấm "Kiểm tra Ollama" để xác nhận.`
      }
    } catch (err) {
      return {
        success: false,
        message: `Lỗi tải model "${model}": ${(err as Error).message}`
      }
    }
  })
}
