import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  ImageOff,
  Loader2,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react'
import { DEFAULT_CATEGORIES, ScreenshotRecord } from '../types/screenshot'
import { formatConfidence, getFileExtension } from '../utils/formatters'

export const QuickConfirmPopup: React.FC = () => {
  const [item, setItem] = useState<ScreenshotRecord | null>(null)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [finalName, setFinalName] = useState<string>('')
  const [category, setCategory] = useState<string>('Others')
  const [customFolderInput, setCustomFolderInput] = useState<string>('')
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState<boolean>(false)
  const [availableCategories, setAvailableCategories] = useState<string[]>([...DEFAULT_CATEGORIES])
  const [description, setDescription] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [confirmedSuccess, setConfirmedSuccess] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const syncItemFields = useCallback((record: ScreenshotRecord) => {
    setItem(record)
    setConfirmedSuccess(null)
    setErrorMsg(null)
    const baseName =
      record.suggested_name || record.original_name.replace(/\.(png|jpe?g|webp)$/i, '')
    setFinalName(baseName)
    setCategory(record.category || 'Others')
    setDescription(record.description || '')
  }, [])

  const loadLatestPending = useCallback(async () => {
    try {
      const [pending, currentSettings] = await Promise.all([
        window.screenshotAPI.getPendingScreenshots(),
        window.screenshotAPI.getSettings()
      ])
      let physical: string[] = []
      if (window.screenshotAPI?.getPhysicalFolders && currentSettings?.destinationFolder) {
        try {
          physical = await window.screenshotAPI.getPhysicalFolders(currentSettings.destinationFolder)
        } catch {
          // Ignore
        }
      }
      const includeDefaults = currentSettings?.useDefaultCategories !== false
      const combined = Array.from(
        new Set([
          ...physical,
          ...(currentSettings?.customCategories || []),
          ...(includeDefaults ? DEFAULT_CATEGORIES : [])
        ])
      ).filter(Boolean).sort()

      setAvailableCategories(
        combined.length > 0 ? combined : includeDefaults ? [...DEFAULT_CATEGORIES] : ['Others']
      )

      if (pending.length > 0) {
        syncItemFields(pending[0])
      }
    } catch {
      // Ignore
    }
  }, [syncItemFields])

  useEffect(() => {
    void loadLatestPending()

    const unsubNew = window.screenshotAPI.onNewScreenshot((record) => {
      syncItemFields(record)
    })

    const unsubUpdated = window.screenshotAPI.onScreenshotUpdated((record) => {
      syncItemFields(record)
    })

    return () => {
      unsubNew()
      unsubUpdated()
    }
  }, [loadLatestPending, syncItemFields])

  useEffect(() => {
    let active = true
    if (!item?.id) {
      setThumbUrl(null)
      return
    }
    window.screenshotAPI
      .getImageDataUrl(item.id)
      .then((url) => {
        if (active) setThumbUrl(url)
      })
      .catch(() => {
        if (active) setThumbUrl(null)
      })
    return () => {
      active = false
    }
  }, [item?.id, item?.updated_at])

  const handleClose = async () => {
    await window.screenshotAPI.closeQuickPopup()
  }

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!item || busy) return
    if (!finalName.trim()) {
      setErrorMsg('Tên file không được để trống')
      return
    }

    setBusy(true)
    setErrorMsg(null)
    try {
      let finalCategory = category || 'Others'
      if (isCreatingNewFolder && customFolderInput.trim()) {
        const cleanCustom = customFolderInput.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
        if (cleanCustom) {
          finalCategory = cleanCustom
          void window.screenshotAPI.addCategory(cleanCustom).catch(() => { })
          if (window.screenshotAPI?.createPhysicalFolder) {
            void window.screenshotAPI.createPhysicalFolder(cleanCustom).catch(() => { })
          }
        }
      }

      const saved = await window.screenshotAPI.confirmScreenshot({
        id: item.id,
        finalName: finalName.trim(),
        category: finalCategory,
        description: description.trim(),
        tags: item.tags || []
      })
      setItem(saved)
      setConfirmedSuccess(saved.final_name)
      setTimeout(() => {
        void window.screenshotAPI.closeQuickPopup()
      }, 1500)
    } catch (err) {
      setErrorMsg((err as Error).message || 'Không thể đổi tên file')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!item || busy) return
    setBusy(true)
    try {
      await window.screenshotAPI.rejectScreenshot(item.id)
      await window.screenshotAPI.closeQuickPopup()
    } finally {
      setBusy(false)
    }
  }

  const handleRetry = async () => {
    if (!item || busy) return
    setBusy(true)
    setErrorMsg(null)
    try {
      await window.screenshotAPI.retryAnalysis(item.id)
    } catch (err) {
      setErrorMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const ext = item ? getFileExtension(item.original_name) : '.png'
  const isAnalyzing = item?.status === 'pending' || item?.status === 'analyzing'

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          void handleClose()
        }
      }}
      className="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 border-2 border-indigo-500/80 rounded-xl overflow-hidden shadow-2xl select-none"
    >
      {/* Top Draggable Titlebar */}
      <div
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-b border-slate-800 shrink-0"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center text-white">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-xs font-bold tracking-tight text-white">
            AI Screenshot — Xác nhận đổi tên nhanh
          </span>
        </div>

        <div
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="flex items-center gap-1"
        >
          <button
            type="button"
            onClick={() => void window.screenshotAPI.openMainWindow()}
            className="px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1"
            title="Mở cửa sổ quản lý chính"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Mở App</span>
          </button>
          <button
            type="button"
            onClick={() => void handleClose()}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-rose-600/80 transition-colors"
            title="Đóng thông báo (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Notification Body */}
      <div className="flex-1 p-3.5 flex flex-col justify-between overflow-y-auto">
        {!item ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            Chưa có ảnh chụp màn hình mới.
          </div>
        ) : confirmedSuccess || item.status === 'saved' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-3 space-y-2.5">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-300">Đã đổi tên ảnh thành công!</p>
              <p className="text-xs font-mono text-white mt-1 break-all">
                {confirmedSuccess || item.final_name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void window.screenshotAPI.openScreenshotLocation(item.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Xem trong thư mục</span>
            </button>
          </div>
        ) : isAnalyzing ? (
          <div className="flex-1 flex items-center gap-3.5 p-2">
            <div className="w-28 h-20 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
              {thumbUrl ? (
                <img src={thumbUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageOff className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>AI đang phân tích ảnh vừa chụp...</span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                {item.original_name}
              </p>
              <p className="text-[11px] text-slate-500">
                Tên file gợi ý sẽ hiện ngay tại đây sau vài giây để bạn xác nhận.
              </p>
            </div>
          </div>
        ) : item.status === 'failed' ? (
          <div className="flex-1 flex flex-col justify-between gap-2">
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/70 text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Chưa thể phân tích bằng AI</p>
                <p className="text-[11px] text-rose-300/90 mt-0.5 line-clamp-2">
                  {item.error_message || 'Vui lòng kiểm tra API Key trong Settings.'}
                </p>
              </div>
            </div>

            {/* Still allow user to manually type a name and confirm even if AI failed! */}
            <form onSubmit={handleConfirm} className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Đặt tên file thủ công hoặc bấm Thử lại AI:
                </label>
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
                  <input
                    type="text"
                    value={finalName}
                    onChange={(e) => setFinalName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-transparent text-white focus:outline-none"
                  />
                  <span className="px-2 py-1.5 text-[11px] font-mono bg-slate-800 text-slate-400">
                    {ext}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Thử lại AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void window.screenshotAPI.openMainWindow()}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300"
                  >
                    Cài đặt API Key
                  </button>
                </div>

                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Đổi tên</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Ready for Review & Instant Confirmation */
          <form onSubmit={handleConfirm} className="flex-1 flex flex-col justify-between gap-2.5">
            {/* Top row: Thumbnail + Description + Confidence */}
            <div className="flex items-start gap-3">
              <div className="w-24 h-16 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                {thumbUrl ? (
                  <img src={thumbUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 truncate">
                    {category}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-400 shrink-0">
                    {item.tags?.includes('Manual')
                      ? 'Thủ công (Không AI)'
                      : `Độ tin cậy: ${formatConfidence(item.confidence)}`}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 mt-1">
                  {description || 'Ảnh chụp màn hình đã được AI phân tích.'}
                </p>
              </div>
            </div>

            {errorMsg && (
              <p className="text-[11px] text-rose-400 bg-rose-950/50 px-2.5 py-1 rounded border border-rose-800/50">
                {errorMsg}
              </p>
            )}

            {/* Editable AI Suggested Filename */}
            <div>
              <label className="block text-[11px] font-semibold text-indigo-300 mb-1">
                Tên file AI đề xuất (bạn có thể sửa trước khi xác nhận):
              </label>
              <div className="flex items-center rounded-lg border-2 border-indigo-500/70 bg-slate-950 focus-within:border-indigo-400 overflow-hidden">
                <input
                  type="text"
                  autoFocus
                  value={finalName}
                  maxLength={60}
                  onChange={(e) => setFinalName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono font-semibold bg-transparent text-white focus:outline-none"
                />
                <span className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 text-slate-300 border-l border-slate-700">
                  {ext}
                </span>
              </div>
            </div>

            {/* Category Quick Selector + Confirm/Reject Buttons */}
            <div className="space-y-1.5 pt-1">
              {!isCreatingNewFolder ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <select
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === '__NEW_FOLDER__') {
                          setIsCreatingNewFolder(true)
                          setCustomFolderInput('')
                        } else {
                          setCategory(e.target.value)
                        }
                      }}
                      className="px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-[11px] text-slate-300 flex-1 truncate"
                      title="Chọn folder lưu ảnh"
                    >
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          📁 {cat}
                        </option>
                      ))}
                      <option value="__NEW_FOLDER__">➕ Tạo Folder mới...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewFolder(true)
                        setCustomFolderInput('')
                      }}
                      className="px-2 py-1.5 rounded-lg border border-indigo-700/60 bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 text-[11px] shrink-0 font-medium"
                      title="Tạo folder mới"
                    >
                      + Folder
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleReject}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Bỏ qua
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{busy ? 'Đang lưu...' : 'Đổi tên'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 p-2 rounded-lg border border-indigo-500/60 bg-indigo-950/40">
                  <label className="block text-[11px] font-semibold text-indigo-300">
                    Nhập tên Folder mới:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={customFolderInput}
                      onChange={(e) => setCustomFolderInput(e.target.value)}
                      placeholder="Tên folder mới"
                      className="flex-1 px-2.5 py-1 rounded border border-indigo-400 bg-slate-950 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customFolderInput.trim()) {
                          const clean = customFolderInput.trim()
                          setCategory(clean)
                          if (!availableCategories.includes(clean)) {
                            setAvailableCategories((prev) => [...prev, clean])
                          }
                        }
                        setIsCreatingNewFolder(false)
                      }}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewFolder(false)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
