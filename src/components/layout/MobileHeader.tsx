import { useLocation, Link } from 'react-router-dom'
import { useDemoMode } from '@/contexts/demoMode'

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
  const title = getTitle(pathname)

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-surface border-b border-line flex items-center px-4 h-12">
      <Link to={isDemo ? '/demo/dashboard' : '/dashboard'} className="text-brand font-bold text-base tracking-tight mr-3">
        치뽀{isDemo && <span className="ml-1 text-[9px] font-medium text-text-quaternary align-middle">데모</span>}
      </Link>
      <span className="text-text-faint text-sm mr-3">|</span>
      <span className="text-text-secondary text-sm font-medium">{title}</span>
    </header>
  )
}
