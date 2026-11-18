import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Cpu,
  FolderOpen,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  XCircle,
  Zap
} from 'lucide-react'
import {
  AI_PROVIDER_MODELS,
  AIProvider,
  AppSettings,
  OrganizeMode,
  UpdateSettingsPayload,
  ValidationResult
} from '../types/screenshot'

interface SettingsProps {
  settings: AppSettings | null
  onUpdateSettings: (payload: UpdateSettingsPayload) => Promise<AppSettings>
  onValidateOpenAI: (
    apiKeyOverride?: string,
    modelOverride?: string,
    providerOverride?: AIProvider
  ) => Promise<ValidationResult>
  onSelectFolder: (defaultPath?: string) => Promise<string | null>
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onValidateOpenAI,
  onSelectFolder
}) => {
  const [sourceFolder, setSourceFolder] = useState('')
  const [destinationFolder, setDestinationFolder] = useState('')

  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini')
  const [aiModel, setAiModel] = useState('gemini-4-argon')
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://127.0.0.1:11434')
  const [customModel, setCustomModel] = useState('')
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [useClaudeCodeCli, setUseClaudeCodeCli] = useState(true)

  const [openaiKeyInput, setOpenaiKeyInput] = useState('')
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [claudeKeyInput, setClaudeKeyInput] = useState('')

  const [autoApplyRename, setAutoApplyRename] = useState(false)
  const [organizeMode, setOrganizeMode] = useState<OrganizeMode>('rename_in_place')
  const [watchClipboard, setWatchClipboard] = useState(true)

  const [maxImageSizeMB, setMaxImageSizeMB] = useState(20)
  const [maxConcurrency, setMaxConcurrency] = useState(2)
  const [autoMonitorOnStartup, setAutoMonitorOnStartup] = useState(true)
  const [startMinimized, setStartMinimized] = useState(false)
  const [enableNotifications, setEnableNotifications] = useState(true)

  const [saving, setSaving] = useState(false)
  const [testingApi, setTestingApi] = useState(false)
  const [saveBanner, setSaveBanner] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  useEffect(() => {
    if (!settings) return
    setSourceFolder(settings.sourceFolder)
    setDestinationFolder(settings.destinationFolder)

    const prov = settings.aiProvider || 'gemini'
    setAiProvider(prov)
    setOllamaBaseUrl(settings.ollamaBaseUrl || 'http://127.0.0.1:11434')
    setUseClaudeCodeCli(settings.useClaudeCodeCli)
    setAutoApplyRename(settings.autoApplyRename)
    setOrganizeMode(settings.organizeMode || 'rename_in_place')
    setWatchClipboard(settings.watchClipboard)

    const presetList = AI_PROVIDER_MODELS[prov] || []
    const isPreset = presetList.some((m) => m.id === settings.aiModel)
    if (isPreset) {
      setAiModel(settings.aiModel)
      setUseCustomModel(false)
      setCustomModel('')
    } else {
      setUseCustomModel(true)
      setCustomModel(settings.aiModel)
      setAiModel(presetList[0]?.id || '')
    }

    setMaxImageSizeMB(settings.maxImageSizeMB)
    setMaxConcurrency(settings.maxConcurrency)
    setAutoMonitorOnStartup(settings.autoMonitorOnStartup)
    setStartMinimized(settings.startMinimized)
    setEnableNotifications(settings.enableNotifications)
  }, [settings])

  const handleSelectProvider = (nextProvider: AIProvider) => {
    setAiProvider(nextProvider)
    setValidationResult(null)
    const presets = AI_PROVIDER_MODELS[nextProvider] || []
    if (presets.length > 0) {
      setAiModel(presets[0].id)
      setUseCustomModel(false)
      setCustomModel('')
    }
  }

  const effectiveModel = useCustomModel
    ? customModel.trim() || AI_PROVIDER_MODELS[aiProvider][0].id
    : aiModel

  const activeKeyInput =
    aiProvider === 'gemini'
      ? geminiKeyInput
      : aiProvider === 'claude'
        ? claudeKeyInput
        : openaiKeyInput

  const setActiveKeyInput = (val: string) => {
    if (aiProvider === 'gemini') setGeminiKeyInput(val)
    else if (aiProvider === 'claude') setClaudeKeyInput(val)
    else setOpenaiKeyInput(val)
  }

  const activeProviderKeyInfo = settings?.providerKeys?.[aiProvider]

  const handleBrowseSource = async () => {
    const picked = await onSelectFolder(sourceFolder)
    if (picked) setSourceFolder(picked)
  }

  const handleBrowseDest = async () => {
    const picked = await onSelectFolder(destinationFolder)
    if (picked) setDestinationFolder(picked)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveBanner(null)
    try {
      await onUpdateSettings({
        sourceFolder,
        destinationFolder,
        aiProvider,
        aiModel: effectiveModel,
        ollamaBaseUrl: ollamaBaseUrl.trim() || undefined,
        useClaudeCodeCli,
        autoApplyRename,
        organizeMode,
        watchClipboard,
        openaiApiKey: openaiKeyInput.trim() || undefined,
        geminiApiKey: geminiKeyInput.trim() || undefined,
        claudeApiKey: claudeKeyInput.trim() || undefined,
        maxImageSizeMB,
        maxConcurrency,
        autoMonitorOnStartup,
        startMinimized,
        enableNotifications
      })
      setOpenaiKeyInput('')
      setGeminiKeyInput('')
      setClaudeKeyInput('')
      setSaveBanner({
        type: 'success',
        message: `Settings saved! Active AI model: ${aiProvider.toUpperCase()} (${effectiveModel}).`
      })
    } catch (err) {
      setSaveBanner({
        type: 'error',
        message: (err as Error).message || 'Failed to save settings.'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTestingApi(true)
    setValidationResult(null)
    try {
      const res = await onValidateOpenAI(
        activeKeyInput.trim() ? activeKeyInput.trim() : undefined,
        effectiveModel,
        aiProvider
      )
      setValidationResult(res)
    } catch (err) {
      setValidationResult({
        valid: false,
        message: (err as Error).message || 'Validation failed.'
      })
    } finally {
      setTestingApi(false)
    }
  }

  const handleClearProviderKey = async () => {
    setSaving(true)
    try {
      await onUpdateSettings({ clearProviderKey: aiProvider })
      setActiveKeyInput('')
      setValidationResult(null)
      setSaveBanner({
        type: 'success',
        message: `Stored ${aiProvider.toUpperCase()} API key removed from local safeStorage.`
      })
    } finally {
      setSaving(false)
    }
  }

  const providerTabs: Array<{
    id: AIProvider
    title: string
    subtitle: string
    badge: string
  }> = [
    {
      id: 'ollama',
      title: 'Ollama (Local AI)',
      subtitle: 'Moondream, MiniCPM-V, Llama 3.2 Vision',
      badge: 'Local Vision'
    },
    {
      id: 'tesseract',
      title: 'Tesseract OCR (Local)',
      subtitle: '100% Offline trên máy — Không cần API Key',
      badge: 'Free / Offline'
    },
    {
      id: 'gemini',
      title: 'Google Gemini',
      subtitle: 'Gemini 2.5 Flash & 2.5 Pro Vision',
      badge: settings?.providerKeys?.gemini?.hasKey ? 'Key Saved' : 'API Key'
    },
    {
      id: 'claude',
      title: 'Claude / Claude Code',
      subtitle: 'Local claude.exe CLI or Anthropic API',
      badge: settings?.claudeCliAvailable ? 'CLI Detected' : 'API Key'
    },
    {
      id: 'openai',
      title: 'OpenAI Vision',
      subtitle: 'GPT-4o Mini, GPT-4o & GPT-4.1',
      badge: settings?.providerKeys?.openai?.hasKey ? 'Key Saved' : 'API Key'
    }
  ]

  return (
    <div className="h-full overflow-y-auto p-6">
      <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6 pb-8">
        {saveBanner && (
          <div
            className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              saveBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200'
            }`}
          >
            {saveBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{saveBanner.message}</span>
          </div>
        )}

        {/* Section 1: AI Provider & Model Selection (Gemini, Claude Code, OpenAI) */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  AI Vision Provider & Model Selection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose between Google Gemini, Claude / Claude Code CLI, and OpenAI Vision
                </p>
              </div>
            </div>

            {activeProviderKeyInfo?.hasKey || aiProvider === 'tesseract' || aiProvider === 'ollama' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {aiProvider === 'ollama'
                    ? 'Ollama Local Vision Ready'
                    : aiProvider === 'tesseract'
                      ? 'Tesseract Local Engine Ready'
                      : activeProviderKeyInfo?.source === 'cli'
                        ? 'Claude Code CLI Ready'
                        : activeProviderKeyInfo?.source === 'safeStorage'
                          ? 'Encrypted Key Saved'
                          : activeProviderKeyInfo?.source === 'env'
                            ? '.env Variable Active'
                            : 'Key Configured'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Needs API Key / Login</span>
              </span>
            )}
          </div>

          {/* Model Provider Cards (Ollama, Tesseract, Gemini, Claude, OpenAI) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {providerTabs.map((tab) => {
              const selected = aiProvider === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectProvider(tab.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/50 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {tab.title}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        selected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{tab.subtitle}</p>
                </button>
              )
            })}
          </div>

          {/* Model Dropdown / Custom Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select {aiProvider === 'ollama' ? 'Ollama Vision' : aiProvider === 'gemini' ? 'Gemini' : aiProvider === 'claude' ? 'Claude Code / Anthropic' : aiProvider === 'tesseract' ? 'Tesseract OCR' : 'OpenAI'} Model
              </label>
              <button
                type="button"
                onClick={() => setUseCustomModel(!useCustomModel)}
                className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {useCustomModel ? 'Choose from preset models' : 'Enter custom model ID'}
              </button>
            </div>

            {!useCustomModel ? (
              <div className="space-y-2">
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100"
                >
                  {(AI_PROVIDER_MODELS[aiProvider] || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.description}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder={
                  aiProvider === 'ollama'
                    ? 'e.g. moondream, minicpm-v, llama3.2-vision, or bakllava'
                    : aiProvider === 'gemini'
                      ? 'e.g. gemini-2.5-flash or gemini-2.5-pro'
                      : aiProvider === 'claude'
                        ? 'e.g. sonnet, opus, haiku, or claude-sonnet-4-6'
                        : 'e.g. gpt-4o-mini or gpt-4.1'
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            )}
          </div>

          {/* Claude Code CLI Specific Option */}
          {aiProvider === 'claude' && (
            <div className="p-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/70 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useClaudeCodeCli}
                  onChange={(e) => setUseClaudeCodeCli(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Use Local Claude Code CLI (claude.exe)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {settings?.claudeCliAvailable
                      ? `Detected at: ${settings.claudeCliPath}. Uses your local Claude Code login without needing a separate API key (or provide an Anthropic API key below).`
                      : 'claude.exe was not detected in default paths. Please provide an Anthropic API key below.'}
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* API Key / Server Configuration Input for Active Provider */}
          {aiProvider === 'ollama' ? (
            <div className="p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/70 bg-blue-50/40 dark:bg-blue-950/30 space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Ollama Local Vision Configuration
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Chạy mô hình thị giác trực tiếp trên GPU/CPU máy tính thông qua Ollama REST API. Hỗ trợ <strong>moondream</strong> (siêu nhẹ), <strong>minicpm-v</strong> (chi tiết cao), và <strong>llama3.2-vision</strong>.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ollama Base URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    placeholder="http://127.0.0.1:11434"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={testingApi}
                    onClick={handleTestConnection}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center gap-1.5"
                  >
                    {testingApi ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Kiểm tra Ollama</span>
                  </button>
                </div>
              </div>
            </div>
          ) : aiProvider === 'tesseract' ? (
            <div className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/70 bg-emerald-50/40 dark:bg-emerald-950/30 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Tesseract OCR Engine (Local / Offline)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Model OCR Tesseract chạy trực tiếp trên máy của bạn (100% riêng tư và offline), trích xuất văn bản từ ảnh chụp màn hình và tự động tạo tên file gợi ý theo chủ đề và từ khóa mà không cần internet hay API key.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  disabled={testingApi}
                  onClick={handleTestConnection}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium border border-emerald-200 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"
                >
                  {testingApi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Kiểm tra Tesseract Local</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {aiProvider === 'gemini'
                  ? 'Google Gemini API Key (AI Studio Key)'
                  : aiProvider === 'claude'
                    ? 'Anthropic API Key (Optional if signed into Claude Code CLI)'
                    : 'OpenAI API Key'}
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={activeKeyInput}
                  onChange={(e) => setActiveKeyInput(e.target.value)}
                  placeholder={
                    activeProviderKeyInfo?.hasKey && activeProviderKeyInfo.source !== 'cli'
                      ? '•••••••••••••••••••••••••••••••• (Enter new key to replace)'
                      : aiProvider === 'gemini'
                        ? 'AIzaSy...'
                        : aiProvider === 'claude'
                          ? 'sk-ant-api03-... (Leave blank to use Claude Code CLI)'
                          : 'sk-proj-...'
                  }
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={testingApi}
                  onClick={handleTestConnection}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium border border-indigo-200 dark:border-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5"
                >
                  {testingApi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Validate {aiProvider.toUpperCase()}</span>
                </button>
                {activeProviderKeyInfo?.hasKey &&
                  activeProviderKeyInfo.source !== 'env' &&
                  activeProviderKeyInfo.source !== 'cli' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleClearProviderKey}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      Xóa Key
                    </button>
                  )}
              </div>
            </div>
          )}

          {validationResult && (
            <div
              className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                validationResult.valid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200'
              }`}
            >
              {validationResult.valid ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{validationResult.message}</span>
            </div>
          )}
        </section>

        {/* Section 2: Screenshot Renaming & Live Capture Workflow */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Zap className="w-4 h-4 text-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Screenshot Renaming & Capture Mode
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose how newly captured screenshots are renamed when you take a screenshot
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                When a Screenshot is Analyzed
              </label>
              <select
                value={autoApplyRename ? 'auto' : 'review'}
                onChange={(e) => setAutoApplyRename(e.target.value === 'auto')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="review">
                  Review Before Save (Confirm in Review Queue first)
                </option>
                <option value="auto">
                  Auto-Rename Immediately (Rename file automatically right after AI analysis)
                </option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Turn on Auto-Rename if you want screenshots renamed on disk immediately after taking them.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                File Renaming Location
              </label>
              <select
                value={organizeMode}
                onChange={(e) => setOrganizeMode(e.target.value as OrganizeMode)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="rename_in_place">
                  Rename in Place (Keep inside Pictures\Screenshots folder with new AI name)
                </option>
                <option value="category_folders">
                  Move to Category Folders (Pictures\AI-Screenshots\&lt;Category&gt;\)
                </option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                &ldquo;Rename in Place&rdquo; renames the screenshot directly in your Screenshots folder.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={watchClipboard}
              onChange={(e) => setWatchClipboard(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Auto-Detect Windows Clipboard Screenshots (Win + Shift + S)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically saves clipboard screenshots to your Screenshots folder and renames them with AI even if Windows Snipping Tool only copies to clipboard
              </p>
            </div>
          </label>
        </section>

        {/* Section 3: Folders Configuration */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Screenshot Folders
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure where new screenshots are watched and where category folders are organized
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Screenshot Source Folder (Monitored by Chokidar)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sourceFolder}
                  onChange={(e) => setSourceFolder(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleBrowseSource}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Browse...
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Organized Destination Root Folder (Used when Move to Category Folders is selected)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={destinationFolder}
                  onChange={(e) => setDestinationFolder(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleBrowseDest}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Browse...
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Performance & Startup Preferences */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Sliders className="w-4 h-4 text-indigo-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Performance & Application Behavior
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control image size limits, API queue concurrency, and Windows startup behavior
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Maximum Image Size (MB)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxImageSizeMB}
                onChange={(e) => setMaxImageSizeMB(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Concurrent AI Requests Limit
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMonitorOnStartup}
                onChange={(e) => setAutoMonitorOnStartup(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Start Folder Monitoring Automatically on Launch
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableNotifications}
                onChange={(e) => setEnableNotifications(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Enable Windows Desktop Notifications
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={startMinimized}
                onChange={(e) => setStartMinimized(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Start Minimized
                </p>
              </div>
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save All Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
