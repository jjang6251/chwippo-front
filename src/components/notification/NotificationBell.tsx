import { Link } from 'react-router-dom'
import { useUnreadCount } from '@/hooks/useNotifications'

interface NotificationBellProps {
  /** 데모 모드 등에서 링크 prefix 조정용 (기본 '/notifications') */
  to?: string
  size?: number
}

/**
 * 헤더 종 아이콘 + 안 읽음 배지. Sidebar 상단·MobileHeader 우측 공용.
 */
export function NotificationBell({
  to = '/notifications',
  size = 18,
}: NotificationBellProps) {
  const { data: unread = 0 } = useUnreadCount()
  const badge = unread > 99 ? '99+' : String(unread)

  return (
    <Link
      to={to}
      aria-label={unread > 0 ? `알림 ${unread}개` : '알림'}
      className="relative shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-card active:bg-card-strong transition-colors"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 2a5 5 0 0 0-5 5c0 3.5-1 5-1.5 5.5h13c-.5-.5-1.5-2-1.5-5.5a5 5 0 0 0-5-5Z" />
        <path d="M8 16a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-accent text-white text-[9px] font-bold leading-none font-mono">
          {badge}
        </span>
      )}
    </Link>
  )
}
