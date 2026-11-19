import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { ScreenshotAPI } from './index.d'
import type {
  AIProvider,
  ConfirmScreenshotPayload,
  ScreenshotRecord,
  SearchScreenshotsQuery,
  UpdateScreenshotPayload,
  UpdateSettingsPayload,
  WatcherStatusEvent
} from '../renderer/src/types/screenshot'

const screenshotAPI: ScreenshotAPI = {
  getDashboardStats: () => ipcRenderer.invoke('screenshots:getDashboardStats'),
  getScreenshots: () => ipcRenderer.invoke('screenshots:getAll'),
  getPendingScreenshots: () => ipcRenderer.invoke('screenshots:getPending'),

  onNewScreenshot: (callback: (screenshot: ScreenshotRecord) => void) => {
    const handler = (_event: IpcRendererEvent, screenshot: ScreenshotRecord): void => {
      callback(screenshot)
    }
    ipcRenderer.on('screenshots:new', handler)
    return () => {
      ipcRenderer.removeListener('screenshots:new', handler)
    }
  },

  onScreenshotUpdated: (callback: (screenshot: ScreenshotRecord) => void) => {
    const handler = (_event: IpcRendererEvent, screenshot: ScreenshotRecord): void => {
      callback(screenshot)
    }
    ipcRenderer.on('screenshots:updated', handler)
    return () => {
      ipcRenderer.removeListener('screenshots:updated', handler)
    }
  },

  onWatcherStatus: (callback: (status: WatcherStatusEvent) => void) => {
    const handler = (_event: IpcRendererEvent, status: WatcherStatusEvent): void => {
      callback(status)
    }
    ipcRenderer.on('watcher:status', handler)
    return () => {
      ipcRenderer.removeListener('watcher:status', handler)
    }
  },

  analyzeScreenshot: (id: string) => ipcRenderer.invoke('screenshots:analyze', id),
  retryAnalysis: (id: string) => ipcRenderer.invoke('screenshots:retry', id),
  confirmScreenshot: (data: ConfirmScreenshotPayload) =>
    ipcRenderer.invoke('screenshots:confirm', data),
  rejectScreenshot: (id: string) => ipcRenderer.invoke('screenshots:reject', id),
  updateScreenshot: (data: UpdateScreenshotPayload) =>
    ipcRenderer.invoke('screenshots:update', data),
  searchScreenshots: (query: SearchScreenshotsQuery) =>
    ipcRenderer.invoke('screenshots:search', query),
  openScreenshotLocation: (id: string) => ipcRenderer.invoke('screenshots:openLocation', id),
  getImageDataUrl: (id: string) => ipcRenderer.invoke('screenshots:getImageDataUrl', id),
  scanExistingScreenshots: () => ipcRenderer.invoke('screenshots:scanExisting'),
  captureClipboardScreenshot: () => ipcRenderer.invoke('screenshots:captureClipboard'),
  toggleMonitoring: (enable: boolean) => ipcRenderer.invoke('system:toggleMonitoring', enable),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (data: UpdateSettingsPayload) => ipcRenderer.invoke('settings:update', data),
  addCategory: (category: string) => ipcRenderer.invoke('settings:addCategory', category),
  removeCategory: (category: string) => ipcRenderer.invoke('settings:removeCategory', category),
  renameCategory: (oldCategory: string, newCategory: string) =>
    ipcRenderer.invoke('settings:renameCategory', { oldCategory, newCategory }),
  validateOpenAIConfig: (
    apiKeyOverride?: string,
    modelOverride?: string,
    providerOverride?: AIProvider
  ) =>
    ipcRenderer.invoke('settings:validateOpenAI', {
      apiKeyOverride,
      modelOverride,
      providerOverride
    }),
  selectFolder: (defaultPath?: string) => ipcRenderer.invoke('system:selectFolder', defaultPath),
  getPhysicalFolders: (targetRootPath?: string) =>
    ipcRenderer.invoke('system:getPhysicalFolders', targetRootPath),
  createPhysicalFolder: (folderName: string) =>
    ipcRenderer.invoke('system:createPhysicalFolder', folderName),
  closeQuickPopup: () => ipcRenderer.invoke('system:closeQuickPopup'),
  openMainWindow: () => ipcRenderer.invoke('system:openMainWindow'),
  installOllama: () => ipcRenderer.invoke('system:installOllama'),
  pullOllamaModel: (model: string) => ipcRenderer.invoke('system:pullOllamaModel', model)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('screenshotAPI', screenshotAPI)
  } catch (error) {
    console.error('Failed to expose screenshotAPI via contextBridge:', error)
  }
} else {
  // @ts-ignore (fallback only if contextIsolation is disabled)
  window.screenshotAPI = screenshotAPI
}
