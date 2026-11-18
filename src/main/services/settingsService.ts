import fs from 'fs'
import os from 'os'
import path from 'path'
import { app, safeStorage } from 'electron'
import {
  AI_PROVIDER_MODELS,
  AIProvider,
  AppSettings,
  OrganizeMode,
  ProviderKeyInfo,
  UpdateSettingsPayload
} from '../../renderer/src/types/screenshot'

interface StoredSettingsData {
  sourceFolder: string
  destinationFolder: string
  aiProvider: AIProvider
  aiModel: string
  ollamaBaseUrl?: string
  customCategories?: string[]
  useDefaultCategories?: boolean
  useClaudeCodeCli: boolean
  autoApplyRename: boolean
  organizeMode: OrganizeMode
  deleteSourceOnConfirm?: boolean
  watchClipboard: boolean
  maxImageSizeMB: number
  autoMonitorOnStartup: boolean
  startMinimized: boolean
  enableNotifications: boolean
  maxConcurrency: number
  theme: 'light' | 'dark'
  // Legacy OpenAI key fields (maintained for backward compatibility)
  encryptedApiKeyBase64?: string
  fallbackApiKeyBase64?: string
  // Per-provider encrypted keys
  encryptedKeys?: Partial<Record<AIProvider, string>>
  fallbackKeys?: Partial<Record<AIProvider, string>>
}

export class SettingsService {
  private settingsPath: string
  private data: StoredSettingsData
  private isMonitoringState = false
  private detectedClaudeCliPath: string = ''

  constructor(customConfigDir?: string) {
    const configDir = customConfigDir || this.resolveUserDataDir()
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    this.detectedClaudeCliPath = this.detectClaudeCodeBinary()
    this.settingsPath = path.join(configDir, 'settings.json')
    this.data = this.loadFromDisk()
  }

  private resolveUserDataDir(): string {
    try {
      if (app && typeof app.getPath === 'function') {
        return path.join(app.getPath('userData'))
      }
    } catch {
      // Not in Electron runtime (e.g., tests)
    }
    const home = process.env.USERPROFILE || os.homedir()
    return path.join(home, 'AppData', 'Roaming', 'ai-screenshot-manager')
  }

  private detectClaudeCodeBinary(): string {
    const home = process.env.USERPROFILE || os.homedir()
    const candidates = [
      path.join(home, '.claude', 'bin', 'claude.exe'),
      path.join(home, '.local', 'bin', 'claude.exe'),
      path.join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd')
    ]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }

    // Check PATH directories
    const pathEnv = process.env.PATH || ''
    for (const dir of pathEnv.split(path.delimiter)) {
      if (!dir) continue
      const exePath = path.join(dir, process.platform === 'win32' ? 'claude.exe' : 'claude')
      if (fs.existsSync(exePath)) {
        return exePath
      }
    }

    return ''
  }

  private getDefaultSettings(): StoredSettingsData {
    const home = process.env.USERPROFILE || os.homedir()
    return {
      sourceFolder:
        process.env.SCREENSHOT_SOURCE_DIR || path.join(home, 'Pictures', 'Screenshots'),
      destinationFolder:
        process.env.SCREENSHOT_DEST_DIR || path.join(home, 'Pictures', 'AI-Screenshots'),
      aiProvider: 'gemini',
      aiModel: process.env.OPENAI_MODEL || 'gemini-4-argon',
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      customCategories: [],
      useDefaultCategories: true,
      useClaudeCodeCli: true,
      autoApplyRename: false,
      organizeMode: 'rename_in_place',
      deleteSourceOnConfirm: true,
      watchClipboard: true,
      maxImageSizeMB: 20,
      autoMonitorOnStartup: true,
      startMinimized: false,
      enableNotifications: true,
      maxConcurrency: 2,
      theme: 'dark',
      encryptedKeys: {},
      fallbackKeys: {}
    }
  }

  private loadFromDisk(): StoredSettingsData {
    const defaults = this.getDefaultSettings()
    if (!fs.existsSync(this.settingsPath)) {
      this.saveToDisk(defaults)
      return defaults
    }

    try {
      const raw = fs.readFileSync(this.settingsPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<StoredSettingsData>
      const merged: StoredSettingsData = {
        ...defaults,
        ...parsed,
        encryptedKeys: { ...(defaults.encryptedKeys || {}), ...(parsed.encryptedKeys || {}) },
        fallbackKeys: { ...(defaults.fallbackKeys || {}), ...(parsed.fallbackKeys || {}) }
      }

      // Migrate legacy OpenAI key into encryptedKeys.openai if present
      if (merged.encryptedApiKeyBase64 && !merged.encryptedKeys?.openai) {
        merged.encryptedKeys!.openai = merged.encryptedApiKeyBase64
      }
      if (merged.fallbackApiKeyBase64 && !merged.fallbackKeys?.openai) {
        merged.fallbackKeys!.openai = merged.fallbackApiKeyBase64
      }

      return merged
    } catch (err) {
      console.error('Failed to parse settings.json, restoring defaults:', err)
      return defaults
    }
  }

  private saveToDisk(data: StoredSettingsData): void {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to write settings.json to disk:', err)
    }
  }

  public setMonitoringState(active: boolean): void {
    this.isMonitoringState = active
  }

  /**
   * Returns sanitized settings safe for the Renderer Process (never exposes raw API keys).
   */
  public getPublicSettings(): AppSettings {
    const provider = this.data.aiProvider || 'openai'
    const openaiInfo = this.resolveProviderKeyWithSource('openai')
    const geminiInfo = this.resolveProviderKeyWithSource('gemini')
    const claudeInfo = this.resolveProviderKeyWithSource('claude')

    const providerKeys: Record<AIProvider, ProviderKeyInfo> = {
      ollama: { hasKey: true, source: 'local' },
      tesseract: { hasKey: true, source: 'local' },
      openai: { hasKey: Boolean(openaiInfo.key), source: openaiInfo.source },
      gemini: { hasKey: Boolean(geminiInfo.key), source: geminiInfo.source },
      claude: {
        hasKey:
          Boolean(claudeInfo.key) ||
          Boolean(this.data.useClaudeCodeCli && this.detectedClaudeCliPath),
        source: claudeInfo.key
          ? claudeInfo.source
          : this.data.useClaudeCodeCli && this.detectedClaudeCliPath
            ? 'cli'
            : 'none'
      }
    }

    const activeKeyInfo = providerKeys[provider]

    return {
      sourceFolder: this.data.sourceFolder,
      destinationFolder: this.data.destinationFolder,
      aiProvider: provider,
      aiModel: this.data.aiModel,
      ollamaBaseUrl: this.data.ollamaBaseUrl || 'http://127.0.0.1:11434',
      customCategories: this.data.customCategories || [],
      useDefaultCategories: this.data.useDefaultCategories !== false,
      useClaudeCodeCli: Boolean(this.data.useClaudeCodeCli),
      claudeCliAvailable: Boolean(this.detectedClaudeCliPath),
      claudeCliPath: this.detectedClaudeCliPath,
      autoApplyRename: Boolean(this.data.autoApplyRename),
      organizeMode: this.data.organizeMode || 'rename_in_place',
      deleteSourceOnConfirm: this.data.deleteSourceOnConfirm !== false,
      watchClipboard: Boolean(this.data.watchClipboard),
      maxImageSizeMB: this.data.maxImageSizeMB,
      autoMonitorOnStartup: this.data.autoMonitorOnStartup,
      startMinimized: this.data.startMinimized,
      enableNotifications: this.data.enableNotifications,
      maxConcurrency: this.data.maxConcurrency,
      theme: this.data.theme,
      hasApiKey: activeKeyInfo.hasKey,
      apiKeySource: activeKeyInfo.source,
      providerKeys,
      isMonitoring: this.isMonitoringState
    }
  }

  /**
   * Retrieves the decrypted API key for a given provider (defaults to active provider).
   */
  public getApiKey(provider?: AIProvider): string | null {
    const target = provider || this.data.aiProvider || 'openai'
    return this.resolveProviderKeyWithSource(target).key
  }

  private resolveProviderKeyWithSource(provider: AIProvider): {
    key: string | null
    source: 'safeStorage' | 'env' | 'local' | 'none'
  } {
    const encryptedB64 = this.data.encryptedKeys?.[provider]
    if (encryptedB64) {
      try {
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          const buffer = Buffer.from(encryptedB64, 'base64')
          const decrypted = safeStorage.decryptString(buffer)
          if (decrypted && decrypted.trim()) {
            return { key: decrypted.trim(), source: 'safeStorage' }
          }
        }
      } catch (err) {
        console.error(`Failed to decrypt ${provider} API key from safeStorage:`, err)
      }
    }

    const fallbackB64 = this.data.fallbackKeys?.[provider]
    if (fallbackB64) {
      try {
        const decoded = Buffer.from(fallbackB64, 'base64').toString('utf-8')
        if (decoded && decoded.trim()) {
          return { key: decoded.trim(), source: 'local' }
        }
      } catch {
        // Ignore
      }
    }

    // Check environment variables as fallback
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return { key: process.env.OPENAI_API_KEY.trim(), source: 'env' }
    }
    if (provider === 'gemini' && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      return {
        key: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!.trim(),
        source: 'env'
      }
    }
    if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
      return { key: process.env.ANTHROPIC_API_KEY.trim(), source: 'env' }
    }

    return { key: null, source: 'none' }
  }

  private storeProviderKey(provider: AIProvider, key: string): void {
    const cleanKey = key.trim()
    if (!this.data.encryptedKeys) this.data.encryptedKeys = {}
    if (!this.data.fallbackKeys) this.data.fallbackKeys = {}

    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const buffer = safeStorage.encryptString(cleanKey)
        this.data.encryptedKeys[provider] = buffer.toString('base64')
        delete this.data.fallbackKeys[provider]
      } else {
        this.data.fallbackKeys[provider] = Buffer.from(cleanKey, 'utf-8').toString('base64')
      }
    } catch {
      this.data.fallbackKeys[provider] = Buffer.from(cleanKey, 'utf-8').toString('base64')
    }
  }

  private clearStoredProviderKey(provider: AIProvider): void {
    if (this.data.encryptedKeys) delete this.data.encryptedKeys[provider]
    if (this.data.fallbackKeys) delete this.data.fallbackKeys[provider]
    if (provider === 'openai') {
      delete this.data.encryptedApiKeyBase64
      delete this.data.fallbackApiKeyBase64
    }
  }

  public updateSettings(payload: UpdateSettingsPayload): AppSettings {
    if (payload.sourceFolder !== undefined) {
      this.data.sourceFolder = path.resolve(payload.sourceFolder.trim())
    }
    if (payload.destinationFolder !== undefined) {
      this.data.destinationFolder = path.resolve(payload.destinationFolder.trim())
    }
    if (payload.aiProvider !== undefined) {
      this.data.aiProvider = payload.aiProvider
      // If model wasn't explicitly provided when switching provider, pick default model for that provider
      if (payload.aiModel === undefined) {
        const currentModels = AI_PROVIDER_MODELS[payload.aiProvider] || []
        const matchesProvider = currentModels.some((m) => m.id === this.data.aiModel)
        if (!matchesProvider && currentModels.length > 0) {
          this.data.aiModel = currentModels[0].id
        }
      }
    }
    if (payload.aiModel !== undefined) {
      this.data.aiModel = payload.aiModel.trim()
    }
    if (payload.ollamaBaseUrl !== undefined) {
      this.data.ollamaBaseUrl = payload.ollamaBaseUrl.trim() || 'http://127.0.0.1:11434'
    }
    if (payload.customCategories !== undefined) {
      this.data.customCategories = Array.from(
        new Set(
          payload.customCategories
            .map((c) => c.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, ''))
            .filter((c) => c.length > 0)
        )
      )
    }
    if (payload.useDefaultCategories !== undefined) {
      this.data.useDefaultCategories = Boolean(payload.useDefaultCategories)
    }
    if (payload.useClaudeCodeCli !== undefined) {
      this.data.useClaudeCodeCli = Boolean(payload.useClaudeCodeCli)
    }
    if (payload.autoApplyRename !== undefined) {
      this.data.autoApplyRename = Boolean(payload.autoApplyRename)
    }
    if (payload.organizeMode !== undefined) {
      this.data.organizeMode = payload.organizeMode
    }
    if (payload.deleteSourceOnConfirm !== undefined) {
      this.data.deleteSourceOnConfirm = Boolean(payload.deleteSourceOnConfirm)
    }
    if (payload.watchClipboard !== undefined) {
      this.data.watchClipboard = Boolean(payload.watchClipboard)
    }
    if (payload.maxImageSizeMB !== undefined) {
      this.data.maxImageSizeMB = Math.max(1, Math.min(100, Number(payload.maxImageSizeMB)))
    }
    if (payload.autoMonitorOnStartup !== undefined) {
      this.data.autoMonitorOnStartup = Boolean(payload.autoMonitorOnStartup)
    }
    if (payload.startMinimized !== undefined) {
      this.data.startMinimized = Boolean(payload.startMinimized)
    }
    if (payload.enableNotifications !== undefined) {
      this.data.enableNotifications = Boolean(payload.enableNotifications)
    }
    if (payload.maxConcurrency !== undefined) {
      this.data.maxConcurrency = Math.max(1, Math.min(10, Math.round(payload.maxConcurrency)))
    }
    if (payload.theme !== undefined) {
      this.data.theme = payload.theme
    }

    if (payload.clearApiKey) {
      this.clearStoredProviderKey(this.data.aiProvider || 'openai')
    }
    if (payload.clearProviderKey) {
      this.clearStoredProviderKey(payload.clearProviderKey)
    }

    if (payload.openaiApiKey && payload.openaiApiKey.trim()) {
      this.storeProviderKey('openai', payload.openaiApiKey)
    }
    if (payload.geminiApiKey && payload.geminiApiKey.trim()) {
      this.storeProviderKey('gemini', payload.geminiApiKey)
    }
    if (payload.claudeApiKey && payload.claudeApiKey.trim()) {
      this.storeProviderKey('claude', payload.claudeApiKey)
    }

    this.saveToDisk(this.data)
    return this.getPublicSettings()
  }

  public addCustomCategory(category: string): string[] {
    const clean = category.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
    if (!clean) return this.data.customCategories || []
    const current = new Set(this.data.customCategories || [])
    current.add(clean)
    this.data.customCategories = Array.from(current)
    this.saveToDisk(this.data)
    return this.data.customCategories
  }

  public removeCustomCategory(category: string): string[] {
    const clean = category.trim()
    const current = (this.data.customCategories || []).filter((c) => c !== clean)
    this.data.customCategories = current
    this.saveToDisk(this.data)
    return this.data.customCategories
  }

  public renameCustomCategory(oldCategory: string, newCategory: string): string[] {
    const cleanOld = oldCategory.trim()
    const cleanNew = newCategory.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
    if (!cleanNew) return this.data.customCategories || []
    const list = (this.data.customCategories || []).map((c) => (c === cleanOld ? cleanNew : c))
    this.data.customCategories = Array.from(new Set(list))
    this.saveToDisk(this.data)
    return this.data.customCategories
  }
}
