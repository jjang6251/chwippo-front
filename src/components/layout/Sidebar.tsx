import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'


const NAV_ITEMS = [
  { label: '대시보드', path: '/dashboard', icon: GridIcon },
  { label: '지원 현황 보드', path: '/board', icon: BoardIcon },
  { label: '내 정보 창고', path: '/myinfo', icon: StorageIcon },
] as const

const SETTINGS_ITEMS = [
  { label: '알림 설정', path: '/settings/alarm', icon: BellIcon },
  { label: '프로필 설정', path: '/settings/profile', icon: PersonIcon },
  { label: '도움말', path: '/settings/help', icon: HelpIcon },
] as const

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const isActive = (path: string) => location.pathname === path

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout')
    } catch {}
    clearAuth()
    navigate('/login')
  }

  return (
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

        <div className="h-px bg-white/5 my-3" />

        {SETTINGS_ITEMS.map(({ label, path, icon: Icon }) => (
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

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-white/4 hover:text-text-primary transition-colors text-left mt-0.5"
        >
          <LogoutIcon size={16} />
          로그아웃
        </button>
      </nav>

      {/* Inquiry CTA — always visible */}
      <div className="px-3 py-4 border-t border-white/5">
        <Link
          to="/inquiry"
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            isActive('/inquiry')
              ? 'bg-brand text-white'
              : 'bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20'
          }`}
        >
          <ChatIcon size={16} />
          문의하기
        </Link>
      </div>
    </aside>
  )
}

/* ─── Icon Components ─── */
function GridIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
      <rect x="9.5" y="1" width="5.5" height="5.5" rx="1" />
      <rect x="1" y="9.5" width="5.5" height="5.5" rx="1" />
      <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" />
    </svg>
  )
}

function BoardIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="14" height="3" rx="1" />
      <rect x="1" y="6.5" width="14" height="3" rx="1" />
      <rect x="1" y="12" width="8" height="3" rx="1" />
    </svg>
  )
}

function StorageIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v1H2V4z" />
      <path d="M2 5h12v7a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
      <line x1="5" y1="9" x2="11" y2="9" />
    </svg>
  )
}

function BellIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1a5 5 0 00-5 5v3l-1.5 2H14.5L13 9V6a5 5 0 00-5-5z" />
      <path d="M6.5 13a1.5 1.5 0 003 0" />
    </svg>
  )
}

function PersonIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" />
    </svg>
  )
}

function HelpIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7" />
      <path d="M6 6a2 2 0 114 0c0 1-1 1.5-2 2.5" />
      <circle cx="8" cy="12" r=".5" fill="currentColor" />
    </svg>
  )
}

function LogoutIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" />
      <path d="M11 11l3-3-3-3" />
      <line x1="14" y1="8" x2="6" y2="8" />
    </svg>
  )
}

function ChatIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v8a1 1 0 001 1h3l2 2 2-2h3a1 1 0 001-1V3a1 1 0 00-1-1z" />
    </svg>
  )
}
