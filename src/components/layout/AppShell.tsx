import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { RouteFallback } from '@/components/common/RouteFallback'
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
import { PermissionPromptModal } from '@/components/notification/PermissionPromptModal'
import { useMyCoinBalance } from '@/hooks/useMyCoin'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { useNativeMode } from '@/hooks/useNativeMode'
import { useDesktopSeenBeacon } from '@/hooks/useDesktopSeenBeacon'
import { useAuthStore } from '@/stores/authStore'
import { BETA_FEATURES } from '@/config/betaFeatures'

export function AppShell() {
  const isDemo = useDemoMode()
  const aiEnabled = useAiEnabled()
  // W4 · chwippo-mobile WebView 안에서 렌더링되는 경우 감지 · 웹 navigation UI hide (Apple 4.2 방어)
  const isNative = useNativeMode()
  // PR_B2 Phase 1 — me 응답에서 suspendedAt + pending_notification 감지
  const { data: coinBalance } = useMyCoinBalance()
  // 알림 soft-ask — native + 최초 로그인(alarm_prompted_at NULL) 1회.
  // BETA_FEATURES.nativePushReady false 동안은 숨김 (native 권한 핸들러 미구현 → 눌러도 무동작).
  // Apple Developer + mobile 완료 후 flag flip (plan Step 6).
  const user = useAuthStore((s) => s.user)
  // 데스크탑 웹 사용 스탬프 (관측 전용) — 자소서 게이트가 열린 환경일 때만 1회.
  // 데모는 제외한다 (DemoShell 도 AppShell 을 쓴다 — 비로그인 방문자가 쏘면 안 된다)
  useDesktopSeenBeacon(!isDemo)
  const [permDismissed, setPermDismissed] = useState(false)
  const showPermPrompt =
    BETA_FEATURES.nativePushReady &&
    !isDemo &&
    isNative &&
    !coinBalance?.suspendedAt &&
    user?.alarmPromptedAt == null &&
    !permDismissed
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
            {/* 라우트 code-split — 페이지 청크 로딩 중 shell(사이드바·nav)은 유지하고
                본문만 스켈레톤 표시. */}
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
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
      {/* 알림 soft-ask (native 최초 1회) */}
      <PermissionPromptModal
        open={showPermPrompt}
        onClose={() => setPermDismissed(true)}
      />
    </div>
  )
}
