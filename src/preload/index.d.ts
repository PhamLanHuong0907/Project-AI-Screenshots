import {
  AIProvider,
  AppSettings,
  ConfirmScreenshotPayload,
  DashboardStats,
  ScreenshotRecord,
  SearchScreenshotsQuery,
  UpdateScreenshotPayload,
  UpdateSettingsPayload,
  ValidationResult,
  WatcherStatusEvent
} from '../renderer/src/types/screenshot'

export interface ScreenshotAPI {
  getDashboardStats: () => Promise<DashboardStats>
  getScreenshots: () => Promise<ScreenshotRecord[]>
  getPendingScreenshots: () => Promise<ScreenshotRecord[]>
  onNewScreenshot: (callback: (screenshot: ScreenshotRecord) => void) => () => void
  onScreenshotUpdated: (callback: (screenshot: ScreenshotRecord) => void) => () => void
  onWatcherStatus: (callback: (status: WatcherStatusEvent) => void) => () => void
  analyzeScreenshot: (id: string) => Promise<ScreenshotRecord>
  retryAnalysis: (id: string) => Promise<ScreenshotRecord>
  confirmScreenshot: (data: ConfirmScreenshotPayload) => Promise<ScreenshotRecord>
  rejectScreenshot: (id: string) => Promise<ScreenshotRecord>
  updateScreenshot: (data: UpdateScreenshotPayload) => Promise<ScreenshotRecord>
  searchScreenshots: (query: SearchScreenshotsQuery) => Promise<ScreenshotRecord[]>
  openScreenshotLocation: (id: string) => Promise<boolean>
  getImageDataUrl: (id: string) => Promise<string | null>
  scanExistingScreenshots: () => Promise<{ added: number; skipped: number }>
  captureClipboardScreenshot: () => Promise<{
    captured: boolean
    message: string
    screenshot?: ScreenshotRecord
  }>
  toggleMonitoring: (enable: boolean) => Promise<WatcherStatusEvent>
  getSettings: () => Promise<AppSettings>
  updateSettings: (data: UpdateSettingsPayload) => Promise<AppSettings>
  addCategory: (category: string) => Promise<AppSettings>
  removeCategory: (category: string) => Promise<AppSettings>
  renameCategory: (oldCategory: string, newCategory: string) => Promise<AppSettings>
  validateOpenAIConfig: (
    apiKeyOverride?: string,
    modelOverride?: string,
    providerOverride?: AIProvider
  ) => Promise<ValidationResult>
  selectFolder: (defaultPath?: string) => Promise<string | null>
  getPhysicalFolders: (targetRootPath?: string) => Promise<string[]>
  createPhysicalFolder: (folderName: string) => Promise<boolean>
  closeQuickPopup: () => Promise<void>
  openMainWindow: () => Promise<void>
}

declare global {
  interface Window {
    screenshotAPI: ScreenshotAPI
  }
}
