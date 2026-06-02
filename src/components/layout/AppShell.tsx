import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { MobileHeader } from './MobileHeader'
import { useDemoMode } from '@/contexts/demoMode'
import { DemoBanner } from '@/components/demo/DemoBanner'
import { TourOverlay } from '@/components/onboarding/TourOverlay'
import { AnnouncementContainer } from '@/components/announcement/AnnouncementContainer'
import { CoinChip } from '@/components/common/CoinChip'
import { CoinOnboardingModal } from '@/components/common/CoinOnboardingModal'

export function AppShell() {
  const isDemo = useDemoMode()
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <AnnouncementContainer />
          <MobileHeader />
          {/* PR_B1b — 데스크탑 전용 sticky 헤더 (코인 chip 우상단) */}
          {!isDemo && (
            <div className="hidden lg:flex sticky top-0 z-30 bg-bg/95 backdrop-blur-sm border-b border-line h-12 items-center justify-end px-9">
              <CoinChip />
            </div>
          )}
          <main className="flex-1 pb-20 lg:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
      <TourOverlay />
      {!isDemo && <CoinOnboardingModal />}
    </div>
  )
}
