import { calcDday, getDdayLabel, getDdayVariant } from '@/utils/dday'

interface DdayBadgeProps {
  deadline: string
}

const variantClass: Record<string, string> = {
  danger: 'text-danger bg-danger/10 border-danger/25',
  warning: 'text-warning bg-warning/10 border-warning/25',
  info: 'text-brand bg-brand/10 border-brand/25',
  muted: 'text-text-quaternary bg-card border-line',
}

const BADGE_BASE =
  'inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-mono font-semibold'

/**
 * 이미 계산된 D-day 숫자로 그리는 뱃지.
 * 알림 센터처럼 **서버가 계산한 dday 를 받는 화면**용 — 날짜 문자열이 없어
 * `DdayBadge` 를 못 쓰는 곳에서 **같은 색·같은 모양**을 보장한다.
 */
export function DdayValueBadge({ dday }: { dday: number }) {
  return (
    <span className={`${BADGE_BASE} ${variantClass[getDdayVariant(dday)]}`}>
      {getDdayLabel(dday)}
    </span>
  )
}

export function DdayBadge({ deadline }: DdayBadgeProps) {
  return <DdayValueBadge dday={calcDday(deadline)} />
}
