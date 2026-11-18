import React, { useEffect, useState } from 'react'
import {
  Check,
  Edit2,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Plus,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react'
import { DEFAULT_CATEGORIES } from '../types/screenshot'

interface FolderTreeProps {
  distribution: Array<{ category: string; count: number }>
  customCategories?: string[]
  selectedCategory?: string
  destinationFolder?: string
  onSelectCategory?: (category: string) => void
  onAddCategory?: (category: string) => Promise<void>
  onRemoveCategory?: (category: string) => Promise<void>
  onRenameCategory?: (oldCategory: string, newCategory: string) => Promise<void>
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  distribution,
  customCategories = [],
  selectedCategory = 'all',
  destinationFolder,
  onSelectCategory,
  onAddCategory,
  onRemoveCategory,
  onRenameCategory
}) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [busy, setBusy] = useState(false)
  const [physicalFolders, setPhysicalFolders] = useState<string[]>([])
  const [isScanning, setIsScanning] = useState(false)

  // Fetch real physical subfolders on disk whenever destinationFolder changes or on mount
  const refreshPhysicalFolders = async () => {
    if (!window.screenshotAPI?.getPhysicalFolders) return
    setIsScanning(true)
    try {
      const folders = await window.screenshotAPI.getPhysicalFolders(destinationFolder)
      setPhysicalFolders(folders || [])
    } catch {
      // Ignore scan failure
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    void refreshPhysicalFolders()
  }, [destinationFolder])

  // Group categories into count map
  const countMap = new Map<string, number>()
  let totalCount = 0

  for (const item of distribution) {
    countMap.set(item.category, (countMap.get(item.category) || 0) + item.count)
    totalCount += item.count
  }

  // Combine Physical disk folders + Custom categories + DB distribution + Defaults
  const allCategories = Array.from(
    new Set([
      ...physicalFolders,
      ...customCategories,
      ...DEFAULT_CATEGORIES,
      ...distribution.map((d) => d.category)
    ])
  ).sort()

  const tree = new Map<string, string[]>()
  for (const cat of allCategories) {
    const parts = cat.split('/')
    const parent = parts[0] || 'Others'
    const sub = parts.slice(1).join('/')
    if (!tree.has(parent)) {
      tree.set(parent, [])
    }
    if (sub && !tree.get(parent)!.includes(cat)) {
      tree.get(parent)!.push(cat)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = newCategoryName.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
    if (!clean || !onAddCategory) return
    setBusy(true)
    try {
      await onAddCategory(clean)
      // Also ensure the physical directory is immediately created on disk
      if (window.screenshotAPI?.createPhysicalFolder) {
        await window.screenshotAPI.createPhysicalFolder(clean)
      }
      setNewCategoryName('')
      setShowAddForm(false)
      await refreshPhysicalFolders()
    } finally {
      setBusy(false)
    }
  }

  const handleStartRename = (cat: string) => {
    setEditingCategory(cat)
    setEditingName(cat)
  }

  const handleSaveRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editingCategory || !onRenameCategory) return
    const clean = editingName.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
    if (!clean) return
    setBusy(true)
    try {
      await onRenameCategory(editingCategory, clean)
      setEditingCategory(null)
      setEditingName('')
      await refreshPhysicalFolders()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (cat: string) => {
    if (!onRemoveCategory) return
    const confirmed = window.confirm(`Bạn có chắc muốn xóa folder "${cat}" khỏi danh sách?`)
    if (!confirmed) return
    setBusy(true)
    try {
      await onRemoveCategory(cat)
      await refreshPhysicalFolders()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Folder Organization
            </h3>
            <button
              type="button"
              onClick={() => void refreshPhysicalFolders()}
              title="Quét lại thư mục thực tế trên ổ đĩa"
              className={`p-1 rounded text-slate-400 hover:text-indigo-400 ${
                isScanning ? 'animate-spin text-indigo-500' : ''
              }`}
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <span className="text-[11px] text-slate-400">
            {physicalFolders.length > 0
              ? `${physicalFolders.length} folder trên ổ đĩa • ${totalCount} ảnh`
              : `${totalCount} ảnh trong các thư mục`}
          </span>
        </div>
        {onAddCategory && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center gap-1 transition-colors"
            title="Thêm folder mới"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Thêm Folder</span>
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/40 space-y-2">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Nhập tên thư mục mới (vd: <code>Projects/Design</code> hoặc <code>Receipts</code>):
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Parent/Subfolder hoặc TênThưMục"
              className="flex-1 px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !newCategoryName.trim()}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}

      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {onSelectCategory && (
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tất cả thư mục</span>
            </span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {totalCount}
            </span>
          </button>
        )}

        {Array.from(tree.entries()).map(([parent, subCategories]) => {
          const parentDirectCount = countMap.get(parent) || 0
          const subTotal = subCategories.reduce((acc, sub) => acc + (countMap.get(sub) || 0), 0)
          const groupTotal = parentDirectCount + subTotal
          const isCustomParent = customCategories.includes(parent)

          return (
            <div key={parent} className="pt-1">
              {editingCategory === parent ? (
                <div className="flex items-center gap-1 px-1 py-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs rounded border border-indigo-400 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveRename()}
                    className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="p-1 rounded text-slate-400 hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="group flex items-center justify-between rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => onSelectCategory && onSelectCategory(parent)}
                    className="flex-1 flex items-center gap-2 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
                  >
                    {physicalFolders.some((f) => f === parent || f.startsWith(`${parent}/`)) ? (
                      <span title="Thư mục thực tế trên ổ cứng">
                        <HardDrive className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      </span>
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate">{parent}/</span>
                    {groupTotal > 0 && (
                      <span className="text-[11px] px-1.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-300">
                        {groupTotal}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onRenameCategory && (
                      <button
                        type="button"
                        onClick={() => handleStartRename(parent)}
                        className="p-1 text-slate-400 hover:text-indigo-400 rounded"
                        title="Đổi tên thư mục"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    {onRemoveCategory && isCustomParent && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(parent)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded"
                        title="Xóa thư mục"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {subCategories.length > 0 && (
                <div className="pl-4 mt-0.5 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-4">
                  {subCategories.map((fullCat) => {
                    const count = countMap.get(fullCat) || 0
                    const subLabel = fullCat.split('/').slice(1).join('/')
                    const isCustomSub = customCategories.includes(fullCat)

                    if (editingCategory === fullCat) {
                      return (
                        <div key={fullCat} className="flex items-center gap-1 py-0.5">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 px-1.5 py-0.5 text-xs rounded border border-indigo-400 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveRename()}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategory(null)}
                            className="p-1 rounded text-slate-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={fullCat}
                        className="group flex items-center justify-between rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50 px-2 py-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectCategory && onSelectCategory(fullCat)}
                          className={`flex-1 flex items-center justify-between text-xs transition-colors truncate ${
                            selectedCategory === fullCat
                              ? 'font-medium text-indigo-700 dark:text-indigo-300'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="truncate">{subLabel}</span>
                          {count > 0 && (
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              {count}
                            </span>
                          )}
                        </button>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onRenameCategory && (
                            <button
                              type="button"
                              onClick={() => handleStartRename(fullCat)}
                              className="p-1 text-slate-400 hover:text-indigo-400 rounded"
                              title="Đổi tên"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {onRemoveCategory && (isCustomSub || count === 0) && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(fullCat)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded"
                              title="Xóa"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
