import React, { useEffect, useState } from 'react'
import { FolderOpen, ImageOff, Sparkles, Tag } from 'lucide-react'
import type { ScreenshotRecord } from '../types/screenshot'
import { formatConfidence, formatDateTime } from '../utils/formatters'
import { StatusBadge } from './StatusBadge'

interface ScreenshotCardProps {
  screenshot: ScreenshotRecord
  selected?: boolean
  onSelect?: (screenshot: ScreenshotRecord) => void
  onOpenLocation?: (id: string) => void
}

export const ScreenshotCard: React.FC<ScreenshotCardProps> = ({
  screenshot,
  selected = false,
  onSelect,
  onOpenLocation
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    window.screenshotAPI
      .getImageDataUrl(screenshot.id)
      .then((url) => {
        if (mounted) setThumbUrl(url)
      })
      .catch(() => {
        if (mounted) setThumbUrl(null)
      })
    return () => {
      mounted = false
    }
  }, [screenshot.id, screenshot.updated_at])

  const displayName =
    screenshot.final_name || screenshot.suggested_name || screenshot.original_name

  return (
    <div
      onClick={() => onSelect && onSelect(screenshot)}
      className={`group flex flex-col rounded-xl border transition-all cursor-pointer overflow-hidden bg-white dark:bg-slate-900 ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
      }`}
    >
      {/* Thumbnail container */}
      <div className="relative h-40 w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-slate-800/80">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={displayName}
            className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-200"
          />
        ) : (
          <ImageOff className="w-7 h-7 text-slate-400 stroke-1" />
        )}

        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={screenshot.status} />
        </div>

        {screenshot.confidence > 0 && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-900/75 text-white backdrop-blur-sm flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>{formatConfidence(screenshot.confidence)}</span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 truncate max-w-[200px]">
              {screenshot.category || 'Others'}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
              {formatDateTime(screenshot.created_at)}
            </span>
          </div>

          <h4
            className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate"
            title={displayName}
          >
            {displayName}
          </h4>

          {screenshot.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
              {screenshot.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/70">
          <div className="flex items-center gap-1 flex-wrap overflow-hidden max-h-5">
            {screenshot.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>

          {onOpenLocation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenLocation(screenshot.id)
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Open file location in Windows Explorer"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
