import { useNavigate } from 'react-router-dom'
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'
import type {
  NotificationItem,
  NotificationType,
} from '@/types/notification'

const TYPE_META: Record<
  NotificationType,
  { icon: string; ring: string; tint: string }
> = {
  briefing: { icon: '📅', ring: 'border-brand/30', tint: 'bg-brand/10' },
  deadline_urgent: {
    icon: '⏰',
    ring: 'border-warning/30',
    tint: 'bg-warning/10',
  },
  admin: { icon: '🔔', ring: 'border-info/30', tint: 'bg-info/10' },
}

function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return `${Math.floor(days / 30)}달 전`
}

export function Notifications() {
  const navigate = useNavigate()
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const unread = data?.pages[0]?.unreadCount ?? 0

  function handleTap(n: NotificationItem) {
    if (!n.read) markRead.mutate(n.id)
    if (n.deepLink) navigate(n.deepLink)
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">알림</h1>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="text-xs font-medium text-text-tertiary hover:text-brand transition-colors disabled:opacity-50"
          >
            전체 읽음
          </button>
        )}
      </div>

      {isLoading && <NotificationSkeleton />}

      {isError && (
        <div className="bg-surface-2 border border-line rounded-xl p-5 text-sm text-text-tertiary">
          알림을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-14 h-14 rounded-full bg-card flex items-center justify-center text-2xl mb-4">
            🔔
          </div>
          <p className="text-sm font-medium text-text-secondary mb-1">
            새 알림이 없어요
          </p>
          <p className="text-xs text-text-tertiary">
            마감·면접이 다가오면 여기로 알려드릴게요.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const meta = TYPE_META[n.type]
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleTap(n)}
                  className={`w-full text-left flex gap-3 rounded-xl border p-4 transition-colors ${
                    n.read
                      ? 'bg-surface-2 border-line hover:border-line-strong'
                      : `${meta.tint} ${meta.ring} hover:brightness-105`
                  }`}
                >
                  <span
                    className="shrink-0 w-8 h-8 rounded-lg bg-card flex items-center justify-center text-base"
                    aria-hidden
                  >
                    {meta.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm truncate ${
                          n.read
                            ? 'font-medium text-text-secondary'
                            : 'font-semibold text-text-primary'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span
                          className="shrink-0 w-1.5 h-1.5 rounded-full bg-brand"
                          aria-label="안 읽음"
                        />
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary mt-1 whitespace-pre-line leading-relaxed line-clamp-4">
                      {n.body}
                    </p>
                    <p className="text-[10px] text-text-quaternary mt-1.5 font-mono">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {hasNextPage && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50 py-2 px-4"
          >
            {isFetchingNextPage ? '불러오는 중…' : '더 보기'}
          </button>
        </div>
      )}
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="flex gap-3 rounded-xl border border-line bg-surface-2 p-4 animate-pulse"
        >
          <div className="w-8 h-8 rounded-lg bg-card-strong shrink-0" />
          <div className="flex-1">
            <div className="h-4 w-40 bg-card-strong rounded mb-2" />
            <div className="h-3 w-full bg-card rounded" />
          </div>
        </li>
      ))}
    </ul>
  )
}
