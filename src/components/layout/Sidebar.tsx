import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'

const NAV_ITEMS = [
  { label: '대시보드', path: '/dashboard', icon: GridIcon },
  { label: '지원 현황 보드', path: '/board', icon: BoardIcon },
  { label: '내 정보 창고', path: '/myinfo', icon: StorageIcon },
] as const

const SETTINGS_SUB = [
  { label: '프로필 설정', path: '/settings/profile' },
  { label: '알림 설정', path: '/settings/alarm' },
] as const

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const user = useAuthStore((s) => s.user)

  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/settings')
  )
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const isActive = (path: string) =>
    path === '/board' ? location.pathname.startsWith('/board') : location.pathname === path

  const isSettingsActive = location.pathname.startsWith('/settings')

  async function handleLogout() {
    try { await apiClient.post('/auth/logout') } catch {}
    clearAuth()
    navigate('/login')
  }

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-surface border-r border-white/5 min-h-screen sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <Link to="/dashboard" className="text-lg font-bold text-brand tracking-tight">
            취뽀
          </Link>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(path)
                  ? 'bg-brand/10 text-brand'
                  : 'text-text-secondary hover:bg-white/4 hover:text-text-primary'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}

          {/* Admin link */}
          {user?.role === 'admin' && (
            <Link
              to="/ops"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname.startsWith('/ops')
                  ? 'bg-warning/10 text-warning'
                  : 'text-text-secondary hover:bg-white/4 hover:text-text-primary'
              }`}
            >
              <AdminIcon size={16} />
              관리자
            </Link>
          )}

          {/* Spacer pushes bottom items down */}
          <div className="flex-1" />

          <div className="h-px bg-white/5 my-2" />

          {/* 설정 (accordion) */}
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
              isSettingsActive
                ? 'bg-brand/10 text-brand'
                : 'text-text-secondary hover:bg-white/4 hover:text-text-primary'
            }`}
          >
            <SettingsIcon size={16} />
            <span className="flex-1">설정</span>
            <span className={`text-xs transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {settingsOpen && (
            <div className="ml-7 flex flex-col gap-0.5">
              {SETTINGS_SUB.map(({ label, path }) => (
                <Link
                  key={path}
                  to={path}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    location.pathname === path
                      ? 'text-brand bg-brand/8'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/3'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}

          {/* 도움말 */}
          <Link
            to="/settings/help"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/settings/help'
                ? 'bg-brand/10 text-brand'
                : 'text-text-secondary hover:bg-white/4 hover:text-text-primary'
            }`}
          >
            <HelpIcon size={16} />
            도움말
          </Link>

          {/* 로그아웃 */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-white/4 hover:text-text-primary transition-colors text-left"
          >
            <LogoutIcon size={16} />
            로그아웃
          </button>
        </nav>

        {/* 문의하기 CTA */}
        <div className="px-3 py-4 border-t border-white/5">
          <Link
            to="/inquiry"
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              location.pathname === '/inquiry'
                ? 'bg-brand text-white'
                : 'bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20'
            }`}
          >
            <ChatIcon size={16} />
            문의하기
          </Link>
        </div>
      </aside>

      {/* 로그아웃 확인 모달 */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-xs">
            <h3 className="text-base font-bold mb-2">로그아웃 하시겠어요?</h3>
            <p className="text-sm text-text-muted mb-6">로그인 화면으로 이동합니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-text-secondary hover:bg-white/4 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-accent transition-colors"
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
