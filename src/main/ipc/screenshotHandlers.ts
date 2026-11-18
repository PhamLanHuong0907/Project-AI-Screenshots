import fs from 'fs'
import { ipcMain, Notification, shell, BrowserWindow } from 'electron'
import { ScreenshotRepository } from '../database/screenshotRepository'
import { FileOrganizer } from '../services/fileOrganizer'
import { ImageService } from '../services/imageService'
import { ScreenshotWatcher } from '../services/screenshotWatcher'
import { SettingsService } from '../services/settingsService'
import {
  ConfirmScreenshotSchema,
  IpcIdSchema,
  SearchScreenshotsQuerySchema,
  UpdateScreenshotSchema
} from '../utils/validation'

export function registerScreenshotHandlers(
  repository: ScreenshotRepository,
  watcher: ScreenshotWatcher,
  fileOrganizer: FileOrganizer,
  imageService: ImageService,
  settingsService: SettingsService,
  getMainWindow: () => BrowserWindow | null,
  getQuickPopupWindow?: () => BrowserWindow | null
): void {
  const broadcastUpdate = (record: unknown): void => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('screenshots:updated', record)
    }
    const popup = getQuickPopupWindow?.()
    if (popup && !popup.isDestroyed()) {
      popup.webContents.send('screenshots:updated', record)
    }
  }

  ipcMain.handle('screenshots:getDashboardStats', () => {
    return repository.getDashboardStats()
  })

  ipcMain.handle('screenshots:getAll', () => {
    return repository.findAll()
  })

  ipcMain.handle('screenshots:getPending', () => {
    return repository.findPendingQueue()
  })

  ipcMain.handle('screenshots:analyze', async (_event, rawId: unknown) => {
    const id = IpcIdSchema.parse(rawId)
    return await watcher.enqueueAnalysis(id, false)
  })

  ipcMain.handle('screenshots:retry', async (_event, rawId: unknown) => {
    const id = IpcIdSchema.parse(rawId)
    return await watcher.enqueueAnalysis(id, true)
  })

  ipcMain.handle('screenshots:confirm', async (_event, rawPayload: unknown) => {
    const validated = ConfirmScreenshotSchema.parse(rawPayload)
    const savedRecord = await fileOrganizer.confirmAndOrganize(validated)
    broadcastUpdate(savedRecord)

    const settings = settingsService.getPublicSettings()
    if (settings.enableNotifications && Notification.isSupported()) {
      try {
        new Notification({
          title: 'Screenshot Organized',
          body: `Saved as ${savedRecord.final_name} in ${savedRecord.category}`
        }).show()
      } catch {
        // Ignore notification errors in headless/test environments
      }
    }

    return savedRecord
  })

  ipcMain.handle('screenshots:reject', (_event, rawId: unknown) => {
    const id = IpcIdSchema.parse(rawId)
    const updated = repository.update(id, {
      status: 'rejected',
      error_message: ''
    })
    repository.logHistory(id, 'rejected', 'User rejected screenshot in Review Queue (original file preserved)')
    broadcastUpdate(updated)
    return updated
  })

  ipcMain.handle('screenshots:update', (_event, rawPayload: unknown) => {
    const validated = UpdateScreenshotSchema.parse(rawPayload)
    const updated = repository.update(validated.id, {
      suggested_name: validated.suggestedName,
      category: validated.category,
      description: validated.description,
      tags: validated.tags
    })
    broadcastUpdate(updated)
    return updated
  })

  ipcMain.handle('screenshots:search', (_event, rawQuery: unknown) => {
    const validated = SearchScreenshotsQuerySchema.parse(rawQuery || {})
    return repository.search(validated)
  })

  ipcMain.handle('screenshots:openLocation', (_event, rawId: unknown) => {
    const id = IpcIdSchema.parse(rawId)
    const record = repository.findById(id)
    if (!record) {
      throw new Error('Screenshot record not found')
    }

    const targetPath =
      record.final_path && fs.existsSync(record.final_path)
        ? record.final_path
        : record.original_path

    if (!targetPath || !fs.existsSync(targetPath)) {
      throw new Error('Screenshot file no longer exists at its recorded path on disk.')
    }

    shell.showItemInFolder(targetPath)
    return true
  })

  ipcMain.handle('screenshots:getImageDataUrl', async (_event, rawId: unknown) => {
    const id = IpcIdSchema.parse(rawId)
    const record = repository.findById(id)
    if (!record) {
      return null
    }

    const targetPath =
      record.final_path && fs.existsSync(record.final_path)
        ? record.final_path
        : record.original_path

    return await imageService.getImageDataUrl(targetPath)
  })

  ipcMain.handle('screenshots:scanExisting', async () => {
    return await watcher.scanExistingFiles()
  })

  ipcMain.handle('screenshots:captureClipboard', async () => {
    return await watcher.captureFromClipboard(true)
  })
}
