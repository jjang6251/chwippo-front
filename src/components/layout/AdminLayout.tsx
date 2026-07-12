import { Link, Outlet, useLocation } from 'react-router-dom'
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell'

/**
 * F6 PR 2 Phase 5.6.3 — admin 페이지 통합 레이아웃 (Linear 패턴).
 *
 * 좌측 nav (그룹: 운영 / AI / 모니터링) + 메인 영역 Outlet. 모든 /ops/* 라우트가 이 layout 안.
 * 사이드바의 sub items 와 중복이지만 페이지 간 빠른 이동 + admin 컨텍스트 일관성을 위해 의도적.
 *
 * 페이지 너비 표준 (memory `feedback_page_width_standard`): main max-w-[1100px] + 좌측 nav shrink-0.
 */

interface NavItem {
  to: string
  label: string
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    group: '운영',
    items: [
      { to: '/ops', label: '대시보드' },
      { to: '/ops/users', label: '회원 관리' },
      { to: '/ops/inquiries', label: '문의 관리' },
      { to: '/ops/announcements', label: '공지 관리' },
    ],
  },
  {
    group: 'AI',
    items: [
      { to: '/ops/ai-quotas', label: 'AI 한도' },
      { to: '/ops/ai-usage', label: 'AI 사용량' },
      { to: '/ops/company-research', label: '회사조사 현황' },
    ],
  },
  {
    group: '모니터링',
    items: [
      { to: '/ops/monitoring', label: '알람·임계치' },
      { to: '/ops/audit-logs', label: 'Audit 로그' },
    ],
  },
]

export function AdminLayout() {
  const location = useLocation()

  return (
    <div className="bg-bg min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 max-w-[1320px] mx-auto px-4 lg:px-6 py-6 lg:py-9 pb-24 md:pb-9">
        {/* 좌측 nav (desktop) / 상단 scroll tabs (mobile) */}
        <aside className="lg:w-52 lg:shrink-0">
          {/* mobile — horizontal scroll */}
          <nav className="lg:hidden flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
            {NAV.flatMap((g) => g.items).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive(location.pathname, item.to)
                    ? 'bg-brand/15 text-brand border border-brand/30'
                    : 'bg-surface-2 text-text-secondary border border-line hover:bg-card'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {/* desktop — sticky 좌측 nav (배경 + border 로 구분 강화) */}
          <nav className="hidden lg:flex flex-col gap-5 sticky top-6 bg-surface-2 border border-line rounded-xl p-4 shadow-sm">
            {/* PR_B2 Phase 1 — Q8 "치뽀 서비스로" link (상단 logo 영역) */}
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-text-tertiary text-xs hover:text-text-primary transition-colors pb-3 border-b border-line"
              aria-label="치뽀 서비스로 돌아가기"
            >
              <span aria-hidden="true">←</span>
              <span>치뽀 서비스로</span>
            </Link>
            {NAV.map((g) => (
              <div key={g.group}>
                <p className="text-text-quaternary text-[10px] font-bold uppercase tracking-wider px-2 mb-1.5">
                  {g.group}
                </p>
                <div className="flex flex-col gap-0.5">
                  {g.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isActive(location.pathname, item.to)
                          ? 'bg-brand/15 text-brand border-l-2 border-brand'
                          : 'text-text-secondary hover:bg-card active:bg-card-strong hover:text-text-primary border-l-2 border-transparent'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* 메인 영역 — 카드들이 명확히 떠보이도록 page bg 분명히. max-w-[1100px] = 페이지 너비 표준 */}
        <main className="flex-1 min-w-0 w-full max-w-[1100px] mx-auto">
          {/* PR_B2 Phase 4 — 상단 종 알림 (sticky) */}
          <div className="hidden lg:flex sticky top-0 z-30 justify-end py-2 -mt-2">
            <AdminNotificationBell />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function isActive(pathname: string, to: string): boolean {
  if (to === '/ops') return pathname === '/ops'
  return pathname === to || pathname.startsWith(`${to}/`)
}
