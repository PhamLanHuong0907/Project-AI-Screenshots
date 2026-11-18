import { useCallback, useEffect, useState } from 'react'
import type {
  AIProvider,
  AppSettings,
  UpdateSettingsPayload,
  ValidationResult,
  WatcherStatusEvent
} from '../types/screenshot'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatusEvent>({
    isMonitoring: false,
    sourceFolder: ''
  })
  const [loading, setLoading] = useState<boolean>(true)

  const applyTheme = useCallback((theme: 'light' | 'dark') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const data = await window.screenshotAPI.getSettings()
      setSettings(data)
      setWatcherStatus({
        isMonitoring: data.isMonitoring,
        sourceFolder: data.sourceFolder
      })
      applyTheme(data.theme)
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }, [applyTheme])

  useEffect(() => {
    void loadSettings()

    const unsubscribe = window.screenshotAPI.onWatcherStatus((status) => {
      setWatcherStatus(status)
      setSettings((prev) => (prev ? { ...prev, isMonitoring: status.isMonitoring } : prev))
    })

    return () => {
      unsubscribe()
    }
  }, [loadSettings])

  const updateSettings = useCallback(
    async (payload: UpdateSettingsPayload): Promise<AppSettings> => {
      const updated = await window.screenshotAPI.updateSettings(payload)
      setSettings(updated)
      applyTheme(updated.theme)
      return updated
    },
    [applyTheme]
  )

  const validateOpenAI = useCallback(
    async (
      apiKeyOverride?: string,
      modelOverride?: string,
      providerOverride?: AIProvider
    ): Promise<ValidationResult> => {
      return await window.screenshotAPI.validateOpenAIConfig(
        apiKeyOverride,
        modelOverride,
        providerOverride
      )
    },
    []
  )

  const selectFolder = useCallback(async (defaultPath?: string): Promise<string | null> => {
    return await window.screenshotAPI.selectFolder(defaultPath)
  }, [])

  const toggleMonitoring = useCallback(async (enable: boolean): Promise<WatcherStatusEvent> => {
    const status = await window.screenshotAPI.toggleMonitoring(enable)
    setWatcherStatus(status)
    setSettings((prev) => (prev ? { ...prev, isMonitoring: status.isMonitoring } : prev))
    return status
  }, [])

  const addCategory = useCallback(async (category: string): Promise<AppSettings> => {
    const updated = await window.screenshotAPI.addCategory(category)
    setSettings(updated)
    return updated
  }, [])

  const removeCategory = useCallback(async (category: string): Promise<AppSettings> => {
    const updated = await window.screenshotAPI.removeCategory(category)
    setSettings(updated)
    return updated
  }, [])

  const renameCategory = useCallback(
    async (oldCategory: string, newCategory: string): Promise<AppSettings> => {
      const updated = await window.screenshotAPI.renameCategory(oldCategory, newCategory)
      setSettings(updated)
      return updated
    },
    []
  )

  return {
    settings,
    watcherStatus,
    loading,
    loadSettings,
    updateSettings,
    validateOpenAI,
    selectFolder,
    toggleMonitoring,
    addCategory,
    removeCategory,
    renameCategory
  }
}
