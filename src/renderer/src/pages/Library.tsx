import React, { useEffect, useState } from 'react'
import {
  Calendar,
  FolderOpen,
  Hash,
  Images,
  Search,
  Tag,
  X
} from 'lucide-react'
import type {
  ScreenshotRecord,
  ScreenshotStatus,
  SearchScreenshotsQuery
} from '../types/screenshot'
import { EmptyState } from '../components/EmptyState'
import { FolderTree } from '../components/FolderTree'
import { ImagePreview } from '../components/ImagePreview'
import { ScreenshotCard } from '../components/ScreenshotCard'
import { StatusBadge } from '../components/StatusBadge'
import { formatConfidence, formatDateTime, formatFileSize } from '../utils/formatters'

interface LibraryProps {
  allScreenshots: ScreenshotRecord[]
  categoryDistribution: Array<{ category: string; count: number }>
  customCategories?: string[]
  useDefaultCategories?: boolean
  destinationFolder?: string
  onSearch: (query: SearchScreenshotsQuery) => Promise<ScreenshotRecord[]>
  onOpenLocation: (id: string) => void
  onAddCategory?: (category: string) => Promise<void>
  onRemoveCategory?: (category: string) => Promise<void>
  onRenameCategory?: (oldCategory: string, newCategory: string) => Promise<void>
}

export const Library: React.FC<LibraryProps> = ({
  allScreenshots,
  categoryDistribution,
  customCategories = [],
  useDefaultCategories = true,
  destinationFolder,
  onSearch,
  onOpenLocation,
  onAddCategory,
  onRemoveCategory,
  onRenameCategory
}) => {
  const [searchText, setSearchText] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<ScreenshotStatus | 'all'>('saved')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  const [results, setResults] = useState<ScreenshotRecord[]>([])
  const [selectedItem, setSelectedItem] = useState<ScreenshotRecord | null>(null)

  // Collect all unique tags across screenshots for quick filtering
  const availableTags = Array.from(
    new Set(allScreenshots.flatMap((s) => s.tags || []))
  ).slice(0, 30)

  useEffect(() => {
    let active = true
    onSearch({
      search: searchText || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      tag: selectedTag || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      status: statusFilter
    })
      .then((rows) => {
        if (active) setResults(rows)
      })
      .catch(() => {
        if (active) setResults([])
      })
    return () => {
      active = false
    }
  }, [
    searchText,
    selectedCategory,
    selectedTag,
    statusFilter,
    dateFrom,
    dateTo,
    allScreenshots,
    onSearch
  ])

  const handleResetFilters = () => {
    setSearchText('')
    setSelectedCategory('all')
    setSelectedTag('')
    setStatusFilter('saved')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="h-full flex flex-col p-6 gap-5 overflow-hidden">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shrink-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by filename, Vietnamese description, or keyword..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ScreenshotStatus | 'all')}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="saved">Saved Library Only</option>
          <option value="all">All Statuses</option>
          <option value="review">Pending Review</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>

        {/* Tag Filter */}
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 max-w-[180px]"
        >
          <option value="">All Tags</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>

        {/* Date Range Filters */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
            title="From Date"
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
            title="To Date"
          />
        </div>

        {(searchText ||
          selectedCategory !== 'all' ||
          selectedTag ||
          dateFrom ||
          dateTo ||
          statusFilter !== 'saved') && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-2 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main Content Split: Folder Tree Sidebar | Screenshot Grid | Detail Drawer */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
        {/* Left Folder Filter Tree (3 cols) */}
        <div className="lg:col-span-3 overflow-y-auto space-y-4">
          <FolderTree
            distribution={categoryDistribution}
            customCategories={customCategories}
            useDefaultCategories={useDefaultCategories}
            destinationFolder={destinationFolder}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => setSelectedCategory(cat)}
            onAddCategory={onAddCategory}
            onRemoveCategory={onRemoveCategory}
            onRenameCategory={onRenameCategory}
          />
        </div>

        {/* Center/Right Grid (9 cols, or 5 cols when Detail Inspector is open) */}
        <div
          className={`${
            selectedItem ? 'lg:col-span-5' : 'lg:col-span-9'
          } overflow-y-auto pr-1`}
        >
          {results.length === 0 ? (
            <EmptyState
              icon={Images}
              title="No Matching Screenshots Found"
              description="Try adjusting your search query, category filter, or confirm pending items in the Review Queue."
              actionLabel="Reset Filters"
              onAction={handleResetFilters}
            />
          ) : (
            <div
              className={`grid gap-4 ${
                selectedItem
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
              }`}
            >
              {results.map((item) => (
                <ScreenshotCard
                  key={item.id}
                  screenshot={item}
                  selected={selectedItem?.id === item.id}
                  onSelect={(clicked) => setSelectedItem(clicked)}
                  onOpenLocation={onOpenLocation}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Detail Inspector Drawer when an item is clicked */}
        {selectedItem && (
          <div className="lg:col-span-4 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
              <div className="flex items-center gap-2 min-w-0">
                <StatusBadge status={selectedItem.status} />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  Metadata Details
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-56 p-3 border-b border-slate-100 dark:border-slate-800">
              <ImagePreview
                screenshot={selectedItem}
                onOpenLocation={onOpenLocation}
                compact
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">Final Filename</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100 break-all mt-0.5">
                  {selectedItem.final_name || selectedItem.suggested_name || selectedItem.original_name}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400">Category</p>
                <p className="font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {selectedItem.category}
                </p>
              </div>

              {selectedItem.description && (
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-400">Description</p>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400 mb-1">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItem.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(tag)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-[10px] uppercase text-slate-400">Dimensions & Size</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedItem.width}×{selectedItem.height} • {formatFileSize(selectedItem.file_size)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-400">AI Confidence</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {formatConfidence(selectedItem.confidence)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-400">Original Name</p>
                  <p className="font-mono text-slate-600 dark:text-slate-400 truncate" title={selectedItem.original_name}>
                    {selectedItem.original_name}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-400">Captured At</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    {formatDateTime(selectedItem.created_at)}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] uppercase text-slate-400">File Location</p>
                <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all mt-0.5">
                  {selectedItem.final_path || selectedItem.original_path}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> SHA-256 Checksum
                </p>
                <p className="font-mono text-[10px] text-slate-500 break-all mt-0.5">
                  {selectedItem.file_hash}
                </p>
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => onOpenLocation(selectedItem.id)}
                className="w-full py-2 px-4 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Show in Windows Explorer</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
