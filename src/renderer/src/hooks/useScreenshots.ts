import { useCallback, useEffect, useState } from 'react'
import type {
  ConfirmScreenshotPayload,
  DashboardStats,
  ScreenshotRecord,
  SearchScreenshotsQuery,
  UpdateScreenshotPayload
} from '../types/screenshot'

const EMPTY_STATS: DashboardStats = {
  total: 0,
  pendingReview: 0,
  analyzing: 0,
  saved: 0,
  failed: 0,
  rejected: 0,
  recentScreenshots: [],
  categoryDistribution: []
}

export function useScreenshots() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
  const [pendingQueue, setPendingQueue] = useState<ScreenshotRecord[]>([])
  const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refreshAll = useCallback(async () => {
    try {
      const [nextStats, nextPending, nextAll] = await Promise.all([
        window.screenshotAPI.getDashboardStats(),
        window.screenshotAPI.getPendingScreenshots(),
        window.screenshotAPI.getScreenshots()
      ])
      setStats(nextStats)
      setPendingQueue(nextPending)
      setScreenshots(nextAll)
      setError(null)
    } catch (err) {
      setError((err as Error).message || 'Failed to load screenshots')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAll()

    const unsubNew = window.screenshotAPI.onNewScreenshot(() => {
      void refreshAll()
    })

    const unsubUpdated = window.screenshotAPI.onScreenshotUpdated(() => {
      void refreshAll()
    })

    return () => {
      unsubNew()
      unsubUpdated()
    }
  }, [refreshAll])

  const confirmScreenshot = useCallback(
    async (payload: ConfirmScreenshotPayload): Promise<ScreenshotRecord> => {
      const res = await window.screenshotAPI.confirmScreenshot(payload)
      await refreshAll()
      return res
    },
    [refreshAll]
  )

  const rejectScreenshot = useCallback(
    async (id: string): Promise<ScreenshotRecord> => {
      const res = await window.screenshotAPI.rejectScreenshot(id)
      await refreshAll()
      return res
    },
    [refreshAll]
  )

  const retryAnalysis = useCallback(
    async (id: string): Promise<ScreenshotRecord> => {
      const res = await window.screenshotAPI.retryAnalysis(id)
      await refreshAll()
      return res
    },
    [refreshAll]
  )

  const updateScreenshot = useCallback(
    async (payload: UpdateScreenshotPayload): Promise<ScreenshotRecord> => {
      const res = await window.screenshotAPI.updateScreenshot(payload)
      await refreshAll()
      return res
    },
    [refreshAll]
  )

  const searchScreenshots = useCallback(
    async (query: SearchScreenshotsQuery): Promise<ScreenshotRecord[]> => {
      return await window.screenshotAPI.searchScreenshots(query)
    },
    []
  )

  const openScreenshotLocation = useCallback(async (id: string): Promise<boolean> => {
    return await window.screenshotAPI.openScreenshotLocation(id)
  }, [])

  const scanExistingScreenshots = useCallback(async (): Promise<{
    added: number
    skipped: number
  }> => {
    const res = await window.screenshotAPI.scanExistingScreenshots()
    await refreshAll()
    return res
  }, [refreshAll])

  const captureClipboardScreenshot = useCallback(async () => {
    const res = await window.screenshotAPI.captureClipboardScreenshot()
    await refreshAll()
    return res
  }, [refreshAll])

  return {
    stats,
    pendingQueue,
    screenshots,
    loading,
    error,
    refreshAll,
    confirmScreenshot,
    rejectScreenshot,
    retryAnalysis,
    updateScreenshot,
    searchScreenshots,
    openScreenshotLocation,
    scanExistingScreenshots,
    captureClipboardScreenshot
  }
}
