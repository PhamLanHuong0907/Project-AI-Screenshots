import React from 'react'
import {
  Camera,
  CheckSquare,
  Images,
  LayoutDashboard,
  Moon,
  Settings,
  Sun
} from 'lucide-react'

export type NavTab = 'dashboard' | 'review' | 'library' | 'settings'

interface SidebarProps {
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  pendingCount: number
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingCount,
  theme,
  onToggleTheme
}) => {
  const navItems: Array<{
    id: NavTab
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      id: 'review',
      label: 'Review Queue',
      icon: CheckSquare,
      badge: pendingCount
    },
    {
      id: 'library',
      label: 'Screenshot Library',
      icon: Images
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings
    }
  ]

  return (
    <aside className="w-60 shrink-0 h-full flex flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
              AI Screenshot
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Smart Organizer
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/90 dark:text-amber-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Bottom Footer / Theme Toggle */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </span>
          <span className="text-[11px] text-slate-400 capitalize">{theme}</span>
        </button>

        <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80">
          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
            Review-Before-Save
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Files are never moved until you confirm.
          </p>
        </div>
      </div>
    </aside>
  )
}
