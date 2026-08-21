import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { RouteFallback } from '@/components/common/RouteFallback'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { MobileHeader } from './MobileHeader'
import { useDemoMode } from '@/contexts/demoMode'
import { DemoBanner } from '@/components/demo/DemoBanner'
import { AnnouncementContainer } from '@/components/announcement/AnnouncementContainer'
import { CoinChip } from '@/components/common/CoinChip'
import { CoinOnboardingModal } from '@/components/common/CoinOnboardingModal'
import { SuspendedModal } from '@/components/auth/SuspendedModal'
import { UserNotificationModal } from '@/components/notification/UserNotificationModal'
import { useMyCoinBalance } from '@/hooks/useMyCoin'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { useNativeMode } from '@/hooks/useNativeMode'
import { useDesktopSeenBeacon } from '@/hooks/useDesktopSeenBeacon'

export function AppShell() {
  const isDemo = useDemoMode()
  const aiEnabled = useAiEnabled()
  // W4 · chwippo-mobile WebView 안에서 렌더링되는 경우 감지 · 웹 navigation UI hide (Apple 4.2 방어)
  const isNative = useNativeMode()
  // PR_B2 Phase 1 — me 응답에서 suspendedAt + pending_notification 감지
  const { data: coinBalance } = useMyCoinBalance()
  // 데스크탑 웹 사용 스탬프 (관측 전용) — 자소서 게이트가 열린 환경일 때만 1회.
  // 데모는 제외한다 (DemoShell 도 AppShell 을 쓴다 — 비로그인 방문자가 쏘면 안 된다)
  useDesktopSeenBeacon(!isDemo)
  return (
    // chw-app-surface — 인쇄에서 바탕을 비우는 지점 (index.css @media print).
    // Tailwind `print:bg-transparent` 대신 클래스인 이유: 비우는 조건이 「라이트일 때만」이라
    // 조상(`:root[data-theme]`)을 봐야 하는데 utility 로는 그 조건을 못 적는다.
    <div className="min-h-screen bg-bg chw-app-surface text-text-primary flex flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <AnnouncementContainer />
          {!isNative && <MobileHeader />}
          {/* PR_B1b — 데스크탑 전용 sticky 헤더 (코인 chip 우상단) */}
          {!isDemo && aiEnabled && (
            <div className="hidden lg:flex print:hidden sticky top-0 z-30 bg-bg/95 backdrop-blur-sm border-b border-line h-12 items-center justify-end px-9">
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
      {/* 로그인 시점 알림 모달은 네이티브 soft-ask 로 이관 (2026-08-13 — 사용자별 플래그가 기기 변경을 못 덮는 결함) */}
    </div>
  )
}
