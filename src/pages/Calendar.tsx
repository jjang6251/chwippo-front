import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useCalendarEvents } from '@/hooks/useCalendar'
import type { CalendarEvent } from '@/api/calendar'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']

// 서류 마감: 주황(amber) / 면접: 초록(emerald)
const COLOR = {
  deadline: {
    dot: 'bg-amber-400',
    pill: 'bg-amber-400/15 text-amber-300',
    badge: 'bg-amber-400/12 text-amber-400',
    border: 'border-amber-400/25',
    icon: '📄',
    label: '서류',
    summary: 'text-amber-400',
  },
  interview: {
    dot: 'bg-emerald-400',
    pill: 'bg-emerald-400/15 text-emerald-300',
    badge: 'bg-emerald-400/12 text-emerald-400',
    border: 'border-emerald-400/25',
    icon: '🗓️',
    label: '면접',
    summary: 'text-emerald-400',
  },
} as const

function eventLabel(e: CalendarEvent) {
  if (e.type === 'deadline') return `${e.companyName} 서류`
  const step = e.stepName ?? '면접'
  return `${e.companyName} ${step}`
}

function fmtDate(dateStr: string) {
  const d = dayjs(dateStr)
  return `${d.month() + 1}/${d.date()} (${KO_DAYS[d.day()]})`
}

export function Calendar() {
  const [cursor, setCursor] = useState(dayjs().startOf('month'))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = cursor.year()
  const month = cursor.month() + 1

  const { data: events = [], isLoading } = useCalendarEvents(year, month)

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [events])

  const cells = useMemo(() => {
    const firstDay = cursor.day()
    const daysInMonth = cursor.daysInMonth()
    const result: (dayjs.Dayjs | null)[] = [
      ...Array<null>(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => cursor.add(i, 'day')),
    ]
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [cursor])

  const today = dayjs().format('YYYY-MM-DD')
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : []

  const deadlineCount = events.filter((e) => e.type === 'deadline').length
  const interviewCount = events.filter((e) => e.type === 'interview').length

  function prevMonth() { setCursor((d) => d.subtract(1, 'month')); setSelectedDate(null) }
  function nextMonth() { setCursor((d) => d.add(1, 'month')); setSelectedDate(null) }
  function goToday() { setCursor(dayjs().startOf('month')); setSelectedDate(dayjs().format('YYYY-MM-DD')) }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-text-primary text-xl font-bold">{cursor.format('YYYY년 M월')}</h1>
          <button
            onClick={goToday}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-white/10 text-text-tertiary hover:text-text-secondary hover:border-white/20 transition-colors"
          >
            오늘
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} aria-label="이전 달" className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:bg-white/6 hover:text-text-primary transition-colors">
            <ChevronLeft />
          </button>
          <button onClick={nextMonth} aria-label="다음 달" className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:bg-white/6 hover:text-text-primary transition-colors">
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* 이번 달 요약 배너 */}
      {!isLoading && (deadlineCount > 0 || interviewCount > 0) && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-2 border border-white/5 rounded-xl">
          <span className="text-xs text-text-quaternary">이번 달</span>
          {deadlineCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              서류 마감 {deadlineCount}건
            </span>
          )}
          {deadlineCount > 0 && interviewCount > 0 && (
            <span className="text-white/10">|</span>
          )}
          {interviewCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              면접 일정 {interviewCount}건
            </span>
          )}
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-surface-2 border border-white/5 rounded-2xl overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-white/5">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`py-2.5 text-center text-xs font-medium ${
                i === 0 ? 'text-red-400/70' : i === 6 ? 'text-sky-400/70' : 'text-text-quaternary'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-20 border-b border-r border-white/3 animate-pulse bg-white/2" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-white/3" />
              }

              const dateStr = day.format('YYYY-MM-DD')
              const dayEvents = eventsByDate[dateStr] ?? []
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              const isPast = dateStr < today
              const isSun = day.day() === 0
              const isSat = day.day() === 6
              const isLastRow = i >= cells.length - 7
              const visibleEvents = dayEvents.slice(0, 2)
              const overflow = dayEvents.length - 2

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[80px] flex flex-col items-start p-1.5 gap-1 border-b border-r border-white/3 transition-colors text-left w-full
                    ${isLastRow ? 'border-b-0' : ''}
                    ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}
                    ${isSelected ? 'bg-brand/8' : 'hover:bg-white/3'}
                    ${isPast ? 'opacity-50' : ''}
                  `}
                >
                  {/* Day number */}
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold shrink-0
                      ${isToday ? 'bg-brand text-white' : ''}
                      ${!isToday && isSun ? 'text-red-400/80' : ''}
                      ${!isToday && isSat ? 'text-sky-400/80' : ''}
                      ${!isToday && !isSun && !isSat ? 'text-text-secondary' : ''}
                    `}
                  >
                    {day.date()}
                  </span>

                  {/* 데스크탑: 이벤트 pill 태그 */}
                  <div className="hidden sm:flex flex-col gap-0.5 w-full">
                    {visibleEvents.map((e, idx) => (
                      <span
                        key={idx}
                        className={`text-[9px] font-medium px-1.5 py-0.5 rounded truncate w-full leading-tight ${COLOR[e.type].pill}`}
                        title={eventLabel(e)}
                      >
                        {eventLabel(e)}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="text-[9px] text-text-quaternary px-1">+{overflow}개</span>
                    )}
                  </div>

                  {/* 모바일: 색 점만 */}
                  {dayEvents.length > 0 && (
                    <div className="sm:hidden flex gap-0.5 flex-wrap px-0.5">
                      {dayEvents.slice(0, 3).map((e, idx) => (
                        <span key={idx} className={`w-1.5 h-1.5 rounded-full shrink-0 ${COLOR[e.type].dot}`} />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] text-text-quaternary">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-5">
        {(['deadline', 'interview'] as const).map((type) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-text-quaternary">
            <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${COLOR[type].dot}`} />
            {type === 'deadline' ? '서류 마감' : '면접 일정'}
          </div>
        ))}
      </div>

      {/* 선택된 날짜 이벤트 */}
      {selectedDate && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text-secondary">
            {(() => { const d = dayjs(selectedDate); return `${d.month() + 1}월 ${d.date()}일 (${KO_DAYS[d.day()]})`})()}
          </h2>
          {selectedEvents.length === 0 ? (
            <div className="text-text-quaternary text-sm py-6 text-center bg-surface-2 border border-white/5 rounded-xl">
              이 날 일정이 없어요
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((e, idx) => (
                <EventCard key={idx} event={e} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 이번 달 전체 일정 (날짜 미선택 시) */}
      {!selectedDate && events.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-text-secondary">이번 달 일정</h2>
          <div className="space-y-2">
            {events.map((e, idx) => (
              <EventCard key={idx} event={e} showDate />
            ))}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!selectedDate && !isLoading && events.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-4xl">📅</span>
          <p className="text-text-tertiary text-sm">이번 달 일정이 없어요</p>
          <p className="text-text-quaternary text-xs leading-relaxed">
            보드에서 서류 마감일이나<br />면접 스텝에 날짜를 등록해보세요
          </p>
          <Link to="/board" className="mt-1 text-xs font-medium text-brand hover:text-accent transition-colors">
            보드로 이동 →
          </Link>
        </div>
      )}
    </div>
  )
}

function EventCard({ event, showDate }: { event: CalendarEvent; showDate?: boolean }) {
  const c = COLOR[event.type]
  return (
    <Link
      to={`/board/${event.applicationId}`}
      className={`flex items-center gap-3 bg-surface-2 border rounded-xl px-4 py-3 hover:bg-white/4 transition-colors group ${c.border}`}
    >
      <span className="text-base shrink-0">{c.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors truncate">
          {event.companyName}
        </p>
        <p className="text-xs text-text-quaternary mt-0.5">
          {event.type === 'deadline' ? '서류 마감' : event.stepName}
          {event.location && <span className="ml-1.5">· {event.location}</span>}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
          {c.label}
        </span>
        {showDate && (
          <span className="text-[10px] text-text-quaternary">{fmtDate(event.date)}</span>
        )}
      </div>
    </Link>
  )
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12L6 8l4-4" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}
