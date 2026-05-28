import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useDemoMode } from '@/contexts/demoMode'
import { useLoginModalStore } from '@/stores/loginModalStore'
import { apiClient } from '@/api/client'

const NAV_ITEMS = [
  { label: '대시보드', path: '/dashboard', icon: GridIcon },
  { label: '지원 현황 보드', path: '/board', icon: BoardIcon },
  { label: '캘린더', path: '/calendar', icon: CalendarIcon },
  { label: '활동 일지', path: '/activity', icon: JournalIcon },
  // F6 PR 1 — 자소서 통합 페이지 (데스크탑 only. MobileNav 변경 X — 모바일은 카드 상세에서 진입)
  { label: '자소서', path: '/coverletters', icon: CoverLetterIcon },
  // F6 PR 2 Phase 4 — 면접 준비 통합 페이지 (데스크탑 only. 동일 정책)
  { label: '면접 준비', path: '/interviews', icon: InterviewIcon },
  { label: '내 정보 창고', path: '/myinfo', icon: StorageIcon },
] as const

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const user = useAuthStore((s) => s.user)
  const isDemo = useDemoMode()
  const showLogin = useLoginModalStore((s) => s.show)
  const link = (p: string) => (isDemo ? '/demo' + p : p)

  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const isActive = (path: string) => {
    const target = link(path)
    if (path === '/board' || path === '/activity' || path === '/interviews') {
      return location.pathname.startsWith(target)
    }
    return location.pathname === target
  }

  const isSettingsActive = location.pathname.startsWith('/settings')

  async function handleLogout() {
    try { await apiClient.post('/auth/logout') } catch { /* 로그아웃 실패해도 클라이언트는 정리 */ }
    clearAuth()
    navigate('/')
  }

  return (
    <>
      <aside data-nav className="hidden lg:flex flex-col w-56 shrink-0 bg-surface border-r border-line min-h-screen sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-line">
          <Link to={link('/dashboard')} className="text-lg font-bold text-brand tracking-tight">
            치뽀{isDemo && <span className="ml-1.5 text-[10px] font-medium text-text-quaternary align-middle">데모</span>}
          </Link>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={link(path)}
              {...(path === '/board' ? { 'data-tour': 'board-nav' } : {})}
              {...(path === '/activity' ? { 'data-tour': 'activity-nav' } : {})}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(path)
                  ? 'bg-brand/10 text-brand'
                  : 'text-text-secondary hover:bg-card active:bg-card-strong hover:text-text-primary'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}

          {/* 설정 — 메인 nav 안 (이전엔 spacer 아래) */}
          {!isDemo && (
            <Link
              to="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isSettingsActive
                  ? 'bg-brand/10 text-brand'
                  : 'text-text-secondary hover:bg-card active:bg-card-strong hover:text-text-primary'
              }`}
            >
              <SettingsIcon size={16} />
              설정
            </Link>
          )}

          {/* Admin link */}
          {!isDemo && user?.role === 'admin' && (
            <>
              <Link
                to="/ops"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/ops')
                    ? 'bg-warning/10 text-warning'
                    : 'text-text-secondary hover:bg-card active:bg-card-strong hover:text-text-primary'
                }`}
              >
                <AdminIcon size={16} />
                관리자
              </Link>
              <div className="ml-7 flex flex-col gap-0.5">
                  <Link
                    to="/ops/inquiries"
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      location.pathname === '/ops/inquiries'
                        ? 'text-warning bg-warning/8'
                        : 'text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong'
                    }`}
                  >
                    문의 관리
                  </Link>
                  <Link
                    to="/ops/announcements"
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      location.pathname === '/ops/announcements'
                        ? 'text-warning bg-warning/8'
                        : 'text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong'
                    }`}
                  >
                    공지 관리
                  </Link>
                  <Link
                    to="/ops/ai-quotas"
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      location.pathname === '/ops/ai-quotas'
                        ? 'text-warning bg-warning/8'
                        : 'text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong'
                    }`}
                  >
                    AI 한도
                  </Link>
                  <Link
                    to="/ops/ai-usage"
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      location.pathname === '/ops/ai-usage'
                        ? 'text-warning bg-warning/8'
                        : 'text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong'
                    }`}
                  >
                    AI 사용량
                  </Link>
                  <Link
                    to="/ops/alert-thresholds"
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      location.pathname === '/ops/alert-thresholds'
                        ? 'text-warning bg-warning/8'
                        : 'text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong'
                    }`}
                  >
                    임계치 알람
                  </Link>
              </div>
            </>
          )}

          {/* Spacer pushes bottom items down */}
          <div className="flex-1" />

          {!isDemo && (
            <>
              <div className="h-px bg-card my-2" />

              {/* 도움말 */}
              <Link
                to="/settings/help"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/settings/help'
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-secondary hover:bg-card active:bg-card-strong hover:text-text-primary'
                }`}
              >
                <HelpIcon size={16} />
                도움말
              </Link>

              {/* 로그아웃 */}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-card active:bg-card-strong hover:text-text-primary transition-colors text-left"
              >
                <LogoutIcon size={16} />
                로그아웃
              </button>
            </>
          )}
        </nav>

        {/* 하단 CTA */}
        <div className="px-3 py-4 border-t border-line">
          {isDemo ? (
            <button
              onClick={showLogin}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold bg-brand text-text-primary hover:bg-accent active:bg-accent-hover transition-colors"
            >
              가입하고 시작하기 →
            </button>
          ) : (
            <Link
              to="/inquiry"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                location.pathname === '/inquiry'
                  ? 'bg-brand text-text-primary'
                  : 'bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20'
              }`}
            >
              <ChatIcon size={16} />
              문의하기
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
                className="flex-1 py-2.5 rounded-lg bg-brand text-text-primary text-sm font-medium hover:bg-accent active:bg-accent-hover transition-colors"
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
