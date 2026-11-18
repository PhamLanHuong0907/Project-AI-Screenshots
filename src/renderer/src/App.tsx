import React, { useState } from 'react'
import { Header } from './components/Header'
import { QuickConfirmPopup } from './components/QuickConfirmPopup'
import { NavTab, Sidebar } from './components/Sidebar'
import { useScreenshots } from './hooks/useScreenshots'
import { useSettings } from './hooks/useSettings'
import { Dashboard } from './pages/Dashboard'
import { Library } from './pages/Library'
import { Review } from './pages/Review'
import { Settings } from './pages/Settings'
import type { ScreenshotRecord } from './types/screenshot'

export function App(): React.ReactElement {
  const isQuickPopup = window.location.hash === '#quick-popup'

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)

  const {
    stats,
    pendingQueue,
    screenshots,
    confirmScreenshot,
    rejectScreenshot,
    retryAnalysis,
    updateScreenshot,
    searchScreenshots,
    openScreenshotLocation,
    scanExistingScreenshots,
    captureClipboardScreenshot
  } = useScreenshots()

  const {
    settings,
    watcherStatus,
    updateSettings,
    validateOpenAI,
    selectFolder,
    toggleMonitoring,
    addCategory,
    removeCategory,
    renameCategory
  } = useSettings()

  if (isQuickPopup) {
    return <QuickConfirmPopup />
  }

  const theme = settings?.theme || 'dark'

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    void updateSettings({ theme: nextTheme })
  }

  const handleSelectForReview = (item: ScreenshotRecord) => {
    setSelectedReviewId(item.id)
    setActiveTab('review')
  }

  const destinationDisplay =
    settings?.organizeMode === 'rename_in_place'
      ? `${settings?.sourceFolder || '%USERPROFILE%\\Pictures\\Screenshots'} (Rename in Place)`
      : settings?.destinationFolder || '%USERPROFILE%\\Pictures\\AI-Screenshots'

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={stats.pendingReview}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          isMonitoring={watcherStatus.isMonitoring}
          sourceFolder={
            watcherStatus.sourceFolder ||
            settings?.sourceFolder ||
            '%USERPROFILE%\\Pictures\\Screenshots'
          }
          hasApiKey={Boolean(settings?.hasApiKey)}
          aiProvider={settings?.aiProvider || 'gemini'}
          aiModel={settings?.aiModel || 'gemini-4-argon'}
          autoApplyRename={Boolean(settings?.autoApplyRename)}
          pendingCount={stats.pendingReview}
          analyzingCount={stats.analyzing}
          onToggleMonitoring={async (enable) => {
            await toggleMonitoring(enable)
          }}
          onToggleAutoRename={async (enable) => {
            await updateSettings({ autoApplyRename: enable })
          }}
          onScanExisting={scanExistingScreenshots}
          onCaptureClipboard={captureClipboardScreenshot}
          onNavigate={setActiveTab}
        />

        <main className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              sourceFolder={settings?.sourceFolder || ''}
              destinationFolder={settings?.destinationFolder || destinationDisplay}
              customCategories={settings?.customCategories || []}
              useDefaultCategories={settings?.useDefaultCategories !== false}
              onNavigate={setActiveTab}
              onSelectForReview={handleSelectForReview}
              onOpenLocation={openScreenshotLocation}
              onScanExisting={() => {
                void scanExistingScreenshots()
              }}
              onAddCategory={async (cat) => {
                await addCategory(cat)
              }}
              onRemoveCategory={async (cat) => {
                await removeCategory(cat)
              }}
              onRenameCategory={async (oldCat, newCat) => {
                await renameCategory(oldCat, newCat)
              }}
            />
          )}

          {activeTab === 'review' && (
            <Review
              queue={pendingQueue}
              selectedId={selectedReviewId}
              onSelectId={setSelectedReviewId}
              destinationRoot={
                settings?.organizeMode === 'rename_in_place'
                  ? settings?.sourceFolder || ''
                  : settings?.destinationFolder || ''
              }
              onConfirm={confirmScreenshot}
              onReject={rejectScreenshot}
              onRetry={retryAnalysis}
              onSaveDraft={updateScreenshot}
              onOpenLocation={openScreenshotLocation}
              onScanExisting={() => {
                void scanExistingScreenshots()
              }}
            />
          )}

          {activeTab === 'library' && (
            <Library
              allScreenshots={screenshots}
              categoryDistribution={stats.categoryDistribution}
              customCategories={settings?.customCategories || []}
              useDefaultCategories={settings?.useDefaultCategories !== false}
              destinationFolder={settings?.destinationFolder || ''}
              onSearch={searchScreenshots}
              onOpenLocation={openScreenshotLocation}
              onAddCategory={async (cat) => {
                await addCategory(cat)
              }}
              onRemoveCategory={async (cat) => {
                await removeCategory(cat)
              }}
              onRenameCategory={async (oldCat, newCat) => {
                await renameCategory(oldCat, newCat)
              }}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              settings={settings}
              onUpdateSettings={updateSettings}
              onValidateOpenAI={validateOpenAI}
              onSelectFolder={selectFolder}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
