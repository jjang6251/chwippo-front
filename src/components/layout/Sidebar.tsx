import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAiFeedbackStore } from '@/stores/aiFeedbackStore'
import { useDemoMode } from '@/contexts/demoMode'
import { useLoginModalStore } from '@/stores/loginModalStore'
import { apiClient } from '@/api/client'
import { isInNativeApp, postToNative } from '@/utils/nativeBridge'
import { useAiEnabled, useInterviewAiEnabled } from '@/hooks/useAiEnabled'
import { useDashboardStreak } from '@/hooks/useDashboardStreak'
import { useNavCollapsedStore } from '@/stores/navCollapsedStore'
import { NotificationBell } from '@/components/notification/NotificationBell'

interface NavItem {
  label: string
  path: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  /** AI 기능 — `useAiEnabled()` false 일 때 hide */
  ai?: boolean
  /**
   * 데모 모드에서 노출할지. **기본은 노출**이고, `false` 인 항목만 숨긴다.
   *
   * 🔴 데모는 `/demo/*` 라우트와 `demoAdapter` 의 엔드포인트가 **둘 다** 있어야 동작한다.
   * 하나라도 없으면 메뉴는 보이는데 눌러도 아무 데도 안 가거나 빈 화면이 뜬다 —
   * 실제로 면접 AI 를 공개하면서 이 상태가 됐다(2026-08-08 발견, 운영 데모에서 캘린더로 튕김).
   */
  demoReady?: boolean
  /** 면접 AI — `useInterviewAiEnabled()` false 일 때 hide (비공개 유지) */
  interviewAi?: boolean
}

const NAV_ITEMS: readonly NavItem[] = [
  // 캘린더 UX 재구성 — 캘린더가 홈. 대시보드는 "회고" 페이지로 강등 (streak 배지로 유도)
  { label: '캘린더', path: '/calendar', icon: CalendarIcon },
  { label: '지원 현황 보드', path: '/board', icon: BoardIcon },
  { label: '회고', path: '/dashboard', icon: GridIcon },
  { label: '활동 일지', path: '/activity', icon: JournalIcon },
  /*
    공부 노트 — 활동 일지 아래 (mockup). `demoReady: false` 인 이유는 `/demo/study-notes`
    라우트도 샘플 데이터도 없어서다. 데모에 뜨면 눌러도 캘린더로 튕긴다 (2026-08-08 사고).
  */
  { label: '공부 노트', path: '/study-notes', icon: StudyNoteIcon, demoReady: false },
  // F6 PR 1 — 자소서 통합 페이지 (데스크탑 only. MobileNav 변경 X — 모바일은 카드 상세에서 진입)
  { label: '자소서', path: '/coverletters', icon: CoverLetterIcon, ai: true },
  // F6 PR 2 Phase 4 — 면접 준비 통합 페이지 (데스크탑 only. 동일 정책)
  { label: '면접 준비', path: '/interviews', icon: InterviewIcon, ai: true, interviewAi: true },
  { label: '내 정보 창고', path: '/myinfo', icon: StorageIcon },
] as const

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isDemo = useDemoMode()
  const showLogin = useLoginModalStore((s) => s.show)
  const aiEnabled = useAiEnabled()
  const interviewAiEnabled = useInterviewAiEnabled()
  const link = (p: string) => (isDemo ? '/demo' + p : p)
  /**
   * 🔴 **데모에서는 `demoReady: false` 항목을 숨긴다** (2026-08-08).
   * 면접 AI flag 를 켜자 데모 사이드바에도 「면접 준비」가 떴는데 `/demo/interviews` 라우트가 없어
   * `<Route path="*">` 에 걸려 **캘린더로 튕겼다.** 메뉴가 광고하는 곳에 갈 수 없는 상태다.
   * 데모용 라우트·샘플 데이터가 준비되면 이 플래그만 지우면 된다.
   */
  const visibleNavItems = NAV_ITEMS.filter(
    (item) =>
      (aiEnabled || !item.ai) &&
      (interviewAiEnabled || !item.interviewAi) &&
      (item.demoReady !== false || !isDemo),
  )
  /*
    캘린더 UX 재구성 — 회고 nav 옆 streak 배지 (>=2 조건, 1일 이하는 상처 방지 hide)

    🔴 **옵셔널이 한 겹만 걸려 있으면 앱 전체가 죽는다** (2026-08-11).
    `streak?.streak.current` 는 응답에 `streak` 키가 없을 때 그 자리에서 던지고,
    사이드바는 **모든 화면의 껍데기**라 화면이 통째로 「불러오지 못했어요」가 된다.
    실제로 스크린샷을 찍다 밟았다 — 서버 응답 모양 하나에 앱 전부가 걸려 있으면 안 된다.
    타입은 `streak` 가 항상 있다고 말하지만, **타입은 런타임을 보증하지 않는다.**
  */
  const { data: streak } = useDashboardStreak()
  const streakDays = streak?.streak?.current ?? 0

  const [showLogoutModal, setShowLogoutModal] = useState(false)

  /*
    🔴 **데모에서는 접지 않는다.** 접힌 레일에서 「가입하고 시작하기 →」 는 화살표 한 개가
    되는데, 그건 데모 화면에서 가장 중요한 버튼이다. 저장된 값이 접힘이어도 무시한다 —
    안 그러면 로그인 상태에서 접어둔 사람이 데모에 들어왔을 때 **펼 방법 없이** 접힌 채 본다.
  */
  const storedCollapsed = useNavCollapsedStore((st) => st.collapsed)
  const setCollapsed = useNavCollapsedStore((st) => st.setCollapsed)
  const collapsed = storedCollapsed && !isDemo

  /**
   * 접혔을 때 라벨 자리를 없애고 아이콘만 남긴다 — 이름은 `aria-label` 로 계속 읽힌다.
   *
   * 🔴 포커스 링은 **여기 있어야 한다** — 접기 버튼에만 있고 항목엔 없어서, 레일 안에서
   * 키보드로 이동하면 **어디에 있는지 보이는 칸과 안 보이는 칸이 섞였다.**
   */
  const itemCls = (active: boolean, activeCls = 'bg-brand/10 text-brand') =>
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface relative flex items-center rounded-lg text-sm font-medium transition-colors ${
      collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2'
    } ${
      active
        ? activeCls
        : 'text-text-secondary hover:bg-card active:bg-card-strong hover:text-text-primary'
    }`

  const isActive = (path: string) => {
    const target = link(path)
    // 자소서 문서는 URL 이 /board/:id/coverletter 지만 맥락은 자소서 — 보드 아닌 자소서 하이라이트 (데모 접두어 포함)
    const isCoverletterDoc = /^(\/demo)?\/board\/[^/]+\/coverletter/.test(location.pathname)
    if (path === '/coverletters') {
      return location.pathname.startsWith(target) || isCoverletterDoc
    }
    if (path === '/board') {
      return location.pathname.startsWith(target) && !isCoverletterDoc
    }
    if (path === '/activity' || path === '/interviews' || path === '/study-notes') {
      return location.pathname.startsWith(target)
    }
    return location.pathname === target
  }

  const isSettingsActive = location.pathname.startsWith('/settings')

  async function handleLogout() {
    try { await apiClient.post('/auth/logout') } catch { /* 로그아웃 실패해도 클라이언트는 정리 */ }
    clearAuth()
    // 공용 PC 계정 전환 시 이전 사용자 데이터 잔존 방지 — 서버 캐시·AI 점검 결과 전체 초기화
    queryClient.clear()
    useAiFeedbackStore.getState().resetAll()
    postToNative({ type: 'logout' })
    // 앱에선 화면 전환이 네이티브 소유 — 랜딩을 그리면 네이티브 전환 대기 동안 그대로 보인다
    if (!isInNativeApp()) navigate('/')
  }

  return (
    <>
      <aside
        data-nav
        /* print:hidden — 종이에는 내비게이션이 없다 (공부 노트 PDF 저장) */
        className={`hidden lg:flex print:hidden flex-col shrink-0 bg-surface border-r border-line min-h-screen sticky top-0 h-screen transition-[width] duration-[240ms] ease-[cubic-bezier(.32,.72,0,1)] ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/*
          Logo — 접히면 세로로 쌓는다. 종은 **읽지 않은 알림 배지**를 달고 있어 못 숨기고,
          브랜드를 통째로 지우면 레일이 어느 서비스인지 모르는 아이콘 띠가 된다.
        */}
        <div
          className={`border-b border-line ${
            collapsed
              ? 'px-0 py-3 flex flex-col items-center gap-2'
              : 'px-5 py-4 flex items-center justify-between'
          }`}
        >
          <Link
            to={link('/dashboard')}
            className="text-lg font-bold text-brand tracking-tight"
            aria-label="치뽀 홈"
          >
            {collapsed ? '치' : '치뽀'}
            {!collapsed && isDemo && <span className="ml-1.5 text-[10px] font-medium text-text-quaternary align-middle">데모</span>}
          </Link>
          {!isDemo && <NotificationBell size={18} />}
        </div>

        {/* Main nav */}
        <nav className={`flex-1 py-4 flex flex-col gap-0.5 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
          {/*
            🔴 **화살표가 가리키는 방향 = 메뉴가 밀려갈 방향.** 눌러보지 않아도 읽힌다
            (Notion·Linear·VSCode 패턴). 면접 화면의 자료 사이드바 접기와 같은 문법이다.
            데모에선 렌더하지 않는다 — 접을 수 없는 상태에서 접기 버튼은 거짓 어포던스다.
          */}
          {!isDemo && (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
              title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
              className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface w-full min-h-8 mb-1 flex items-center rounded-lg text-[11px] text-text-tertiary hover:text-text-primary hover:bg-card transition-colors ${
                collapsed ? 'justify-center px-0' : 'justify-end gap-1 px-1'
              }`}
            >
              <ChevronIcon size={14} dir={collapsed ? 'right' : 'left'} />
              {!collapsed && '접기'}
            </button>
          )}

          {visibleNavItems.map(({ label, path, icon: Icon }) => {
            const showStreak = path === '/dashboard' && streakDays >= 2
            return (
              <Link
                key={path}
                to={link(path)}
                aria-current={isActive(path) ? 'page' : undefined}
                /*
                  🔴 접히면 링크의 이름이 안쪽 점의 `aria-label` 을 **덮는다** — 연속 기록이
                  화면 낭독기에 아예 안 들린다. 눈에는 점이 보이는데 귀에는 없는 상태라
                  사람 눈으로는 안 잡힌다. 이름에 합쳐 넣는다.
                */
                aria-label={
                  collapsed
                    ? showStreak
                      ? `${label} — 활동 ${streakDays}일 연속`
                      : label
                    : undefined
                }
                title={
                  collapsed && showStreak
                    ? `${label} · 🔥 ${streakDays}일 연속`
                    : collapsed
                      ? label
                      : undefined
                }
                className={itemCls(isActive(path))}
              >
                <Icon size={16} />
                {!collapsed && <span className="flex-1">{label}</span>}
                {/*
                  🔴 접히면 숫자가 들어갈 자리가 없다. 그렇다고 지우면 **연속 기록이 끊긴 걸
                  모르고 지나간다** — 이 배지는 장식이 아니라 되돌아올 이유다.
                  점 하나로 「볼 게 있다」만 남기고, 정확한 값은 `aria-label` 과 툴팁이 갖는다.
                */}
                {showStreak &&
                  (collapsed ? (
                    <span
                      className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-brand"
                      aria-label={`활동 ${streakDays}일 연속`}
                      title={`🔥 ${streakDays}일 연속`}
                    />
                  ) : (
                    <span
                      className="text-[10px] font-semibold text-brand tabular-nums"
                      aria-label={`활동 ${streakDays}일 연속`}
                    >
                      🔥 {streakDays}
                    </span>
                  ))}
              </Link>
            )
          })}

          {/* 설정 — 메인 nav 안 (이전엔 spacer 아래) */}
          {!isDemo && (
            <Link
              to="/settings"
              aria-label={collapsed ? '설정' : undefined}
              title={collapsed ? '설정' : undefined}
              className={itemCls(isSettingsActive)}
            >
              <SettingsIcon size={16} />
              {!collapsed && '설정'}
            </Link>
          )}

          {/* Admin link — 5.6.3 단순화. 진입점 하나만 (sub items 는 AdminLayout 좌측 nav 가 담당) */}
          {!isDemo && user?.role === 'admin' && (
            <Link
              to="/ops"
              aria-label={collapsed ? '관리자' : undefined}
              title={collapsed ? '관리자' : undefined}
              className={itemCls(
                location.pathname.startsWith('/ops'),
                'bg-warning/10 text-warning',
              )}
            >
              <AdminIcon size={16} />
              {!collapsed && '관리자'}
            </Link>
          )}

          {/* Spacer pushes bottom items down */}
          <div className="flex-1" />

          {!isDemo && (
            <>
              <div className="h-px bg-card my-2" />

              {/* 도움말 */}
              <Link
                to="/settings/help"
                aria-label={collapsed ? '도움말' : undefined}
                title={collapsed ? '도움말' : undefined}
                className={itemCls(location.pathname === '/settings/help')}
              >
                <HelpIcon size={16} />
                {!collapsed && '도움말'}
              </Link>

              {/* 로그아웃 */}
              <button
                onClick={() => setShowLogoutModal(true)}
                aria-label={collapsed ? '로그아웃' : undefined}
                title={collapsed ? '로그아웃' : undefined}
                className={`${itemCls(false)} text-left`}
              >
                <LogoutIcon size={16} />
                {!collapsed && '로그아웃'}
              </button>
            </>
          )}
        </nav>

        {/* 하단 CTA */}
        <div className={`py-4 border-t border-line ${collapsed ? 'px-2' : 'px-3'}`}>
          {isDemo ? (
            <button
              onClick={showLogin}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold bg-brand text-bg hover:bg-accent active:bg-accent-hover transition-colors"
            >
              가입하고 시작하기 →
            </button>
          ) : (
            <Link
              to="/inquiry"
              aria-label={collapsed ? '문의하기' : undefined}
              title={collapsed ? '문의하기' : undefined}
              className={`flex items-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                collapsed ? 'justify-center px-0' : 'gap-2 px-3'
              } ${
                location.pathname === '/inquiry'
                  ? 'bg-brand text-bg'
                  : 'bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20'
              }`}
            >
              <ChatIcon size={16} />
              {!collapsed && '문의하기'}
            </Link>
          )}
        </div>
      </aside>

      {/* 로그아웃 확인 모달 */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div role="dialog" aria-modal="true" aria-label="로그아웃 확인" className="bg-surface border border-line rounded-xl p-6 w-full max-w-xs">
            <h3 className="text-base font-bold mb-2">로그아웃 하시겠어요?</h3>
            <p className="text-sm text-text-quaternary mb-6">로그인 화면으로 이동합니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-line text-sm font-medium text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-lg bg-brand text-bg text-sm font-medium hover:bg-accent active:bg-accent-hover transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Icons ─── */
/** 접기·펼치기 화살표 — 가리키는 쪽이 메뉴가 움직일 방향 */
function ChevronIcon({ size, dir }: { size: number; dir: 'left' | 'right' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'} />
    </svg>
  )
}
function GridIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="5.5" height="5.5" rx="1" /><rect x="9.5" y="1" width="5.5" height="5.5" rx="1" /><rect x="1" y="9.5" width="5.5" height="5.5" rx="1" /><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" /></svg>
}
function BoardIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="14" height="3" rx="1" /><rect x="1" y="6.5" width="14" height="3" rx="1" /><rect x="1" y="12" width="8" height="3" rx="1" /></svg>
}
function StorageIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v1H2V4z" /><path d="M2 5h12v7a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" /><line x1="5" y1="9" x2="11" y2="9" /></svg>
}
function SettingsIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M3.1 12.9l1.1-1.1M11.8 4.2l1.1-1.1" /></svg>
}
function HelpIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="7" /><path d="M6 6a2 2 0 114 0c0 1-1 1.5-2 2.5" /><circle cx="8" cy="12" r=".5" fill="currentColor" /></svg>
}
function LogoutIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" /><path d="M11 11l3-3-3-3" /><line x1="14" y1="8" x2="6" y2="8" /></svg>
}
function ChatIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H3a1 1 0 00-1 1v8a1 1 0 001 1h3l2 2 2-2h3a1 1 0 001-1V3a1 1 0 00-1-1z" /></svg>
}
function AdminIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1l1.5 3 3.5.5-2.5 2.5.5 3.5L8 9l-3 1.5.5-3.5L3 4.5 6.5 4z" /></svg>
}
function CalendarIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2.5" width="14" height="12" rx="1.5" /><line x1="1" y1="6.5" x2="15" y2="6.5" /><line x1="5" y1="1" x2="5" y2="4" /><line x1="11" y1="1" x2="11" y2="4" /><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" /></svg>
}
function JournalIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h7a2 2 0 012 2v10a1 1 0 01-1 1H4a2 2 0 01-2-2V4a2 2 0 012-2z" /><line x1="5" y1="6" x2="10" y2="6" /><line x1="5" y1="8.5" x2="10" y2="8.5" /><line x1="5" y1="11" x2="8" y2="11" /></svg>
}
/** 공부 노트 — 펼친 공책. viewBox 만 24 라 stroke 를 2 로 맞춰 다른 항목과 굵기가 같아 보인다 */
function StudyNoteIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
}
function CoverLetterIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" /><polyline points="10 2 10 5 13 5" /><line x1="5" y1="9" x2="11" y2="9" /><line x1="5" y1="11.5" x2="9" y2="11.5" /></svg>
}

function InterviewIcon({ size }: { size: number }) {
  // 말풍선 + 작은 마이크: 면접 대화 메타포
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6l-3 2.5V12a2 2 0 01-1-2V4z" />
      <line x1="5.5" y1="6" x2="10.5" y2="6" />
      <line x1="5.5" y1="8.5" x2="9" y2="8.5" />
    </svg>
  )
}
