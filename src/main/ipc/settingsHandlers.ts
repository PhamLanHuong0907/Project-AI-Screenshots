import { ipcMain } from 'electron'
import { z } from 'zod'
import { AIService } from '../services/aiService'
import { ScreenshotWatcher } from '../services/screenshotWatcher'
import { SettingsService } from '../services/settingsService'
import { UpdateSettingsSchema } from '../utils/validation'

const ValidateOpenAIPayloadSchema = z
  .object({
    apiKeyOverride: z.string().optional(),
    modelOverride: z.string().optional(),
    providerOverride: z.enum(['openai', 'gemini', 'claude', 'tesseract', 'ollama']).optional()
  })
  .optional()

export function registerSettingsHandlers(
  settingsService: SettingsService,
  watcher: ScreenshotWatcher,
  aiService: AIService
): void {
  ipcMain.handle('settings:get', () => {
    return settingsService.getPublicSettings()
  })

  ipcMain.handle('settings:update', async (_event, rawPayload: unknown) => {
    const previousSettings = settingsService.getPublicSettings()
    const validated = UpdateSettingsSchema.parse(rawPayload || {})
    const updatedSettings = settingsService.updateSettings(validated)

    // If source folder changed while monitoring is active, restart watcher on the new folder
    if (
      validated.sourceFolder &&
      validated.sourceFolder !== previousSettings.sourceFolder &&
      previousSettings.isMonitoring
    ) {
      await watcher.start(updatedSettings.sourceFolder)
    }

    return settingsService.getPublicSettings()
  })

  ipcMain.handle('settings:addCategory', (_event, rawCategory: unknown) => {
    const category = z.string().min(1).max(120).parse(rawCategory)
    settingsService.addCustomCategory(category)
    return settingsService.getPublicSettings()
  })

  ipcMain.handle('settings:removeCategory', (_event, rawCategory: unknown) => {
    const category = z.string().min(1).max(120).parse(rawCategory)
    settingsService.removeCustomCategory(category)
    return settingsService.getPublicSettings()
  })

  ipcMain.handle(
    'settings:renameCategory',
    (_event, payload: { oldCategory: string; newCategory: string }) => {
      const oldCat = z.string().min(1).max(120).parse(payload?.oldCategory)
      const newCat = z.string().min(1).max(120).parse(payload?.newCategory)
      settingsService.renameCustomCategory(oldCat, newCat)
      return settingsService.getPublicSettings()
    }
  )

  ipcMain.handle('settings:validateOpenAI', async (_event, rawPayload: unknown) => {
    const parsed = ValidateOpenAIPayloadSchema.parse(rawPayload)
    return await aiService.validateConfiguration(
      parsed?.apiKeyOverride,
      parsed?.modelOverride,
      parsed?.providerOverride
    )
  })
}
