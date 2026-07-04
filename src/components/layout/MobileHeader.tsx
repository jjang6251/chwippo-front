import { useLocation, Link } from 'react-router-dom'
import { useDemoMode } from '@/contexts/demoMode'
import { CoinChip } from '@/components/common/CoinChip'
import { useAiEnabled } from '@/hooks/useAiEnabled'
import { NotificationBell } from '@/components/notification/NotificationBell'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': '대시보드',
  '/board': '지원 현황 보드',
  '/myinfo': '내 정보 창고',
  '/settings': '설정',
  '/settings/profile': '프로필 설정',
  '/settings/alarm': '알림 설정',
  '/settings/help': '도움말',
  '/inquiry': '문의 내역',
  '/inquiry/new': '새 문의',
}

function getTitle(pathname: string): string {
  const path = pathname.startsWith('/demo/') ? pathname.slice(5) : pathname
  if (path.startsWith('/board/')) return '카드 상세'
  if (path.startsWith('/inquiry/') && path !== '/inquiry/new') return '문의 상세'
  return PAGE_TITLES[path] ?? '치뽀'
}

export function MobileHeader() {
  const { pathname } = useLocation()
  const isDemo = useDemoMode()
  const aiEnabled = useAiEnabled()
  const title = getTitle(pathname)
  const isSettingsActive = pathname.startsWith('/settings')

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-surface border-b border-line flex items-center px-4 h-12">
      <Link to={isDemo ? '/demo/dashboard' : '/dashboard'} className="text-brand font-bold text-base tracking-tight mr-3">
        치뽀{isDemo && <span className="ml-1 text-[9px] font-medium text-text-quaternary align-middle">데모</span>}
      </Link>
      <span className="text-text-faint text-sm mr-3">|</span>
      <span className="text-text-secondary text-sm font-medium flex-1 truncate">{title}</span>
      {!isDemo && (
        <>
          {aiEnabled && (
            <div className="mr-2 shrink-0">
              <CoinChip />
            </div>
          )}
          <NotificationBell size={18} />
          <Link
            to="/settings"
            aria-label="설정"
            className={`shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-md transition-colors ${
              isSettingsActive
                ? 'text-brand bg-brand/10'
                : 'text-text-tertiary hover:text-text-primary hover:bg-card active:bg-card-strong'
            }`}
          >
            <SettingsIcon size={18} />
          </Link>
        </>
      )}
    </header>
  )
}

function SettingsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.5 3.5l1.5 1.5M15 15l1.5 1.5M3.5 16.5L5 15M15 5l1.5-1.5" />
    </svg>
  )
}
