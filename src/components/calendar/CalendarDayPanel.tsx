import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CalendarEvent } from '@/api/calendar'
import { useDailyNotes, useCreateDailyNote, useUpdateDailyNote, useDeleteDailyNote } from '@/hooks/useCalendar'

// hourSlot: 0 = 06:00, step 30min each. BASE_HOUR = 6
// 00:00 = slot -12, 23:30 = slot 35
const BASE_HOUR = 6
const PANEL_START_SLOT = (0 - BASE_HOUR) * 2    // -12 → 00:00
const PANEL_END_SLOT = (24 - BASE_HOUR) * 2     // 36 (exclusive) → last shown: slot 35 = 23:30
const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']

function slotToLabel(slot: number) {
  const totalMins = BASE_HOUR * 60 + slot * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToSlot(time: string): number | null {
  const [h, m] = time.split(':').map(Number)
  const slot = (h - BASE_HOUR) * 2 + (m >= 30 ? 1 : 0)
  return slot >= PANEL_START_SLOT && slot < PANEL_END_SLOT ? slot : null
}

function currentTimeSlot(): number {
  const now = dayjs()
  return (now.hour() - BASE_HOUR) * 2 + (now.minute() >= 30 ? 1 : 0)
}

interface Props {
  date: string
  events: CalendarEvent[]
  onClose?: () => void
}

export function CalendarDayPanel({ date, events, onClose }: Props) {
  const d = dayjs(date)
  const isToday = date === dayjs().format('YYYY-MM-DD')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [inputSlot, setInputSlot] = useState<number | null>(null)
  const [inputText, setInputText] = useState('')

  const { data: notes = [] } = useDailyNotes(date)
  const { mutate: createNote } = useCreateDailyNote(date)
  const { mutate: updateNote } = useUpdateDailyNote(date)
  const { mutate: deleteNote } = useDeleteDailyNote(date)

  // 'note' 타입은 useDailyNotes로 별도 fetch해서 렌더하므로 events에서 제외 (중복 방지)
  const nonNoteEvents = events.filter((e) => e.type !== 'note')
  const eventsBySlot: Record<number, CalendarEvent[]> = {}
  for (const e of nonNoteEvents) {
    if (e.time) {
      const slot = timeToSlot(e.time)
      if (slot !== null) {
        if (!eventsBySlot[slot]) eventsBySlot[slot] = []
        eventsBySlot[slot].push(e)
      }
    }
  }
  const timelessEvents = nonNoteEvents.filter((e) => !e.time)

  const nullSlotNotes = notes.filter((n) => n.hourSlot === null)
  const notesBySlot: Record<number, typeof notes> = {}
  for (const n of notes) {
    if (n.hourSlot === null) continue
    if (!notesBySlot[n.hourSlot]) notesBySlot[n.hourSlot] = []
    notesBySlot[n.hourSlot].push(n)
  }

  useEffect(() => {
    if (!scrollRef.current) return
    const SLOT_HEIGHT = 56
    const containerH = scrollRef.current.clientHeight || 400
    const targetSlot = isToday ? currentTimeSlot() : (8 - BASE_HOUR) * 2 // 기본 08:00
    // 현재 시각이 컨테이너 상단 1/3에 오도록
    const targetPx = (targetSlot - PANEL_START_SLOT) * SLOT_HEIGHT
    scrollRef.current.scrollTop = Math.max(0, targetPx - containerH / 3)
  }, [date, isToday])

  function handleAddNote(slot: number) {
    if (!inputText.trim()) { setInputSlot(null); return }
    createNote({ date, hourSlot: slot, content: inputText.trim() })
    setInputText('')
    setInputSlot(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-semibold text-sm">
            {d.month() + 1}월 {d.date()}일 ({KO_DAYS[d.day()]})
          </span>
          {isToday && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-brand/15 text-brand">오늘</span>
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

      {/* All-day events */}
      {timelessEvents.length > 0 && (
        <div className="px-3 py-2 border-b border-line shrink-0 space-y-1">
          <p className="text-[9px] text-text-quaternary font-medium uppercase tracking-wide">종일</p>
          {timelessEvents.map((e, idx) => (
            <Link
              key={idx}
              to={`/board/${e.applicationId}`}
              className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 px-3 py-1.5 rounded-lg hover:bg-warning/15 transition-colors"
            >
              <span>📄</span>
              <span className="font-medium truncate">{e.companyName} 서류 마감</span>
            </Link>
          ))}
        </div>
      )}

      {/* Unscheduled notes (할 일) — always shown so users can add */}
      <div className="px-3 py-2 border-b border-line shrink-0 space-y-1">
          <p className="text-[9px] text-text-quaternary font-medium uppercase tracking-wide">📌 할 일</p>
          {nullSlotNotes.map((n) => (
            <div key={n.id} className="flex items-center gap-1.5 group/note">
              <button
                aria-label={n.isDone ? '완료 취소' : '완료 표시'}
                onClick={() => updateNote({ id: n.id, isDone: !n.isDone })}
                className={`relative w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${
                  n.isDone ? 'bg-success border-success text-text-primary' : 'border-line hover:border-success/60'
                }`}
              >
                {n.isDone && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className={`text-[11px] flex-1 min-w-0 truncate ${n.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'}`}>
                {n.content}
              </span>
              <button
                aria-label="삭제"
                onClick={() => deleteNote(n.id)}
                className="opacity-0 group-hover/note:opacity-100 text-text-quaternary hover:text-danger w-8 h-8 flex items-center justify-center transition-all shrink-0"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l6 6M8 2L2 8" />
                </svg>
              </button>
            </div>
          ))}
          <NullSlotInput date={date} createNote={createNote} />
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {Array.from({ length: PANEL_END_SLOT - PANEL_START_SLOT }, (_, i) => {
          const slot = PANEL_START_SLOT + i
          const label = slotToLabel(slot)
          // JS에서 음수 % 2 = -1이므로 !== 0 으로 체크 (예: -11 % 2 = -1)
          const isHalfHour = slot % 2 !== 0
          const slotEvents = eventsBySlot[slot] ?? []
          const slotNotes = notesBySlot[slot] ?? []
          const isCurrentSlot = isToday && currentTimeSlot() === slot

          return (
            <div key={slot} className={`flex gap-0 min-h-[56px] group ${isCurrentSlot ? 'bg-danger/5' : ''}`}>
              {/* Time label */}
              <div className={`w-12 shrink-0 flex items-start justify-end pr-2 pt-1.5 text-[9px] font-mono select-none ${isHalfHour ? 'text-transparent' : 'text-text-quaternary'}`}>
                {label}
              </div>

              {/* Content */}
              <div className={`flex-1 border-t px-2 py-1 relative min-h-[56px] ${isHalfHour ? 'border-line border-dashed' : 'border-line'}`}>
                {isCurrentSlot && <div className="absolute left-0 top-0 w-full h-px bg-danger/60" />}

                {slotEvents.map((e, idx) => {
                  const eventTo = e.type === 'exam'
                    ? '/myinfo#exam-schedules'
                    : e.type === 'step' && e.stepId
                      ? `/board/${e.applicationId}/steps/${e.stepId}`
                      : `/board/${e.applicationId}`
                  const colorClass = e.type === 'exam'
                    ? 'bg-violet/15 border-l-2 border-violet text-violet'
                    : 'bg-warning/15 border-l-2 border-warning text-warning'
                  const icon = e.type === 'exam' ? '📚' : '📄'
                  const label = e.type === 'exam'
                    ? e.companyName
                    : `${e.companyName} ${e.stepName ?? ''}`.trim()
                  return (
                    <Link
                      key={idx}
                      to={eventTo}
                      className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md mb-1 ${colorClass}`}
                    >
                      {icon}
                      <span className="truncate">{label}</span>
                      {e.location && <span className="text-text-quaternary ml-1 shrink-0">· {e.location}</span>}
                    </Link>
                  )
                })}

                {slotNotes.map((n) => (
                  <div key={n.id} className="flex items-center gap-1.5 mb-1 group/note">
                    <button
                      aria-label={n.isDone ? '완료 취소' : '완료 표시'}
                      onClick={() => updateNote({ id: n.id, isDone: !n.isDone })}
                      className={`relative w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${
                        n.isDone ? 'bg-success border-success text-text-primary' : 'border-line hover:border-success/60'
                      }`}
                    >
                      {n.isDone && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className={`text-[11px] flex-1 min-w-0 truncate ${n.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'}`}>
                      {n.content}
                    </span>
                    <button
                      aria-label="삭제"
                      onClick={() => deleteNote(n.id)}
                      className="opacity-0 group-hover/note:opacity-100 text-text-quaternary hover:text-danger w-8 h-8 flex items-center justify-center transition-all shrink-0"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l6 6M8 2L2 8" />
                      </svg>
                    </button>
                  </div>
                ))}

                {inputSlot === slot ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-sm border border-line shrink-0" />
                    <input
                      autoFocus
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddNote(slot)
                        if (e.key === 'Escape') { setInputSlot(null); setInputText('') }
                      }}
                      onBlur={() => handleAddNote(slot)}
                      placeholder="할 일 입력 후 Enter"
                      className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary outline-none"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { setInputSlot(slot); setInputText('') }}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-text-quaternary hover:text-text-secondary transition-all"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M5 1v8M1 5h8" />
                    </svg>
                    추가
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface NullSlotInputProps {
  date: string
  createNote: (args: { date: string; hourSlot: null; content: string }) => void
}

function NullSlotInput({ date, createNote }: NullSlotInputProps) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(false)

  function handleAdd() {
    if (!text.trim()) { setActive(false); return }
    createNote({ date, hourSlot: null, content: text.trim() })
    setText('')
    setActive(false)
  }

  if (active) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <div className="w-3.5 h-3.5 rounded-sm border border-line shrink-0" />
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd()
            if (e.key === 'Escape') { setActive(false); setText('') }
          }}
          onBlur={handleAdd}
          placeholder="할 일 입력 후 Enter"
          className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary outline-none"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setActive(true)}
      className="flex items-center gap-1 text-[10px] text-text-quaternary hover:text-text-secondary transition-colors mt-1"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M5 1v8M1 5h8" />
      </svg>
      추가
    </button>
  )
}
