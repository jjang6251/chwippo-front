import { useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CalendarEvent } from '@/api/calendar'
import {
  useDailyNotes,
  useCreateDailyNote,
  useUpdateDailyNote,
  useDeleteDailyNote,
} from '@/hooks/useCalendar'

const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']
const BASE_HOUR = 6

/**
 * 캘린더 UX 재구성 — 선택일 상세 패널 (3구획 컴팩트 리스트).
 *
 * 이전 36 슬롯 시간 그리드 제거. 시간 이벤트는 시간순 리스트로 표시.
 * daily-notes hourSlot 컬럼 · CRUD API 는 유지 (미래 시간 슬롯 뷰 필요 시 재활용).
 *
 * 3구획:
 *   1. 종일 — 마감 · 종일 이벤트 (time null 인 step)
 *   2. 할 일 — 시간 없는 daily-notes (hourSlot=null) · CRUD 가능
 *   3. 시간 이벤트 — 시간 있는 step/exam/note 시간순 리스트
 */
interface Props {
  date: string
  events: CalendarEvent[]
  onClose?: () => void
}

/** 시간 있는 이벤트 정렬 (없는 것은 뒤로) */
function compareByTime(a: CalendarEvent, b: CalendarEvent): number {
  if (a.time === b.time) return 0
  if (a.time === null) return 1
  if (b.time === null) return -1
  return a.time.localeCompare(b.time)
}

function slotToLabel(slot: number): string {
  const totalMins = BASE_HOUR * 60 + slot * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function EventLink({ event }: { event: CalendarEvent }) {
  const time = event.time?.slice(0, 5)

  // 이벤트 종류별 색·아이콘
  let icon = '📝'
  let bg = 'bg-info/8'
  let border = 'border-info/25'
  let textColor = 'text-info'
  if (event.type === 'exam') {
    icon = '📚'
    bg = 'bg-violet/10'
    border = 'border-violet/25'
    textColor = 'text-violet'
  } else if (event.type === 'step') {
    icon = '📄'
    bg = 'bg-warning/8'
    border = 'border-warning/25'
    textColor = 'text-warning'
  }

  const to =
    event.type === 'exam'
      ? '/myinfo#exam-schedules'
      : event.type === 'step' && event.stepId
        ? `/board/${event.applicationId}/steps/${event.stepId}`
        : event.type === 'step'
          ? `/board/${event.applicationId}`
          : null

  const label =
    event.type === 'step'
      ? `${event.companyName ?? ''} · ${event.stepName ?? ''}`
      : event.type === 'exam'
        ? event.companyName ?? ''
        : event.content ?? ''

  const inner = (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bg} ${border}`}>
      <span className="text-sm shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{label}</p>
        <p className="text-[10px] text-text-tertiary tabular-nums mt-0.5">
          {time ?? '종일'}
          {event.location ? ` · ${event.location}` : ''}
        </p>
      </div>
      {event.type === 'step' && time === undefined && (
        <span className={`text-[10px] font-semibold ${textColor} shrink-0`}>23:59</span>
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

export function CalendarDayPanel({ date, events, onClose }: Props) {
  const d = dayjs(date)
  const isToday = date === dayjs().format('YYYY-MM-DD')

  const [inputActive, setInputActive] = useState(false)
  const [inputText, setInputText] = useState('')

  const { data: notes = [] } = useDailyNotes(date)
  const { mutate: createNote } = useCreateDailyNote(date)
  const { mutate: updateNote } = useUpdateDailyNote(date)
  const { mutate: deleteNote } = useDeleteDailyNote(date)

  // note 타입은 daily-notes 에서 별도 fetch → events 에서 제외 (중복 방지)
  const nonNoteEvents = events.filter((e) => e.type !== 'note')
  const allDayEvents = nonNoteEvents.filter((e) => !e.time)
  const timedEvents = nonNoteEvents.filter((e) => !!e.time).sort(compareByTime)

  const unscheduledNotes = notes.filter((n) => n.hourSlot === null)
  const scheduledNotes = notes
    .filter((n) => n.hourSlot !== null)
    .sort((a, b) => (a.hourSlot ?? 0) - (b.hourSlot ?? 0))

  function handleAddNote() {
    const content = inputText.trim()
    if (!content) {
      setInputActive(false)
      return
    }
    createNote({ date, hourSlot: null, content })
    setInputText('')
    setInputActive(false)
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-semibold text-sm">
            {d.month() + 1}월 {d.date()}일 ({KO_DAYS[d.day()]})
          </span>
          {isToday && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-brand/15 text-brand">
              오늘
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:bg-card active:bg-card-strong hover:text-text-primary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        )}
      </div>

      {/* 1. 종일 */}
      <div className="px-4 py-3 border-b border-line">
        <p className="text-[10px] font-medium text-text-tertiary mb-2">종일</p>
        {allDayEvents.length === 0 ? (
          <p className="text-[11px] text-text-quaternary">없음</p>
        ) : (
          <div className="space-y-1.5">
            {allDayEvents.map((e, idx) => (
              <EventLink key={`allday-${idx}`} event={e} />
            ))}
          </div>
        )}
      </div>

      {/* 2. 할 일 (hourSlot=null daily-notes) */}
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-medium text-text-tertiary">
            할 일{' '}
            {unscheduledNotes.length > 0 && (
              <span className="text-text-quaternary tabular-nums ml-1">
                {unscheduledNotes.filter((n) => n.isDone).length} / {unscheduledNotes.length}
              </span>
            )}
          </p>
        </div>
        <div className="space-y-1.5">
          {unscheduledNotes.map((n) => (
            <div key={n.id} className="flex items-center gap-2 group/note">
              <button
                aria-label={n.isDone ? '완료 취소' : '완료 표시'}
                onClick={() => updateNote({ id: n.id, isDone: !n.isDone })}
                className={`relative w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${
                  n.isDone
                    ? 'bg-success border-success text-bg'
                    : 'border-line-strong hover:border-success/60'
                }`}
              >
                {n.isDone && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span
                className={`text-[11px] flex-1 min-w-0 truncate ${
                  n.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'
                }`}
              >
                {n.content}
              </span>
              <button
                aria-label="삭제"
                onClick={() => deleteNote(n.id)}
                className="opacity-0 group-hover/note:opacity-100 text-text-quaternary hover:text-danger w-6 h-6 flex items-center justify-center transition-all shrink-0"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l6 6M8 2L2 8" />
                </svg>
              </button>
            </div>
          ))}

          {inputActive ? (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-sm border border-line-strong shrink-0" />
              <input
                autoFocus
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddNote()
                  if (e.key === 'Escape') {
                    setInputActive(false)
                    setInputText('')
                  }
                }}
                onBlur={handleAddNote}
                placeholder="할 일 입력 후 Enter"
                className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setInputActive(true)
                setInputText('')
              }}
              className="mt-1 flex items-center gap-1 text-[10px] text-text-quaternary hover:text-text-secondary"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5 1v8M1 5h8" />
              </svg>
              할 일 추가
            </button>
          )}
        </div>
      </div>

      {/* 3. 시간 이벤트 리스트 (시간 있는 이벤트 · 시간 있는 note 통합) */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-medium text-text-tertiary mb-2">
          시간 이벤트{' '}
          {(timedEvents.length + scheduledNotes.length) > 0 && (
            <span className="text-text-quaternary tabular-nums ml-1">
              {timedEvents.length + scheduledNotes.length}
            </span>
          )}
        </p>
        {timedEvents.length === 0 && scheduledNotes.length === 0 ? (
          <p className="text-[11px] text-text-quaternary">없음</p>
        ) : (
          <div className="space-y-1.5">
            {timedEvents.map((e, idx) => (
              <EventLink key={`timed-${idx}`} event={e} />
            ))}
            {scheduledNotes.map((n) => (
              <div key={n.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-info/6 border border-info/20 group/note">
                <span className="text-[10px] text-text-quaternary tabular-nums shrink-0 w-10">
                  {slotToLabel(n.hourSlot ?? 0)}
                </span>
                <button
                  aria-label={n.isDone ? '완료 취소' : '완료 표시'}
                  onClick={() => updateNote({ id: n.id, isDone: !n.isDone })}
                  className={`relative w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${
                    n.isDone
                      ? 'bg-success border-success text-bg'
                      : 'border-line-strong hover:border-success/60'
                  }`}
                >
                  {n.isDone && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span
                  className={`text-[11px] flex-1 min-w-0 truncate ${
                    n.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'
                  }`}
                >
                  {n.content}
                </span>
                <button
                  aria-label="삭제"
                  onClick={() => deleteNote(n.id)}
                  className="opacity-0 group-hover/note:opacity-100 text-text-quaternary hover:text-danger w-6 h-6 flex items-center justify-center transition-all shrink-0"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2l6 6M8 2L2 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
