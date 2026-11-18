import React, { useEffect, useState } from 'react'
import {
  ExternalLink,
  ImageOff,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type { ScreenshotRecord } from '../types/screenshot'
import { formatFileSize } from '../utils/formatters'

interface ImagePreviewProps {
  screenshot: ScreenshotRecord | null
  onOpenLocation?: (id: string) => void
  compact?: boolean
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  screenshot,
  onOpenLocation,
  compact = false
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(1)

  useEffect(() => {
    let active = true
    setZoom(1)

    if (!screenshot) {
      setDataUrl(null)
      return
    }

    setLoading(true)
    window.screenshotAPI
      .getImageDataUrl(screenshot.id)
      .then((url) => {
        if (active) {
          setDataUrl(url)
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl(null)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [screenshot?.id, screenshot?.updated_at])

  if (!screenshot) {
    return (
      <div className="h-full flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/50 p-6 text-slate-400">
        No screenshot selected
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      {!compact && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
          <div className="min-w-0">
            <p
              className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate"
              title={screenshot.original_name}
            >
              Original: <span className="font-mono">{screenshot.original_name}</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {screenshot.width && screenshot.height
                ? `${screenshot.width} × ${screenshot.height} px`
                : 'Dimensions unknown'}{' '}
              • {formatFileSize(screenshot.file_size)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2 py-1 rounded text-xs font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              title="Fit to View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            {onOpenLocation && (
              <button
                type="button"
                onClick={() => onOpenLocation(screenshot.id)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                title="Show in Windows Explorer"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative flex-1 flex items-center justify-center overflow-auto bg-slate-100/80 dark:bg-slate-950/70 p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Loading image preview...</span>
          </div>
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt={screenshot.suggested_name || screenshot.original_name}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center'
            }}
            className="max-h-full max-w-full object-contain rounded-lg shadow-sm transition-transform duration-150"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400 p-6 text-center">
            <ImageOff className="w-8 h-8 stroke-1" />
            <p className="text-xs">Preview unavailable (file may have been moved or deleted)</p>
          </div>
        )}
      </div>
    </div>
  )
}
