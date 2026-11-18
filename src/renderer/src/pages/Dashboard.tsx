import React from 'react'
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  Sparkles
} from 'lucide-react'
import type { DashboardStats, ScreenshotRecord } from '../types/screenshot'
import { EmptyState } from '../components/EmptyState'
import { FolderTree } from '../components/FolderTree'
import { ScreenshotCard } from '../components/ScreenshotCard'
import type { NavTab } from '../components/Sidebar'

interface DashboardProps {
  stats: DashboardStats
  sourceFolder: string
  destinationFolder: string
  customCategories?: string[]
  useDefaultCategories?: boolean
  onNavigate: (tab: NavTab) => void
  onSelectForReview: (screenshot: ScreenshotRecord) => void
  onOpenLocation: (id: string) => void
  onScanExisting: () => void
  onAddCategory?: (category: string) => Promise<void>
  onRemoveCategory?: (category: string) => Promise<void>
  onRenameCategory?: (oldCategory: string, newCategory: string) => Promise<void>
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  sourceFolder,
  destinationFolder,
  customCategories = [],
  useDefaultCategories = true,
  onNavigate,
  onSelectForReview,
  onOpenLocation,
  onScanExisting,
  onAddCategory,
  onRemoveCategory,
  onRenameCategory
}) => {
  const metricCards = [
    {
      label: 'Total Screenshots',
      value: stats.total,
      subtext: stats.analyzing > 0 ? `${stats.analyzing} currently analyzing` : 'All tracked files',
      icon: Layers,
      accent: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 border-indigo-100 dark:border-indigo-900/60',
      onClick: () => onNavigate('library')
    },
    {
      label: 'Waiting for Review',
      value: stats.pendingReview,
      subtext: 'Ready for your confirmation',
      icon: Clock,
      accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/70 border-amber-100 dark:border-amber-900/60',
      onClick: () => onNavigate('review')
    },
    {
      label: 'Saved Successfully',
      value: stats.saved,
      subtext: 'Renamed & organized in folders',
      icon: CheckCircle2,
      accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border-emerald-100 dark:border-emerald-900/60',
      onClick: () => onNavigate('library')
    },
    {
      label: 'Failed Tasks',
      value: stats.failed,
      subtext: stats.failed > 0 ? 'Click to inspect & retry' : 'No failed analyses',
      icon: AlertOctagon,
      accent: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/70 border-rose-100 dark:border-rose-900/60',
      onClick: () => onNavigate('review')
    }
  ]

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Top Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${card.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {card.value}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                <span>{card.subtext}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
              </p>
            </button>
          )
        })}
      </div>

      {/* Active Paths Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Monitored Source Folder
            </p>
            <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate mt-1" title={sourceFolder}>
              {sourceFolder}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0"
          >
            Change
          </button>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Organized Destination Root
            </p>
            <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate mt-1" title={destinationFolder}>
              {destinationFolder}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0"
          >
            Change
          </button>
        </div>
      </div>

      {/* Main Content Split: Recent Screenshots & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Recently Processed Screenshots */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Recently Processed Screenshots
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any item to review its AI analysis or view it in your library
              </p>
            </div>
            {stats.recentScreenshots.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('review')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Go to Review Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {stats.recentScreenshots.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No Screenshots Detected Yet"
              description="Take a new screenshot on Windows and save it to your monitored Screenshots folder, or click below to scan existing images in your folder."
              actionLabel="Scan Monitored Folder Now"
              onAction={onScanExisting}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.recentScreenshots.map((item) => (
                <ScreenshotCard
                  key={item.id}
                  screenshot={item}
                  onSelect={(clicked) => {
                    if (clicked.status === 'saved') {
                      onNavigate('library')
                    } else {
                      onSelectForReview(clicked)
                    }
                  }}
                  onOpenLocation={onOpenLocation}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Category Distribution & Folder Tree */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Category Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI classification breakdown across folders
            </p>
          </div>

          {stats.categoryDistribution.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
              {stats.categoryDistribution.slice(0, 6).map((cat) => {
                const maxCount = Math.max(...stats.categoryDistribution.map((c) => c.count), 1)
                const pct = Math.round((cat.count / maxCount) * 100)
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-1.5">
                        <FolderKanban className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        {cat.category}
                      </span>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        {cat.count}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <FolderTree
            distribution={stats.categoryDistribution}
            customCategories={customCategories}
            useDefaultCategories={useDefaultCategories}
            destinationFolder={destinationFolder}
            onAddCategory={onAddCategory}
            onRemoveCategory={onRemoveCategory}
            onRenameCategory={onRenameCategory}
            onSelectCategory={() => onNavigate('library')}
          />
        </div>
      </div>
    </div>
  )
}
