import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'
import type {
  NotificationItem,
  NotificationType,
} from '@/types/notification'

// U30 — 미읽음 행 구분감: 저알파 틴트(다크에서 지각 불가) → card-solid + 유형색 좌측 스트라이프.
// DESIGN.md 규칙 9(리스트 카드 구분감) 이식. 유형색은 stripe(border-l)로만 표현.
const TYPE_META: Record<NotificationType, { icon: string; stripe: string }> = {
  briefing: { icon: '📅', stripe: 'border-l-brand' },
  deadline_urgent: { icon: '⏰', stripe: 'border-l-warning' },
  admin: { icon: '🔔', stripe: 'border-l-info' },
}

/** A7 — 타입 필터 (브리핑 아카이브 겸용). '?type=briefing' 딥링크 = 캘린더 배너 진입 */
const FILTER_TABS: Array<{ key: NotificationType | 'all'; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'briefing', label: '📅 브리핑' },
  { key: 'deadline_urgent', label: '⏰ 마감 긴급' },
  { key: 'admin', label: '🔔 운영' },
]

function isNotificationType(v: string | null): v is NotificationType {
  return v === 'briefing' || v === 'deadline_urgent' || v === 'admin'
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
  const [searchParams, setSearchParams] = useSearchParams()

  // A7 — 타입 필터: URL(?type=) 이 소스. U23 — 서버사이드 필터로 재조회 (클라이언트 필터 제거)
  const typeParam = searchParams.get('type')
  const filter: NotificationType | 'all' = isNotificationType(typeParam)
    ? typeParam
    : 'all'
  const setFilter = (key: NotificationType | 'all') =>
    setSearchParams(key === 'all' ? {} : { type: key }, { replace: true })

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useNotifications(filter === 'all' ? undefined : filter)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  // U23 — 서버가 이미 type 으로 필터링 → 페이지 병합만 (false-empty 해소: 깊은 페이지도 정확)
  const items = data?.pages.flatMap((p) => p.items) ?? []
  // unreadCount 는 서버에서 필터와 무관하게 전체 미읽음 (종 배지·전체읽음 버튼 의미 유지)
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

      {/* A7 — 타입 필터 (브리핑 아카이브) */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFilter(tab.key)}
              className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
                isActive
                  ? 'bg-brand/10 text-brand border-brand/30'
                  : 'bg-card border-line text-text-tertiary hover:text-text-secondary hover:border-line-strong'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
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
            {filter === 'briefing'
              ? '아직 받은 브리핑이 없어요'
              : filter !== 'all'
                ? '해당 유형 알림이 없어요'
                : '새 알림이 없어요'}
          </p>
          <p className="text-xs text-text-tertiary">
            {filter === 'briefing'
              ? '마감·면접이 다가오면 매일 아침 8시에 정리해드려요.'
              : '마감·면접이 다가오면 여기로 알려드릴게요.'}
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
                  className={`w-full text-left flex gap-3 rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
                    n.read
                      ? 'bg-surface-2 border-line hover:border-line-strong'
                      : `bg-card-solid border-line-strong border-l-[3px] ${meta.stripe} shadow-sm hover:bg-surface-3`
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
