import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import type {
  ConfirmScreenshotPayload,
  ScreenshotRecord,
  UpdateScreenshotPayload
} from '../types/screenshot'
import { EmptyState } from '../components/EmptyState'
import { ImagePreview } from '../components/ImagePreview'
import { ReviewPanel } from '../components/ReviewPanel'
import { StatusBadge } from '../components/StatusBadge'

interface ReviewProps {
  queue: ScreenshotRecord[]
  selectedId: string | null
  onSelectId: (id: string | null) => void
  destinationRoot: string
  onConfirm: (payload: ConfirmScreenshotPayload) => Promise<ScreenshotRecord>
  onReject: (id: string) => Promise<ScreenshotRecord>
  onRetry: (id: string) => Promise<ScreenshotRecord>
  onSaveDraft: (payload: UpdateScreenshotPayload) => Promise<ScreenshotRecord>
  onOpenLocation: (id: string) => void
  onScanExisting: () => void
}

export const Review: React.FC<ReviewProps> = ({
  queue,
  selectedId,
  onSelectId,
  destinationRoot,
  onConfirm,
  onReject,
  onRetry,
  onSaveDraft,
  onOpenLocation,
  onScanExisting
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'review' | 'analyzing' | 'failed'>('all')

  const filteredQueue = queue.filter((item) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'analyzing') {
      return item.status === 'analyzing' || item.status === 'pending'
    }
    return item.status === statusFilter
  })

  useEffect(() => {
    if (filteredQueue.length === 0) {
      onSelectId(null)
      return
    }
    const stillExists = filteredQueue.some((i) => i.id === selectedId)
    if (!stillExists) {
      onSelectId(filteredQueue[0].id)
    }
  }, [filteredQueue, selectedId, onSelectId])

  const currentIndex = filteredQueue.findIndex((i) => i.id === selectedId)
  const currentScreenshot =
    currentIndex >= 0 ? filteredQueue[currentIndex] : filteredQueue[0] || null

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectId(filteredQueue[currentIndex - 1].id)
    }
  }

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < filteredQueue.length - 1) {
      onSelectId(filteredQueue[currentIndex + 1].id)
    }
  }

  if (queue.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <EmptyState
          icon={CheckCircle2}
          title="Review Queue is All Clear!"
          description="All detected screenshots have been reviewed. Take a new screenshot or scan your Screenshots folder to analyze existing images."
          actionLabel="Scan Monitored Folder"
          onAction={onScanExisting}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
      {/* Top Queue Navigation & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          {(
            [
              { id: 'all', label: `All Queue (${queue.length})` },
              {
                id: 'review',
                label: `Ready (${queue.filter((i) => i.status === 'review').length})`
              },
              {
                id: 'analyzing',
                label: `Analyzing (${
                  queue.filter((i) => i.status === 'analyzing' || i.status === 'pending').length
                })`
              },
              {
                id: 'failed',
                label: `Failed (${queue.filter((i) => i.status === 'failed').length})`
              }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Queue Stepper Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {filteredQueue.length > 0
              ? `Item ${Math.max(1, currentIndex + 1)} of ${filteredQueue.length}`
              : '0 items'}
          </span>
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <button
              type="button"
              disabled={currentIndex <= 0}
              onClick={handlePrev}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              title="Previous screenshot"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentIndex < 0 || currentIndex >= filteredQueue.length - 1}
              onClick={handleNext}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 border-l border-slate-200 dark:border-slate-800"
              title="Next screenshot"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split View: Queue Strip + Image Preview (Left) | Editable Metadata Form (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
        {/* Queue List Column (2 cols on large screens) */}
        <div className="lg:col-span-3 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Pending Items
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredQueue.map((item) => {
              const isSelected = item.id === currentScreenshot?.id
              const title = item.suggested_name || item.original_name
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectId(item.id)}
                  className={`w-full text-left p-3 transition-colors flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-l-4 border-l-indigo-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 truncate max-w-[110px]">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {title}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 truncate">
                    {item.original_name}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Center Column: Interactive Screenshot Preview (5 cols) */}
        <div className="lg:col-span-5 min-h-0 flex flex-col">
          <ImagePreview
            screenshot={currentScreenshot}
            onOpenLocation={onOpenLocation}
          />
        </div>

        {/* Right Column: Editable AI Metadata & Confirmation Form (4 cols) */}
        <div className="lg:col-span-4 min-h-0 flex flex-col">
          {currentScreenshot ? (
            <ReviewPanel
              screenshot={currentScreenshot}
              destinationRoot={destinationRoot}
              onConfirm={async (payload) => {
                await onConfirm(payload)
              }}
              onReject={async (id) => {
                await onReject(id)
              }}
              onRetry={async (id) => {
                await onRetry(id)
              }}
              onSaveDraft={async (payload) => {
                await onSaveDraft(payload)
              }}
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No Item Selected"
              description="Select a screenshot from the queue on the left to review and edit its AI suggestions."
            />
          )}
        </div>
      </div>
    </div>
  )
}
