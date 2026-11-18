import React, { useState } from 'react'
import {
  Activity,
  Bell,
  ClipboardPaste,
  Cpu,
  FolderSearch,
  KeyRound,
  Pause,
  Play,
  Settings as SettingsIcon,
  Zap
} from 'lucide-react'
import type { AIProvider } from '../types/screenshot'
import type { NavTab } from './Sidebar'

interface HeaderProps {
  activeTab: NavTab
  isMonitoring: boolean
  sourceFolder: string
  hasApiKey: boolean
  aiProvider: AIProvider
  aiModel: string
  autoApplyRename: boolean
  pendingCount: number
  analyzingCount: number
  onToggleMonitoring: (enable: boolean) => Promise<void>
  onToggleAutoRename: (enable: boolean) => Promise<void>
  onScanExisting: () => Promise<{ added: number; skipped: number }>
  onCaptureClipboard: () => Promise<{ captured: boolean; message: string }>
  onNavigate: (tab: NavTab) => void
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Overview Dashboard',
    subtitle: 'Real-time screenshot processing metrics and recent AI activity'
  },
  review: {
    title: 'Review Queue',
    subtitle: 'Inspect AI suggestions and confirm before renaming or moving files'
  },
  library: {
    title: 'Screenshot Library',
    subtitle: 'Search and browse your organized screenshot collection'
  },
  settings: {
    title: 'Application Settings',
    subtitle: 'Configure Gemini, Claude Code, OpenAI Vision, folders, and auto-rename mode'
  }
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  ollama: 'Ollama Local',
  tesseract: 'Tesseract Local',
  gemini: 'Gemini',
  claude: 'Claude Code',
  openai: 'OpenAI'
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isMonitoring,
  sourceFolder,
  hasApiKey,
  aiProvider,
  aiModel,
  autoApplyRename,
  pendingCount,
  analyzingCount,
  onToggleMonitoring,
  onToggleAutoRename,
  onScanExisting,
  onCaptureClipboard,
  onNavigate
}) => {
  const [scanning, setScanning] = useState(false)
  const [capturingClip, setCapturingClip] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const info = TAB_TITLES[activeTab]

  const showTempNotice = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4500)
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      const result = await onScanExisting()
      showTempNotice(`Scanned folder: ${result.added} new, ${result.skipped} skipped`)
    } finally {
      setScanning(false)
    }
  }

  const handleCaptureClip = async () => {
    setCapturingClip(true)
    try {
      const result = await onCaptureClipboard()
      showTempNotice(result.message)
    } finally {
      setCapturingClip(false)
    }
  }

  return (
    <header className="h-16 shrink-0 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="min-w-0 pr-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{info.title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{info.subtitle}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {notice && (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 max-w-xs truncate">
            {notice}
          </span>
        )}

        {/* Capture from Clipboard Button (for Win+Shift+S testing) */}
        <button
          type="button"
          disabled={capturingClip}
          onClick={handleCaptureClip}
          title="Capture screenshot from Windows Clipboard (Win + Shift + S) and analyze with AI"
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          <span>{capturingClip ? 'Capturing...' : 'Paste Clipboard'}</span>
        </button>

        {/* Scan Existing Files Button */}
        <button
          type="button"
          disabled={scanning}
          onClick={handleScan}
          title={`Scan existing images in ${sourceFolder}`}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <FolderSearch className="w-3.5 h-3.5 text-indigo-500" />
          <span>{scanning ? 'Scanning...' : 'Scan Folder'}</span>
        </button>

        {/* Quick Auto-Rename Toggle */}
        <button
          type="button"
          onClick={() => onToggleAutoRename(!autoApplyRename)}
          title={
            autoApplyRename
              ? 'Auto-Rename is ON: Screenshots are renamed automatically right after AI analysis'
              : 'Review Mode is ON: Screenshots wait in Review Queue before renaming (Click to enable Auto-Rename)'
          }
          className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors ${
            autoApplyRename
              ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-700 dark:text-amber-300'
              : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${autoApplyRename ? 'text-amber-500 fill-amber-500' : ''}`} />
          <span>{autoApplyRename ? 'Auto-Rename: ON' : 'Auto-Rename: OFF'}</span>
        </button>

        {/* Live Watcher Status Pill */}
        <div
          className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border ${
            isMonitoring
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800/70 dark:text-emerald-300'
              : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
          }`}
          title={`Monitored folder: ${sourceFolder}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isMonitoring ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <span>{isMonitoring ? 'Watching' : 'Paused'}</span>
          <button
            type="button"
            onClick={() => onToggleMonitoring(!isMonitoring)}
            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title={isMonitoring ? 'Pause folder monitoring' : 'Resume folder monitoring'}
          >
            {isMonitoring ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>

        {/* Active AI Provider & Model Pill */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            hasApiKey
              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800/70 dark:text-indigo-300'
              : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
          }`}
          title="Click to switch between Gemini, Claude Code, and OpenAI models"
        >
          {hasApiKey ? <Cpu className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
          <span>
            {PROVIDER_LABELS[aiProvider] || 'AI'}: {aiModel}
          </span>
        </button>

        {/* Active Analyzing / Review Notification Indicator */}
        <button
          type="button"
          onClick={() => onNavigate('review')}
          className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title={
            analyzingCount > 0
              ? `${analyzingCount} analyzing, ${pendingCount} waiting for review`
              : `${pendingCount} screenshots waiting for review`
          }
        >
          {analyzingCount > 0 ? (
            <Activity className="w-4 h-4 text-sky-500 animate-pulse" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
