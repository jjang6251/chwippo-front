import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { label: '대시보드', path: '/dashboard', icon: GridIcon },
  { label: '보드', path: '/board', icon: BoardIcon },
  { label: '캘린더', path: '/calendar', icon: CalendarIcon },
  { label: '내정보', path: '/myinfo', icon: StorageIcon },
  { label: '설정', path: '/settings', icon: SettingsIcon },
] as const

export function MobileNav() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/settings') {
      return location.pathname.startsWith('/settings') || location.pathname === '/inquiry'
    }
    if (path === '/board') return location.pathname.startsWith('/board')
    if (path === '/calendar') return location.pathname === '/calendar'
    return location.pathname === path
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-white/5 flex safe-area-pb">
      {TABS.map(({ label, path, icon: Icon }) => {
        const active = isActive(path)
        return (
          <Link
            key={path}
            to={path}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors"
          >
            <span className={active ? 'text-brand' : 'text-text-muted'}>
              <Icon size={20} />
            </span>
            <span className={`text-[10px] font-medium ${active ? 'text-brand' : 'text-text-muted'}`}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

function GridIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function BoardIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="16" height="3.5" rx="1" />
      <rect x="2" y="8.5" width="16" height="3.5" rx="1" />
      <rect x="2" y="14" width="10" height="3.5" rx="1" />
    </svg>
  )
}

function StorageIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v1.5H3V5z" />
      <path d="M3 6.5h14v8.5a2 2 0 01-2 2H5a2 2 0 01-2-2V6.5z" />
      <line x1="6.5" y1="11" x2="13.5" y2="11" />
    </svg>
  )
}

function SettingsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.1 4.1l1.1 1.1M14.8 14.8l1.1 1.1M4.1 15.9l1.1-1.1M14.8 5.2l1.1-1.1" />
    </svg>
  )
}

function CalendarIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3.5" width="16" height="14" rx="2" />
      <line x1="2" y1="8.5" x2="18" y2="8.5" />
      <line x1="6.5" y1="1.5" x2="6.5" y2="5.5" />
      <line x1="13.5" y1="1.5" x2="13.5" y2="5.5" />
      <circle cx="10" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
