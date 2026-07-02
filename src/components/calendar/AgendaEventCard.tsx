import { Link } from 'react-router-dom'
import type { CalendarEvent } from '@/api/calendar'
import { useDemoMode } from '@/contexts/demoMode'

/**
 * 캘린더 UX 재구성 — 아젠다 이벤트 카드 (leaf).
 *
 * 이벤트 종류별 색상·아이콘 매핑:
 * - step (마감/면접) → warning bg (📄)
 * - exam (시험) → violet bg (📚)
 * - note (메모) → info bg (📝)
 *
 * 클릭 시 상세 페이지로 이동 (step→step 페이지 · exam→myinfo#exam · note→x)
 */
interface Props {
  event: CalendarEvent
}

const TYPE_META = {
  step: {
    icon: '📄',
    bg: 'bg-warning/6',
    border: 'border-warning/25',
  },
  exam: {
    icon: '📚',
    bg: 'bg-violet/8',
    border: 'border-violet/25',
  },
  note: {
    icon: '📝',
    bg: 'bg-info/6',
    border: 'border-info/20',
  },
} as const

export function AgendaEventCard({ event }: Props) {
  const isDemo = useDemoMode()
  const meta = TYPE_META[event.type]

  const rawTo =
    event.type === 'exam'
      ? '/myinfo#exam-schedules'
      : event.type === 'step' && event.stepId
        ? `/board/${event.applicationId}/steps/${event.stepId}`
        : event.type === 'step'
          ? `/board/${event.applicationId}`
          : null

  const to = rawTo ? (isDemo ? '/demo' + rawTo : rawTo) : null

  // 제목: step = "회사 · 스텝명" / exam = "시험명" / note = 내용 첫 줄
  const title =
    event.type === 'step'
      ? `${event.companyName ?? ''} · ${event.stepName ?? ''}`
      : event.type === 'exam'
        ? event.companyName ?? ''
        : event.content ?? ''

  // 메타: 시간 · 위치 · (마감이면 "23:59" 강조)
  const timeLabel = event.time?.slice(0, 5)
  const showAllDayMarker =
    event.type === 'step' && !timeLabel // 종일 마감 = "23:59" 로 노출

  const subtitle = [
    showAllDayMarker ? '23:59' : timeLabel,
    event.location,
  ]
    .filter(Boolean)
    .join(' · ')

  const inner = (
    <div className={`flex items-center gap-3 px-3.5 py-3 ${meta.bg} border ${meta.border} rounded-lg card-hover`}>
      <span className="text-sm shrink-0">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-text-primary truncate">{title}</p>
        {subtitle && (
          <p className="text-[10px] text-text-tertiary tabular-nums mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block">
        {inner}
      </Link>
    )
  }
  return inner
}
