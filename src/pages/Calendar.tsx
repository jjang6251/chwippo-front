import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDemoMode } from '@/contexts/demoMode'
import dayjs from 'dayjs'
import { useCalendarEvents } from '@/hooks/useCalendar'
import type { CalendarEvent } from '@/api/calendar'
import { CalendarDayPanel } from '@/components/calendar/CalendarDayPanel'
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView'
import { AddExamScheduleModal } from '@/components/myinfo/AddExamScheduleModal'

type CalendarView = 'month' | 'week'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const COLOR = {
  step: {
    dot: 'bg-warning',
    pill: 'bg-warning/10 text-warning',
    badge: 'bg-warning/10 text-warning',
    border: 'border-warning/25',
    icon: '📄',
    label: '마감',
  },
  exam: {
    dot: 'bg-violet',
    pill: 'bg-violet/10 text-violet',
    badge: 'bg-violet/10 text-violet',
    border: 'border-violet/25',
    icon: '📚',
    label: '시험',
  },
  note: {
    dot: 'bg-info',
    pill: 'bg-info/10 text-info',
    badge: 'bg-info/10 text-info',
    border: 'border-info/25',
    icon: '📝',
    label: '메모',
  },
} as const

const TYPE_PRIORITY: Record<CalendarEvent['type'], number> = {
  step: 0,
  exam: 1,
  note: 2,
}

function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const pa = TYPE_PRIORITY[a.type]
    const pb = TYPE_PRIORITY[b.type]
    if (pa !== pb) return pa - pb
    if (a.time === b.time) return 0
    if (a.time === null) return -1
    if (b.time === null) return 1
    return a.time.localeCompare(b.time)
  })
}

function eventLabel(e: CalendarEvent) {
  if (e.type === 'exam') return e.companyName ?? ''
  if (e.type === 'note') return e.content ?? ''
  return `${e.companyName} ${e.stepName ?? ''}`.trim()
}

function eventPillLabel(e: CalendarEvent) {
  const time = e.time ? e.time.slice(0, 5) : null
  if (e.type === 'exam') {
    const base = e.companyName ?? ''
    return time ? `${time} ${base}` : base
  }
  if (e.type === 'note') {
    return time ? `${time} ${e.content ?? ''}` : (e.content ?? '')
  }
  // step
  const base = `${e.companyName} ${e.stepName ?? ''}`.trim()
  return time ? `${time} ${base}` : base
}

// Korean week starts on Monday
function getWeekStart(date: dayjs.Dayjs): dayjs.Dayjs {
  const day = date.day()
  const daysFromMonday = day === 0 ? 6 : day - 1
  return date.subtract(daysFromMonday, 'day').startOf('day')
}

export function Calendar() {
  const today = dayjs().format('YYYY-MM-DD')
  const [searchParams, setSearchParams] = useSearchParams()
  const queryDate = searchParams.get('date')
  const initialDate = queryDate && dayjs(queryDate, 'YYYY-MM-DD', true).isValid() ? queryDate : today

  const view: CalendarView = searchParams.get('view') === 'week' ? 'week' : 'month'
  function setView(next: CalendarView) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'week') params.set('view', 'week')
      else params.delete('view')
      return params
    }, { replace: true })
  }
  const [cursor, setCursor] = useState(dayjs(initialDate).startOf('month'))
  const [weekCursor, setWeekCursor] = useState(dayjs(initialDate))
  const [selectedDate, setSelectedDate] = useState<string>(initialDate)
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [examModalOpen, setExamModalOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(cursor.year())
  const pickerRef = useRef<HTMLDivElement>(null)

  const year = cursor.year()
  const month = cursor.month() + 1
  const { data: monthlyEvents = [], isLoading: monthlyLoading } = useCalendarEvents(year, month)

  // Weekly view — may span two months
  const weekStart = useMemo(() => getWeekStart(weekCursor), [weekCursor])
  const weekEnd = weekStart.add(6, 'day')
  const { data: weekEvents1 = [], isLoading: weekLoading1 } = useCalendarEvents(
    weekStart.year(), weekStart.month() + 1
  )
  const { data: weekEvents2 = [], isLoading: weekLoading2 } = useCalendarEvents(
    weekEnd.year(), weekEnd.month() + 1
  )
  const weekEvents = useMemo(() => {
    const combined = [...weekEvents1, ...weekEvents2]
    const seen = new Set<string>()
    const weekStartStr = weekStart.format('YYYY-MM-DD')
    const weekEndStr = weekEnd.format('YYYY-MM-DD')
    return combined.filter((e) => {
      const key = `${e.date}|${e.applicationId ?? ''}|${e.type}|${e.stepId ?? ''}|${e.examId ?? ''}|${e.noteId ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return e.date >= weekStartStr && e.date <= weekEndStr
    })
  }, [weekEvents1, weekEvents2, weekStart, weekEnd])

  const weekLoading = weekLoading1 || weekLoading2

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of monthlyEvents) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    for (const k of Object.keys(map)) {
      map[k] = sortDayEvents(map[k])
    }
    return map
  }, [monthlyEvents])

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

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    // Try monthlyEvents first; for weekly view also check weekEvents
    const list = eventsByDate[selectedDate] ?? weekEvents.filter((e) => e.date === selectedDate)
    return sortDayEvents(list)
  }, [selectedDate, eventsByDate, weekEvents])

  const stepCount = monthlyEvents.filter((e) => e.type === 'step').length
  const examCount = monthlyEvents.filter((e) => e.type === 'exam').length

  function handleSelectDate(dateStr: string) {
    if (dateStr === selectedDate) {
      setBottomSheetOpen((o) => !o)
    } else {
      setSelectedDate(dateStr)
      setBottomSheetOpen(true)
    }
  }

  function switchToMonthView() {
    setView('month')
    setCursor(weekCursor.startOf('month'))
  }

  function switchToWeekView() {
    setView('week')
    setWeekCursor(dayjs(selectedDate))
  }

  function prevMonth() {
    setCursor((d) => d.subtract(1, 'month'))
    setSelectedDate(cursor.subtract(1, 'month').format('YYYY-MM') + '-01')
    setBottomSheetOpen(false)
  }

  function nextMonth() {
    setCursor((d) => d.add(1, 'month'))
    setSelectedDate(cursor.add(1, 'month').format('YYYY-MM') + '-01')
    setBottomSheetOpen(false)
  }

  function prevWeek() {
    setWeekCursor((d) => d.subtract(7, 'day'))
    setBottomSheetOpen(false)
  }

  function nextWeek() {
    setWeekCursor((d) => d.add(7, 'day'))
    setBottomSheetOpen(false)
  }

  function goToday() {
    if (view === 'month') {
      setCursor(dayjs().startOf('month'))
    } else {
      setWeekCursor(dayjs())
    }
    setSelectedDate(today)
    setBottomSheetOpen(false)
  }

  function selectMonth(m: number) {
    setCursor(cursor.year(pickerYear).month(m).startOf('month'))
    setPickerOpen(false)
    setBottomSheetOpen(false)
  }

  // Header label
  const headerLabel = view === 'month'
    ? cursor.format('YYYY년 M월')
    : weekStart.month() === weekEnd.month() && weekStart.year() === weekEnd.year()
      ? `${weekStart.year()}년 ${weekStart.month() + 1}월 ${weekStart.date()}일–${weekEnd.date()}일`
      : `${weekStart.year()}년 ${weekStart.month() + 1}월 ${weekStart.date()}일–${weekEnd.month() + 1}월 ${weekEnd.date()}일`

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

      {/* Header — 모바일: 2행 (연/월+컨트롤) / sm+: 1행 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
          <div ref={pickerRef} className="relative">
            <button
              onClick={() => { if (view === 'month') { setPickerOpen((o) => !o); setPickerYear(cursor.year()) } }}
              className={`flex items-center gap-1 text-text-primary text-xl font-bold transition-colors ${view === 'month' ? 'hover:text-brand cursor-pointer' : 'cursor-default'}`}
            >
              {headerLabel}
              {view === 'month' && (
                <svg
                  className={`mt-0.5 transition-transform duration-200 ${pickerOpen ? 'rotate-180' : ''}`}
                  width="14" height="14" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              )}
            </button>

            {pickerOpen && (
              <div className="absolute top-full mt-2 left-0 z-30 bg-surface border border-white/8 rounded-xl shadow-2xl p-4 w-56 max-w-[calc(100vw-2rem)] animate-fadeInUp">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setPickerYear((y) => y - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:bg-white/6 hover:text-text-primary transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
                  </button>
                  <span className="text-text-primary text-sm font-semibold">{pickerYear}년</span>
                  <button
                    onClick={() => setPickerYear((y) => y + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:bg-white/6 hover:text-text-primary transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 12 }, (_, i) => {
                    const isSelected = pickerYear === cursor.year() && i === cursor.month()
                    const isCurrentMonth = pickerYear === dayjs().year() && i === dayjs().month()
                    return (
                      <button
                        key={i}
                        onClick={() => selectMonth(i)}
                        className={`py-1.5 rounded-lg text-xs font-medium transition-colors
                          ${isSelected ? 'bg-brand text-text-primary' : ''}
                          ${!isSelected && isCurrentMonth ? 'text-brand border border-brand/30' : ''}
                          ${!isSelected && !isCurrentMonth ? 'text-text-secondary hover:bg-white/6' : ''}
                        `}
                      >
                        {i + 1}월
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={goToday}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-white/10 text-text-tertiary hover:text-text-secondary hover:border-white/20 transition-colors"
          >
            오늘
          </button>

          <button
            onClick={() => setExamModalOpen(true)}
            aria-label="시험 일정 추가"
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-violet/10 border border-violet/30 text-violet hover:bg-violet/15 transition-colors flex-none"
          >
            <span>📚</span>
            <span>시험 일정 추가</span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-surface-2 border border-white/5 rounded-lg p-0.5">
            <button
              onClick={switchToMonthView}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === 'month' ? 'bg-white/8 text-text-primary' : 'text-text-quaternary hover:text-text-secondary'
              }`}
            >
              월별
            </button>
            <button
              onClick={switchToWeekView}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === 'week' ? 'bg-white/8 text-text-primary' : 'text-text-quaternary hover:text-text-secondary'
              }`}
            >
              주별
            </button>
          </div>

          {/* Prev/Next */}
          <div className="flex items-center gap-1">
            <button
              onClick={view === 'month' ? prevMonth : prevWeek}
              aria-label={view === 'month' ? '이전 달' : '이전 주'}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:bg-white/6 hover:text-text-primary transition-colors"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={view === 'month' ? nextMonth : nextWeek}
              aria-label={view === 'month' ? '다음 달' : '다음 주'}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:bg-white/6 hover:text-text-primary transition-colors"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* Summary banner (monthly view only) */}
      {view === 'month' && !monthlyLoading && (stepCount > 0 || examCount > 0) && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-2 border border-white/5 rounded-xl mb-4">
          <span className="text-xs text-text-quaternary">이번 달</span>
          {stepCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
              마감 {stepCount}건
            </span>
          )}
          {stepCount > 0 && examCount > 0 && (
            <span className="text-white/10">|</span>
          )}
          {examCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-violet">
              <span className="w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
              시험 {examCount}건
            </span>
          )}
        </div>
      )}

      {/* Main content: calendar + side panel */}
      <div className="flex gap-5 items-start">
        {/* Calendar area */}
        <div className="flex-1 min-w-0 space-y-4">

          {view === 'month' ? (
            /* Monthly grid */
            <div className="bg-surface-2 border border-white/5 rounded-xl overflow-hidden">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 border-b border-white/5">
                {DAY_LABELS.map((d, i) => (
                  <div
                    key={d}
                    className={`py-2.5 text-center text-xs font-medium ${
                      i === 0 ? 'text-danger/70' : i === 6 ? 'text-info/70' : 'text-text-quaternary'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {monthlyLoading ? (
                <div className="grid grid-cols-7">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="h-16 sm:h-20 border-b border-r border-white/5 animate-pulse bg-white/2" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7">
                  {cells.map((day, i) => {
                    if (!day) {
                      return <div key={`empty-${i}`} className="min-h-[64px] sm:min-h-[80px] border-b border-r border-white/5" />
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
                        onClick={() => handleSelectDate(dateStr)}
                        className={`min-h-[64px] sm:min-h-[80px] flex flex-col items-start p-1.5 gap-1 border-b border-r border-white/5 transition-colors text-left w-full
                          ${isLastRow ? 'border-b-0' : ''}
                          ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}
                          ${isSelected ? 'bg-brand/8' : 'hover:bg-white/3'}
                          ${isPast ? 'opacity-50' : ''}
                        `}
                      >
                        <span
                          className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold shrink-0
                            ${isToday ? 'bg-brand text-text-primary' : ''}
                            ${!isToday && isSun ? 'text-danger/80' : ''}
                            ${!isToday && isSat ? 'text-info/80' : ''}
                            ${!isToday && !isSun && !isSat ? 'text-text-secondary' : ''}
                          `}
                        >
                          {day.date()}
                        </span>

                        {/* Desktop: event pills */}
                        <div className="hidden sm:flex flex-col gap-0.5 w-full">
                          {visibleEvents.map((e, idx) => (
                            <span
                              key={idx}
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded truncate w-full leading-tight ${COLOR[e.type].pill}`}
                              title={eventLabel(e)}
                            >
                              {eventPillLabel(e)}
                            </span>
                          ))}
                          {overflow > 0 && (
                            <span className="text-[9px] text-text-quaternary px-1">+{overflow}개</span>
                          )}
                        </div>

                        {/* Mobile: dots */}
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
          ) : (
            /* Weekly grid */
            <CalendarWeekView
              weekStart={weekStart}
              events={weekEvents}
              selectedDate={selectedDate}
              today={today}
              isLoading={weekLoading}
              onSelectDate={handleSelectDate}
            />
          )}

          {/* Legend */}
          <div className="flex items-center flex-wrap gap-x-5 gap-y-2">
            <div className="flex items-center gap-1.5 text-xs text-text-quaternary">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${COLOR.step.dot}`} />
              마감
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-quaternary">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${COLOR.note.dot}`} />
              일정·메모
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-quaternary">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${COLOR.exam.dot}`} />
              시험
            </div>
          </div>

          {/* Monthly view: no-events empty state */}
          {view === 'month' && !monthlyLoading && monthlyEvents.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-4xl">📅</span>
              <p className="text-text-tertiary text-sm">이번 달 일정이 없어요</p>
              <p className="text-text-quaternary text-xs leading-relaxed">
                보드에서 서류 마감일이나<br />면접 스텝에 날짜를 등록해보세요
              </p>
              <DemoLink to="/board" className="mt-1 text-xs font-medium text-brand hover:text-accent transition-colors">
                보드로 이동 →
              </DemoLink>
            </div>
          )}

          {/* Mobile: selected date event list (below calendar, lg:hidden) */}
          {!bottomSheetOpen && selectedDate && (
            <div className="lg:hidden space-y-2">
              <h2 className="text-sm font-semibold text-text-secondary">
                {(() => { const d = dayjs(selectedDate); return `${d.month() + 1}월 ${d.date()}일 (${DAY_LABELS[d.day()]})` })()}
              </h2>
              {selectedDateEvents.length === 0 ? (
                <button
                  onClick={() => setBottomSheetOpen(true)}
                  className="w-full text-text-quaternary text-sm py-5 text-center bg-surface-2 border border-white/5 rounded-xl hover:bg-white/3 transition-colors"
                >
                  이 날 일정이 없어요 · 탭해서 메모 추가
                </button>
              ) : (
                <>
                  {selectedDateEvents.map((e, idx) => (
                    <EventCard key={idx} event={e} />
                  ))}
                  <button
                    onClick={() => setBottomSheetOpen(true)}
                    className="w-full text-xs text-text-quaternary py-2 text-center hover:text-text-secondary transition-colors"
                  >
                    메모 보기 / 추가 →
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Desktop side panel */}
        <div className="hidden lg:flex w-64 xl:w-72 shrink-0 sticky top-20 bg-surface border border-white/8 rounded-xl overflow-hidden flex-col" style={{ height: 'calc(100vh - 96px)' }}>
          <CalendarDayPanel
            date={selectedDate}
            events={selectedDateEvents}
          />
        </div>
      </div>

      {/* Mobile bottom sheet backdrop */}
      {bottomSheetOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setBottomSheetOpen(false)}
        />
      )}

      {/* Mobile bottom sheet */}
      {bottomSheetOpen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-white/10 rounded-t-2xl flex flex-col animate-slideUp" style={{ height: '65vh' }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-8 h-1 bg-white/20 rounded-full" />
          </div>
          <CalendarDayPanel
            date={selectedDate}
            events={selectedDateEvents}
            onClose={() => setBottomSheetOpen(false)}
          />
        </div>
      )}

      <AddExamScheduleModal
        open={examModalOpen}
        onClose={() => setExamModalOpen(false)}
        defaultDate={selectedDate}
      />
    </div>
  )
}

function DemoLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  const isDemo = useDemoMode()
  return <Link to={isDemo ? '/demo' + to : to} className={className}>{children}</Link>
}

function EventCard({ event }: { event: CalendarEvent }) {
  const isDemo = useDemoMode()
  const c = COLOR[event.type]
  const rawTo = event.type === 'exam'
    ? '/myinfo#exam-schedules'
    : event.type === 'step' && event.stepId
      ? `/board/${event.applicationId}/steps/${event.stepId}`
      : event.type === 'note'
        ? null
        : `/board/${event.applicationId}`
  const to = rawTo ? (isDemo ? '/demo' + rawTo : rawTo) : null
  const title = event.type === 'note' ? (event.content ?? '') : (event.companyName ?? '')
  const subtitle =
    event.type === 'deadline' ? '마감'
    : event.type === 'exam' ? '시험 일정'
    : event.type === 'note' ? null
    : event.stepName
  const inner = (
    <>
      <span className="text-base shrink-0">{c.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors truncate">
          {title}
        </p>
        {(subtitle || event.time || event.location) && (
          <p className="text-xs text-text-quaternary mt-0.5">
            {subtitle}
            {event.time && <span className={subtitle ? 'ml-1.5' : ''}>{subtitle ? '· ' : ''}{event.time.slice(0, 5)}</span>}
            {event.location && <span className="ml-1.5">· {event.location}</span>}
          </p>
        )}
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${c.badge}`}>
        {c.label}
      </span>
    </>
  )
  if (to) {
    return (
      <Link to={to} className={`flex items-center gap-3 bg-surface-2 border rounded-xl px-4 py-3 hover:bg-white/4 transition-colors group ${c.border}`}>
        {inner}
      </Link>
    )
  }
  return (
    <div className={`flex items-center gap-3 bg-surface-2 border rounded-xl px-4 py-3 ${c.border}`}>
      {inner}
    </div>
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
