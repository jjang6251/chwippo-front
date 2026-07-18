import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { CalendarEvent } from '@/api/calendar'
import { useDemoMode } from '@/contexts/demoMode'
import { useUpdateDailyNote } from '@/hooks/useCalendar'
import { toast } from '@/stores/toastStore'

/**
 * 캘린더 UX 재구성 — 아젠다 이벤트 카드 (leaf).
 *
 * 이벤트 종류별 색상·아이콘 매핑:
 * - step (마감/면접) → warning bg (📄)
 * - exam (시험) → violet bg (📚)
 * - note (메모) → info bg (📝) · U27 인라인 완료 체크박스
 *
 * 클릭 시 상세 페이지로 이동 (step→step 페이지 · exam→myinfo#exam · note→x)
 */
interface Props {
  event: CalendarEvent
}

// U29 v2 — 카드 구분감: 다크에서 저알파 틴트는 지각 불가(시안 1 실패) →
// 월 그리드와 같은 surface-2 승격 + 유형색 좌측 스트라이프로 전환 (구분감 보장 + 유형 식별 유지)
const TYPE_META = {
  step: {
    icon: '📄',
    stripe: 'border-l-warning',
  },
  exam: {
    icon: '📚',
    stripe: 'border-l-violet',
  },
  note: {
    icon: '📝',
    stripe: 'border-l-info',
  },
} as const

export function AgendaEventCard({ event }: Props) {
  const isDemo = useDemoMode()
  const meta = TYPE_META[event.type]
  const isNote = event.type === 'note'

  const { mutate: updateNote } = useUpdateDailyNote(event.date)
  // U27 — 낙관 완료 토글: 실패 시 롤백. refetch 서버값이 낙관값과 일치하는 순간
  // override 를 해제해서 이후 외부(시트 등) 변경이 그대로 반영되게 함 (render-time 상태 조정)
  const [pendingDone, setPendingDone] = useState<boolean | null>(null)
  if (pendingDone !== null && event.isDone === pendingDone) setPendingDone(null)
  const done = pendingDone ?? event.isDone ?? false

  function toggleDone(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!event.noteId) return
    const next = !done
    setPendingDone(next)
    updateNote(
      { id: event.noteId, isDone: next },
      {
        onError: () => {
          setPendingDone(null)
          toast.error('할 일 상태 변경에 실패했어요')
        },
      },
    )
  }

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
    <div className={`flex items-center gap-3 px-3.5 py-3 bg-card-solid border border-line-strong border-l-[3px] ${meta.stripe} rounded-lg shadow-sm transition-colors hover:bg-surface-3`}>
      {isNote ? (
        <button
          onClick={toggleDone}
          aria-label={done ? '완료 취소' : '완료 표시'}
          className="w-11 h-11 -my-3 -ml-1.5 flex items-center justify-center shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          <span
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
              done ? 'bg-success border-success text-bg' : 'border-line-strong'
            }`}
          >
            {done && (
              <svg width="11" height="11" viewBox="0 0 8 8" fill="none">
                <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </button>
      ) : (
        <span className="text-sm shrink-0">{meta.icon}</span>
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-semibold truncate ${
            done ? 'line-through text-text-quaternary' : 'text-text-primary'
          }`}
        >
          {title}
        </p>
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
