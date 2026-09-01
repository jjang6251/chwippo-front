import { useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { PenLine, BookOpen, FileText, TriangleAlert } from 'lucide-react'
import { useDemoLink } from '@/hooks/useDemoLink'
import type { CalendarEvent } from '@/api/calendar'
import {
  useDailyNotes,
  useCreateDailyNote,
  useUpdateDailyNote,
  useDeleteNoteWithUndo,
  useUrgentChecklist,
  useCompleteUrgentChecklistItem,
  useCarryOverDailyNote,
} from '@/hooks/useCalendar'
import { InlineNoteEditor, NOTE_MAX } from './InlineNoteEditor'
import { calcDday, getDdayLabel } from '@/utils/dday'
import { detectScheduleConflicts } from '@/utils/scheduleConflict'
import { getHolidayName } from '@/utils/holidays'
import { todayLocal, addDays, DEADLINE_DISPLAY_TIME } from '@/utils/datetime'

const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']
const BASE_HOUR = 6
const NOTE_COUNTER_THRESHOLD = 150

/**
 * 캘린더 UX 재구성 — 선택일 상세 내용 (공유 컴포넌트).
 *
 * 데스크탑: 사이드 aside 패널에 그대로 렌더.
 * 모바일: `CalendarDaySheet`(vaul Drawer) 안에 렌더.
 *
 * 3구획: ① 종일(마감·종일 이벤트) ② 할 일(hourSlot=null daily-notes · CRUD)
 *        ③ 시간 이벤트(시간 있는 step/exam/note 시간순)
 * 추가: 🔥 마감 임박 준비(오늘만) · 어제 미완료 이월(U12, 오늘만) · 삭제 undo(U13)
 */
interface Props {
  date: string
  events: CalendarEvent[]
  onClose?: () => void
  /** 6c — 인라인(모바일 월별) 헤더 우측 "상세 열기 →" 진입점. onClose 와 배타 (인라인=onExpand·시트=onClose). */
  onExpand?: () => void
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
  const link = useDemoLink()
  const time = event.time?.slice(0, 5)

  // 이벤트 종류별 색·아이콘 — U29 v2: surface-2 승격 + 유형색 좌측 스트라이프 (아젠다 카드와 동일 문법)
  let Icon = PenLine
  let stripe = 'border-l-info'
  let textColor = 'text-info'
  if (event.type === 'exam') {
    Icon = BookOpen
    stripe = 'border-l-violet'
    textColor = 'text-violet'
  } else if (event.type === 'step') {
    Icon = FileText
    stripe = 'border-l-warning'
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
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-card-solid border border-line-strong border-l-[3px] shadow-sm transition-colors ${stripe} ${to ? 'hover:bg-surface-3' : ''}`}>
      <Icon size={15} strokeWidth={1.75} aria-hidden="true" className={`shrink-0 ${textColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{label}</p>
        <p className="text-[11px] text-text-tertiary tabular-nums mt-0.5">
          {time ?? '종일'}
          {event.location ? ` · ${event.location}` : ''}
        </p>
      </div>
      {event.type === 'step' && time === undefined && (
        <span className={`text-[11px] font-semibold ${textColor} shrink-0`}>{DEADLINE_DISPLAY_TIME}</span>
      )}
    </div>
  )
  if (to) {
    return (
      <Link
        to={link(to)}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        {inner}
      </Link>
    )
  }
  return inner
}

export function DayDetailContent({ date, events, onClose, onExpand }: Props) {
  const link = useDemoLink()
  const d = dayjs(date)
  const isToday = date === todayLocal()
  const yesterday = isToday ? addDays(todayLocal(), -1) : null

  const [inputText, setInputText] = useState('')
  // 6b — 한 번에 1행만 인라인 편집 (할 일 텍스트 탭 진입)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: notes = [], isLoading: notesLoading = false } = useDailyNotes(date)
  // U12 — 어제 미완료 이월 후보 (오늘 볼 때만 조회)
  const { data: yesterdayNotes = [] } = useDailyNotes(yesterday)
  const { mutate: createNote } = useCreateDailyNote(date)
  const { mutate: updateNote } = useUpdateDailyNote(date)
  const deleteNoteWithUndo = useDeleteNoteWithUndo(date)
  const { mutate: carryOver } = useCarryOverDailyNote()
  // A3 — 오늘 패널에만 D-3 이내 스텝 미완 체크리스트 합류 (read-through)
  const { data: urgentItems = [] } = useUrgentChecklist(isToday)
  const { mutate: completeUrgent, isPending: completingUrgent } =
    useCompleteUrgentChecklistItem()

  // note 타입은 daily-notes 에서 별도 fetch → events 에서 제외 (중복 방지)
  const nonNoteEvents = events.filter((e) => e.type !== 'note')
  // A4 — 이 날짜의 시간 일정 충돌 (시간 있는 step·exam 2개+)
  const dayConflict = detectScheduleConflicts(events).get(date) ?? null
  const allDayEvents = nonNoteEvents.filter((e) => !e.time)
  const timedEvents = nonNoteEvents.filter((e) => !!e.time).sort(compareByTime)

  const unscheduledNotes = notes.filter((n) => n.hourSlot === null)
  const scheduledNotes = notes
    .filter((n) => n.hourSlot !== null)
    .sort((a, b) => (a.hourSlot ?? 0) - (b.hourSlot ?? 0))

  // U12 — 어제 못 끝낸 시간 없는 할 일 (오늘 볼 때만)
  const carryOverCandidates = yesterdayNotes.filter(
    (n) => n.hourSlot === null && !n.isDone,
  )

  function handleAddNote() {
    const content = inputText.trim()
    if (!content) return
    createNote({ date, hourSlot: null, content })
    setInputText('')
  }

  const overThreshold = inputText.length >= NOTE_COUNTER_THRESHOLD

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-text-primary font-semibold text-sm">
            {d.month() + 1}월 {d.date()}일 ({KO_DAYS[d.day()]})
          </span>
          {isToday && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-brand/15 text-brand">
              오늘
            </span>
          )}
          {getHolidayName(date) && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-danger/10 text-danger border border-danger/20">
              {getHolidayName(date)}
            </span>
          )}
        </div>
        {onExpand ? (
          <button
            onClick={onExpand}
            className="shrink-0 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors rounded py-3.5 -my-3.5 px-2 -mx-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            상세 열기 →
          </button>
        ) : onClose ? (
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-text-quaternary hover:bg-card active:bg-card-strong hover:text-text-primary transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* A4 — 일정 충돌 경고 */}
      {dayConflict && (
        <div
          className={`mx-4 mt-3 px-3 py-2 rounded-lg border text-[11px] leading-relaxed ${
            dayConflict.level === 'overlap'
              ? 'bg-danger/8 border-danger/25 text-danger'
              : 'bg-warning/8 border-warning/25 text-warning'
          }`}
        >
          <p className="font-semibold mb-0.5">
            <span className="inline-flex items-center gap-1">
              <TriangleAlert size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
              {dayConflict.level === 'overlap'
                ? '일정이 겹쳐요 — 시간 확인이 필요해요'
                : '이 날 시간 일정이 2개 이상이에요'}
            </span>
          </p>
          <p className="text-text-tertiary">
            {dayConflict.events
              .map((e) =>
                `${e.time} ${[e.companyName, e.stepName].filter(Boolean).join(' ')}`.trim(),
              )
              .join(' · ')}
          </p>
        </div>
      )}

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

        {/* A3 — 마감 임박 준비 (D-3 이내 스텝 미완 체크리스트, 오늘만). 체크 = 원본 checklist 토글 */}
        {isToday && urgentItems.length > 0 && (
          <div className="mb-3 space-y-1.5">
            <p className="text-[10px] font-medium text-warning">🔥 마감 임박 준비</p>
            {urgentItems.map((item) => {
              const dday = calcDday(item.date)
              return (
                <div key={item.itemId} className="flex items-center gap-2">
                  <button
                    aria-label="완료 표시"
                    disabled={completingUrgent}
                    onClick={() =>
                      completeUrgent({
                        applicationId: item.applicationId,
                        stepId: item.stepId,
                        itemId: item.itemId,
                      })
                    }
                    className="group/urgent w-11 h-11 -ml-2.5 sm:-my-3 flex items-center justify-center shrink-0 disabled:opacity-50 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                  >
                    <span className="w-3.5 h-3.5 rounded-sm border border-warning/50 group-hover/urgent:border-warning transition-colors" />
                  </button>
                  <span className="text-[11px] flex-1 min-w-0 truncate text-text-secondary">
                    {item.content}
                  </span>
                  <Link
                    to={link(`/board/${item.applicationId}/steps/${item.stepId}`)}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] text-text-quaternary hover:text-text-secondary bg-surface-3 border border-line px-1.5 py-0.5 rounded-full transition-colors"
                    title={`${item.companyName} ${item.stepName} 준비 체크리스트로 이동`}
                  >
                    <span className="max-w-[72px] truncate">{item.companyName}</span>
                    <span className="text-warning font-mono font-semibold">
                      {getDdayLabel(dday)}
                    </span>
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        {/* 할 일 입력 v2 — 고스트 행 (항상 노출 · 탭 즉시 타이핑) */}
        <div className="flex items-center gap-2 mb-1">
          <span className="w-11 h-11 -ml-2.5 sm:w-8 sm:h-8 sm:-ml-2 flex items-center justify-center shrink-0 text-text-quaternary" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M7 2.5v9M2.5 7h9" />
            </svg>
          </span>
          <input
            type="text"
            maxLength={NOTE_MAX}
            autoComplete="off"
            enterKeyHint="done"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddNote()
              if (e.key === 'Escape') setInputText('')
            }}
            placeholder="할 일 추가"
            aria-label="할 일 추가"
            className="flex-1 min-w-0 bg-transparent text-base sm:text-xs text-text-primary placeholder:text-text-tertiary outline-none py-2 sm:py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          />
          {overThreshold && (
            <span className="shrink-0 text-[11px] text-warning tabular-nums">
              {inputText.length}/{NOTE_MAX}
            </span>
          )}
          {inputText.trim() && (
            <button
              onClick={handleAddNote}
              aria-label="할 일 추가"
              className="shrink-0 h-11 sm:h-8 -mr-1 flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded-lg"
            >
              <span className="h-8 px-3 text-[13px] sm:h-7 sm:px-2.5 sm:text-[12px] rounded-lg bg-brand text-bg font-semibold flex items-center">
                추가
              </span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {unscheduledNotes.map((n) => (
            <div key={n.id} className="flex items-center gap-2 group/note">
              <button
                aria-label={n.isDone ? '완료 취소' : '완료 표시'}
                onClick={() => updateNote({ id: n.id, isDone: !n.isDone })}
                className="group/check w-11 h-11 -ml-2.5 sm:-my-3 flex items-center justify-center shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              >
                <span
                  className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                    n.isDone
                      ? 'bg-success border-success text-bg'
                      : 'border-line-strong group-hover/check:border-success/60'
                  }`}
                >
                  {n.isDone && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </button>
              {editingId === n.id ? (
                <InlineNoteEditor note={n} onDone={() => setEditingId(null)} />
              ) : (
                <>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="할 일 수정"
                    onClick={() => setEditingId(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setEditingId(n.id)
                      }
                    }}
                    className={`text-[11px] flex-1 min-w-0 line-clamp-2 break-words cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
                      n.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'
                    }`}
                  >
                    {n.content}
                  </span>
                  <button
                    aria-label="삭제"
                    onClick={() => deleteNoteWithUndo(n)}
                    className="opacity-100 lg:opacity-0 lg:group-hover/note:opacity-100 text-text-quaternary hover:text-danger w-11 h-11 -mr-2.5 sm:-my-3 flex items-center justify-center transition-all shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2L2 8" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}

          {/* false-empty flash 방지 — 로딩 중에는 empty 문구 미노출 */}
          {unscheduledNotes.length === 0 && !notesLoading && (
            <p className="text-[11px] text-text-quaternary">아직 할 일이 없어요</p>
          )}
        </div>

        {/* U12 — 어제 미완료 이월 (오늘만) */}
        {isToday && carryOverCandidates.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {carryOverCandidates.map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-line border-dashed"
              >
                <span className="w-4 h-4 rounded-sm border border-line-strong shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] line-clamp-2 break-words text-text-tertiary">{n.content}</p>
                  <p className="text-[10px] text-text-quaternary mt-0.5">어제 못 끝낸 일</p>
                </div>
                <button
                  onClick={() => carryOver(n.id)}
                  aria-label="오늘로 이월"
                  className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-full bg-brand/12 border border-brand/30 text-[12px] font-semibold text-brand hover:bg-brand/18 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                >
                  오늘로 →
                </button>
              </div>
            ))}
          </div>
        )}
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
              <div key={n.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card-solid border border-line-strong border-l-[3px] border-l-info shadow-sm group/note">
                <span className="text-[10px] text-text-quaternary tabular-nums shrink-0 w-10">
                  {slotToLabel(n.hourSlot ?? 0)}
                </span>
                <button
                  aria-label={n.isDone ? '완료 취소' : '완료 표시'}
                  onClick={() => updateNote({ id: n.id, isDone: !n.isDone })}
                  className={`relative w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
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
                {editingId === n.id ? (
                  <InlineNoteEditor note={n} onDone={() => setEditingId(null)} />
                ) : (
                  <>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="할 일 수정"
                      onClick={() => setEditingId(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setEditingId(n.id)
                        }
                      }}
                      className={`text-[11px] flex-1 min-w-0 truncate cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
                        n.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'
                      }`}
                    >
                      {n.content}
                    </span>
                    <button
                      aria-label="삭제"
                      onClick={() => deleteNoteWithUndo(n)}
                      className="opacity-100 lg:opacity-0 lg:group-hover/note:opacity-100 text-text-quaternary hover:text-danger w-11 h-11 -mr-2.5 sm:-my-3 flex items-center justify-center transition-all shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l6 6M8 2L2 8" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
