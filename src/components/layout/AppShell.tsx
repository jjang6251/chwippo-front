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
import { SuspendedModal } from '@/components/auth/SuspendedModal'
import { UserNotificationModal } from '@/components/notification/UserNotificationModal'
import { useMyCoinBalance } from '@/hooks/useMyCoin'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { useNativeMode } from '@/hooks/useNativeMode'

export function AppShell() {
  const isDemo = useDemoMode()
  const aiEnabled = useAiEnabled()
  // W4 · chwippo-mobile WebView 안에서 렌더링되는 경우 감지 · 웹 navigation UI hide (Apple 4.2 방어)
  const isNative = useNativeMode()
  // PR_B2 Phase 1 — me 응답에서 suspendedAt + pending_notification 감지
  const { data: coinBalance } = useMyCoinBalance()
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <AnnouncementContainer />
          {!isNative && <MobileHeader />}
          {/* PR_B1b — 데스크탑 전용 sticky 헤더 (코인 chip 우상단) */}
          {!isDemo && aiEnabled && (
            <div className="hidden lg:flex sticky top-0 z-30 bg-bg/95 backdrop-blur-sm border-b border-line h-12 items-center justify-end px-9">
              <CoinChip />
            </div>
          )}
          <main className={`flex-1 ${isNative ? '' : 'pb-20 lg:pb-0'}`}>
            <Outlet />
          </main>
        </div>
      </div>
      {!isNative && <MobileNav />}
      <TourOverlay />
      {!isDemo && aiEnabled && <CoinOnboardingModal />}
      {/* PR_B2 Phase 1 — Q13 SuspendedModal (dismiss 불가) — 모든 다른 modal 보다 우선 */}
      {!isDemo && coinBalance?.suspendedAt && (
        <SuspendedModal
          suspendedAt={coinBalance.suspendedAt}
          suspendReason={coinBalance.suspendReason ?? null}
          suspendExpiresAt={coinBalance.suspendExpiresAt ?? null}
        />
      )}
      {/* PR_B2 Phase 1 — Q24 사용자 통지 모달 (정지 X 일 때만) */}
      {!isDemo && !coinBalance?.suspendedAt && coinBalance?.pendingNotification && (
        <UserNotificationModal notification={coinBalance.pendingNotification} />
      )}
    </div>
  )
}
