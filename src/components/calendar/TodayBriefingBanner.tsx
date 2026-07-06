import { Link } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'
import { toLocalDateString, todayLocal } from '@/utils/datetime'

/**
 * A7 — 브리핑 웹 체감: 캘린더(홈) 상단 오늘 브리핑 진입점.
 *
 * 아침 08:00 브리핑은 인앱 알림으로 쌓이지만 push 없는 웹 유저는
 * 알림센터를 안 열면 모름 → 하루의 시작점(캘린더)에서 노출.
 * 오늘(KST) 생성된 briefing 알림이 있을 때만 렌더 ("없으면 침묵" 정책 유지).
 * 클릭 → 알림센터 브리핑 필터 (아카이브).
 */
export function TodayBriefingBanner() {
  const { data } = useNotifications()

  const today = todayLocal()
  const briefing = data?.pages
    .flatMap((p) => p.items)
    .find(
      (n) =>
        n.type === 'briefing' &&
        toLocalDateString(new Date(n.createdAt)) === today,
    )

  if (!briefing) return null

  return (
    <Link
      to="/notifications?type=briefing"
      className={`flex items-center gap-3 rounded-xl border p-3.5 mb-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
        briefing.read
          ? 'bg-surface-2 border-line hover:border-line-strong'
          : 'bg-brand/10 border-brand/30 hover:brightness-105'
      }`}
    >
      <span
        className="shrink-0 w-8 h-8 rounded-lg bg-card flex items-center justify-center text-base"
        aria-hidden
      >
        📅
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">
          {briefing.title}
        </p>
        <p className="text-xs text-text-tertiary truncate mt-0.5">
          {briefing.body.split('\n')[0]}
        </p>
      </div>
      <span className="shrink-0 text-[11px] font-medium text-text-quaternary">
        지난 브리핑 →
      </span>
    </Link>
  )
}
