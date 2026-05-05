import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CalendarEvent } from '@/api/calendar'
import { useDailyNotes, useCreateDailyNote, useUpdateDailyNote, useDeleteDailyNote } from '@/hooks/useCalendar'

// hour_slot: 0 = 06:00, 1 = 06:30, ..., 35 = 23:30
const SLOT_COUNT = 36
const BASE_HOUR = 6

function slotToLabel(slot: number) {
  const totalMins = BASE_HOUR * 60 + slot * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToSlot(time: string): number | null {
  const [h, m] = time.split(':').map(Number)
  const slot = (h - BASE_HOUR) * 2 + (m >= 30 ? 1 : 0)
  return slot >= 0 && slot < SLOT_COUNT ? slot : null
}

function currentTimeSlot(): number {
  const now = dayjs()
  const slot = (now.hour() - BASE_HOUR) * 2 + (now.minute() >= 30 ? 1 : 0)
  return Math.max(0, Math.min(slot, SLOT_COUNT - 1))
}

const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']
const EVENT_COLOR = {
  deadline: 'bg-amber-400/15 border-l-2 border-amber-400 text-amber-300',
  interview: 'bg-emerald-400/15 border-l-2 border-emerald-400 text-emerald-300',
}

interface Props {
  date: string
  events: CalendarEvent[]
  onClose: () => void
}

export function DailyScheduleModal({ date, events, onClose }: Props) {
  const d = dayjs(date)
  const isToday = date === dayjs().format('YYYY-MM-DD')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [inputSlot, setInputSlot] = useState<number | null>(null)
  const [inputText, setInputText] = useState('')

  const { data: notes = [] } = useDailyNotes(date)
  const { mutate: createNote } = useCreateDailyNote(date)
  const { mutate: updateNote } = useUpdateDailyNote(date)
  const { mutate: deleteNote } = useDeleteDailyNote(date)

  // 이벤트를 슬롯 맵으로 변환
  const eventsBySlot: Record<number, CalendarEvent[]> = {}
  for (const e of events) {
    if (e.time) {
      const slot = timeToSlot(e.time)
      if (slot !== null) {
        if (!eventsBySlot[slot]) eventsBySlot[slot] = []
        eventsBySlot[slot].push(e)
      }
    }
  }
  // 시간 없는 이벤트 (서류 마감 등) — 별도 표시
  const timelessEvents = events.filter((e) => !e.time)

  const notesBySlot: Record<number, typeof notes> = {}
  for (const n of notes) {
    if (!notesBySlot[n.hourSlot]) notesBySlot[n.hourSlot] = []
    notesBySlot[n.hourSlot].push(n)
  }

  // 현재 시간 근처로 스크롤
  useEffect(() => {
    if (!scrollRef.current) return
    const slot = isToday ? currentTimeSlot() : 4 // 비오늘: 08:00 근처
    const slotHeight = 64
    scrollRef.current.scrollTop = Math.max(0, slot * slotHeight - 120)
  }, [isToday])

  function handleAddNote(slot: number) {
    if (!inputText.trim()) { setInputSlot(null); return }
    createNote({ date, hourSlot: slot, content: inputText.trim() })
    setInputText('')
    setInputSlot(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
          <div>
            <h2 className="text-text-primary font-semibold text-sm">
              {d.month() + 1}월 {d.date()}일 ({KO_DAYS[d.day()]})
            </h2>
            {isToday && (
              <span className="text-brand text-[10px] font-medium">오늘</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-quaternary hover:bg-white/6 hover:text-text-primary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* 시간 없는 이벤트 (서류 마감 등) */}
        {timelessEvents.length > 0 && (
          <div className="px-4 py-2.5 border-b border-white/6 shrink-0 space-y-1.5">
            <p className="text-[10px] text-text-quaternary font-medium mb-1">종일</p>
            {timelessEvents.map((e, idx) => (
              <Link
                key={idx}
                to={`/board/${e.applicationId}`}
                onClick={onClose}
                className="flex items-center gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg hover:bg-amber-400/15 transition-colors"
              >
                <span>📄</span>
                <span className="font-medium">{e.companyName} 서류 마감</span>
              </Link>
            ))}
          </div>
        )}

        {/* 타임라인 */}
        <div ref={scrollRef} className="overflow-y-auto flex-1">
          {Array.from({ length: SLOT_COUNT }, (_, slot) => {
            const label = slotToLabel(slot)
            const isHalfHour = slot % 2 === 1
            const slotEvents = eventsBySlot[slot] ?? []
            const slotNotes = notesBySlot[slot] ?? []
            const isCurrentSlot = isToday && currentTimeSlot() === slot

            return (
              <div
                key={slot}
                className={`flex gap-0 min-h-[64px] group ${isCurrentSlot ? 'bg-brand/5' : ''}`}
              >
                {/* 시간 레이블 */}
                <div className={`w-14 shrink-0 flex items-start justify-end pr-3 pt-2 text-[10px] font-mono ${isHalfHour ? 'text-transparent' : 'text-text-quaternary'}`}>
                  {isHalfHour ? label : label}
                </div>

                {/* 구분선 + 콘텐츠 */}
                <div className={`flex-1 border-t min-h-[64px] px-2 py-1.5 relative ${isHalfHour ? 'border-white/3 border-dashed' : 'border-white/6'}`}>
                  {isCurrentSlot && (
                    <div className="absolute left-0 top-0 w-full h-px bg-brand/60" />
                  )}

                  {/* 면접/이벤트 */}
                  {slotEvents.map((e, idx) => (
                    <Link
                      key={idx}
                      to={`/board/${e.applicationId}`}
                      onClick={onClose}
                      className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md mb-1 ${EVENT_COLOR[e.type]}`}
                    >
                      {e.type === 'interview' ? '🗓️' : '📄'}
                      <span>{e.companyName} {e.stepName ?? '면접'}</span>
                      {e.location && <span className="text-text-quaternary">· {e.location}</span>}
                    </Link>
                  ))}

                  {/* DailyNote 목록 */}
                  {slotNotes.map((n) => (
                    <div key={n.id} className="flex items-center gap-1.5 mb-1 group/note">
                      <button
                        onClick={() => updateNote({ id: n.id, isDone: !n.isDone })}
                        className={`w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${n.isDone ? 'bg-brand border-brand' : 'border-white/20 hover:border-brand/60'}`}
                      >
                        {n.isDone && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span className={`text-[11px] flex-1 ${n.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'}`}>
                        {n.content}
                      </span>
                      <button
                        onClick={() => deleteNote(n.id)}
                        className="opacity-0 group-hover/note:opacity-100 text-text-quaternary hover:text-danger transition-all w-4 h-4 flex items-center justify-center"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M2 2l6 6M8 2L2 8" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {/* 입력 중인 슬롯 */}
                  {inputSlot === slot ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0" />
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
                        className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-quaternary outline-none"
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
    </div>
  )
}
