import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { FileText, BookOpen, PenLine } from 'lucide-react'
import type { CalendarEvent } from '@/api/calendar'
import { useDemoMode } from '@/contexts/demoMode'
import { useUpdateDailyNote, useDeleteNoteWithUndo } from '@/hooks/useCalendar'
import { DEADLINE_DISPLAY_TIME } from '@/utils/datetime'
import { toast } from '@/stores/toastStore'
import { InlineNoteEditor } from './InlineNoteEditor'

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
    icon: FileText,
    stripe: 'border-l-warning',
  },
  exam: {
    icon: BookOpen,
    stripe: 'border-l-violet',
  },
  note: {
    icon: PenLine,
    stripe: 'border-l-info',
  },
} as const

// 캘린더 슬롯 기준시(KST 06:00 = slot 0 · 30분 단위) — DayDetailContent slotToLabel 과 동일 기준.
// 삭제 undo 재생성 시 원래 hourSlot 복원용 (아젠다 이벤트는 hourSlot 대신 time 만 보유).
const BASE_HOUR = 6
function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return Math.round((h * 60 + m - BASE_HOUR * 60) / 30)
}

export function AgendaEventCard({ event }: Props) {
  const isDemo = useDemoMode()
  const meta = TYPE_META[event.type]
  const Icon = meta.icon
  const isNote = event.type === 'note'

  const { mutate: updateNote } = useUpdateDailyNote(event.date)
  // U27 — 낙관 완료 토글: 실패 시 롤백. refetch 서버값이 낙관값과 일치하는 순간
  // override 를 해제해서 이후 외부(시트 등) 변경이 그대로 반영되게 함 (render-time 상태 조정)
  const [pendingDone, setPendingDone] = useState<boolean | null>(null)
  if (pendingDone !== null && event.isDone === pendingDone) setPendingDone(null)
  const done = pendingDone ?? event.isDone ?? false

  // 6b — note 카드 인라인 편집 · 삭제(즉시 + 되돌리기)
  const [editing, setEditing] = useState(false)
  const deleteNoteWithUndo = useDeleteNoteWithUndo(event.date)
  const hourSlot = event.time ? timeToSlot(event.time) : null

  function handleDelete(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!event.noteId) return
    deleteNoteWithUndo({
      id: event.noteId,
      date: event.date,
      hourSlot,
      content: event.content ?? '',
    })
  }

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
    showAllDayMarker ? DEADLINE_DISPLAY_TIME : timeLabel,
    event.location,
  ]
    .filter(Boolean)
    .join(' · ')

  const inner = (
    <div className={`group/agenda flex items-center gap-3 px-3.5 py-3 bg-card-solid border border-line-strong border-l-[3px] ${meta.stripe} rounded-lg shadow-sm transition-colors hover:bg-surface-3`}>
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
        <Icon size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      )}
      {isNote && editing ? (
        <InlineNoteEditor
          note={{ id: event.noteId!, content: event.content ?? '', date: event.date, hourSlot }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <div
            className={`flex-1 min-w-0 ${
              isNote
                ? 'cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg'
                : ''
            }`}
            role={isNote ? 'button' : undefined}
            tabIndex={isNote ? 0 : undefined}
            aria-label={isNote ? '할 일 수정' : undefined}
            onClick={isNote ? () => setEditing(true) : undefined}
            onKeyDown={
              isNote
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setEditing(true)
                    }
                  }
                : undefined
            }
          >
            <p
              className={`text-xs font-semibold ${
                isNote ? 'line-clamp-2 break-words' : 'truncate'
              } ${done ? 'line-through text-text-quaternary' : 'text-text-primary'}`}
            >
              {title}
            </p>
            {subtitle && (
              <p className="text-[10px] text-text-tertiary tabular-nums mt-0.5">{subtitle}</p>
            )}
          </div>
          {isNote && (
            <button
              type="button"
              aria-label="삭제"
              onClick={handleDelete}
              className="opacity-100 lg:opacity-0 lg:group-hover/agenda:opacity-100 text-text-quaternary hover:text-danger w-11 h-11 -mr-2.5 -my-3 flex items-center justify-center transition-all shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 2l6 6M8 2L2 8" />
              </svg>
            </button>
          )}
        </>
      )}
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
