import React from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  XCircle
} from 'lucide-react'
import type { ScreenshotStatus } from '../types/screenshot'

interface StatusBadgeProps {
  status: ScreenshotStatus
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: Record<
  ScreenshotStatus,
  {
    label: string
    classes: string
    icon: React.ComponentType<{ className?: string }>
    spin?: boolean
  }
> = {
  pending: {
    label: 'Queued',
    classes:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: Clock
  },
  analyzing: {
    label: 'Analyzing AI',
    classes:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/70',
    icon: Loader2,
    spin: true
  },
  review: {
    label: 'Needs Review',
    classes:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
    icon: Eye
  },
  approved: {
    label: 'Approved',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: CheckCircle2
  },
  saved: {
    label: 'Saved',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: CheckCircle2
  },
  rejected: {
    label: 'Rejected',
    classes:
      'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700',
    icon: XCircle
  },
  failed: {
    label: 'Failed',
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
    icon: AlertCircle
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-full ${cfg.classes} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${cfg.spin ? 'animate-spin' : ''}`} />
      <span>{cfg.label}</span>
    </span>
  )
}
