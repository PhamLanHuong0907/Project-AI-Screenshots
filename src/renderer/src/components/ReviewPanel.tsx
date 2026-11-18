import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CopyCheck,
  FolderTree as FolderTreeIcon,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Tag,
  X,
  XCircle
} from 'lucide-react'
import {
  ConfirmScreenshotPayload,
  DEFAULT_CATEGORIES,
  ScreenshotRecord,
  UpdateScreenshotPayload
} from '../types/screenshot'
import { formatConfidence, getFileExtension } from '../utils/formatters'
import { StatusBadge } from './StatusBadge'

interface ReviewPanelProps {
  screenshot: ScreenshotRecord
  destinationRoot: string
  onConfirm: (payload: ConfirmScreenshotPayload) => Promise<void>
  onReject: (id: string) => Promise<void>
  onRetry: (id: string) => Promise<void>
  onSaveDraft: (payload: UpdateScreenshotPayload) => Promise<void>
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({
  screenshot,
  destinationRoot,
  onConfirm,
  onReject,
  onRetry,
  onSaveDraft
}) => {
  const [finalName, setFinalName] = useState<string>('')
  const [category, setCategory] = useState<string>('Others')
  const [customCategory, setCustomCategory] = useState<string>('')
  const [useCustomCategory, setUseCustomCategory] = useState<boolean>(false)
  const [availableCategories, setAvailableCategories] = useState<string[]>([...DEFAULT_CATEGORIES])
  const [description, setDescription] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState<string>('')
  const [busyAction, setBusyAction] = useState<'confirm' | 'reject' | 'retry' | 'draft' | null>(
    null
  )
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  useEffect(() => {
    let active = true
    Promise.all([
      window.screenshotAPI?.getPhysicalFolders
        ? window.screenshotAPI.getPhysicalFolders(destinationRoot)
        : Promise.resolve([]),
      window.screenshotAPI?.getSettings ? window.screenshotAPI.getSettings() : Promise.resolve(null)
    ])
      .then(([folders, currentSettings]) => {
        if (!active) return
        const includeDefaults = currentSettings?.useDefaultCategories !== false
        const combined = Array.from(
          new Set([
            ...(folders || []),
            ...(currentSettings?.customCategories || []),
            ...(includeDefaults ? DEFAULT_CATEGORIES : [])
          ])
        )
          .filter(Boolean)
          .sort()
        setAvailableCategories(
          combined.length > 0 ? combined : includeDefaults ? [...DEFAULT_CATEGORIES] : ['Others']
        )
      })
      .catch(() => {
        if (active) setAvailableCategories([...DEFAULT_CATEGORIES])
      })
    return () => {
      active = false
    }
  }, [destinationRoot])

  useEffect(() => {
    const initialName =
      screenshot.suggested_name ||
      screenshot.original_name.replace(/\.(png|jpe?g|webp)$/i, '')
    setFinalName(initialName)

    setCategory(screenshot.category || 'Others')
    setDescription(screenshot.description || '')
    setTags(screenshot.tags || [])
    setTagInput('')
    setFeedback(null)
  }, [screenshot.id, screenshot.updated_at])

  const effectiveCategory = useCustomCategory
    ? customCategory.trim() || 'Others'
    : category || 'Others'

  const ext = getFileExtension(screenshot.original_name)

  const handleAddTag = () => {
    const trimmed = tagInput.trim()
    if (!trimmed) return
    if (!tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  const handleConfirmClick = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!finalName.trim()) {
      setFeedback({ type: 'error', message: 'Filename cannot be empty.' })
      return
    }
    setBusyAction('confirm')
    setFeedback(null)
    try {
      await onConfirm({
        id: screenshot.id,
        finalName: finalName.trim(),
        category: effectiveCategory,
        description: description.trim(),
        tags
      })
      setFeedback({
        type: 'success',
        message: 'Screenshot confirmed, renamed, and organized into target folder!'
      })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: (err as Error).message || 'Failed to confirm and move screenshot.'
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handleSaveDraftClick = async () => {
    setBusyAction('draft')
    setFeedback(null)
    try {
      await onSaveDraft({
        id: screenshot.id,
        suggestedName: finalName.trim(),
        category: effectiveCategory,
        description: description.trim(),
        tags
      })
      setFeedback({ type: 'success', message: 'Draft edits saved.' })
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message || 'Failed to save edits.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleRetryClick = async () => {
    setBusyAction('retry')
    setFeedback(null)
    try {
      await onRetry(screenshot.id)
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message || 'AI retry failed.' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleRejectClick = async () => {
    setBusyAction('reject')
    setFeedback(null)
    try {
      await onReject(screenshot.id)
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message || 'Failed to reject item.' })
    } finally {
      setBusyAction(null)
    }
  }

  const isAnalyzing = screenshot.status === 'analyzing'

  return (
    <form
      onSubmit={handleConfirmClick}
      className="flex flex-col h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            AI Metadata & Organization Review
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={screenshot.status} />
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Duplicate Notice */}
        {screenshot.is_duplicate && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 text-xs">
            <CopyCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Identical Screenshot Content Detected (SHA-256 Match)</p>
              <p className="text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                An identical image was already analyzed previously. Existing AI metadata has been
                reused to save API quota, and your file remains untouched until you confirm or
                reject.
              </p>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {screenshot.status === 'failed' && screenshot.error_message && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="flex-1">
              <p className="font-semibold">Processing Error</p>
              <p className="mt-0.5">{screenshot.error_message}</p>
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`p-3 rounded-lg text-xs font-medium border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Confidence Score */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-slate-600 dark:text-slate-400">
              AI Confidence Score
            </span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {formatConfidence(screenshot.confidence)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(Math.max(0, Math.min(1, screenshot.confidence)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Suggested Filename */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Suggested Filename <span className="text-slate-400 font-normal">(Category_Topic_Description)</span>
          </label>
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 overflow-hidden">
            <input
              type="text"
              value={finalName}
              maxLength={60}
              onChange={(e) => setFinalName(e.target.value)}
              placeholder="e.g. Excel_KPI_Conditional_Formatting"
              className="flex-1 px-3 py-2 text-sm font-mono bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
            />
            <span className="px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800">
              {ext}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 flex justify-between">
            <span>English ASCII characters & underscores only</span>
            <span>{finalName.length}/60 chars</span>
          </p>
        </div>

        {/* Category Selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Folder lưu trữ
            </label>
            <button
              type="button"
              onClick={() => setUseCustomCategory(!useCustomCategory)}
              className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {useCustomCategory ? 'Chọn từ danh sách folder' : '+ Nhập tên folder mới'}
            </button>
          </div>

          {!useCustomCategory ? (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  📁 {cat}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Nhập tên folder (ví dụ: Tuần 1 hoặc DuAnMoi)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          )}

          {/* Destination Preview */}
          <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
            <FolderTreeIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">
              {destinationRoot}\{effectiveCategory.replace(/\//g, '\\')}\{finalName || 'Screenshot'}
              {ext}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Description (Vietnamese / Notes)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả nội dung ảnh chụp màn hình..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Tags
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60"
              >
                <Tag className="w-3 h-3" />
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-rose-500 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="Add a tag and press Enter..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busyAction !== null || isAnalyzing}
            onClick={handleRetryClick}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            title="Re-run OpenAI Vision analysis on this screenshot"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${busyAction === 'retry' || isAnalyzing ? 'animate-spin' : ''}`}
            />
            <span>Retry AI</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleSaveDraftClick}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Edits</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleRejectClick}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/60 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            <span>Reject</span>
          </button>

          <button
            type="submit"
            disabled={busyAction !== null || isAnalyzing}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>{busyAction === 'confirm' ? 'Organizing...' : 'Confirm & Move'}</span>
          </button>
        </div>
      </div>
    </form>
  )
}
