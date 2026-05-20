import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useCalendarEvents } from '@/hooks/useCalendar'
import { CalendarDayPanel } from '@/components/calendar/CalendarDayPanel'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarMiniSection() {
  const navigate = useDemoNavigate()
  const today = dayjs().format('YYYY-MM-DD')

  const [cursor, setCursor] = useState(dayjs().startOf('month'))
  const [selectedDate, setSelectedDate] = useState<string>(today)

  const year = cursor.year()
  const month = cursor.month() + 1

  const { data: events = [], isLoading } = useCalendarEvents(year, month)

  const eventDates = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e) => set.add(e.date))
    return set
  }, [events])

  const dayEvents = useMemo(
    () => events.filter((e) => e.date === selectedDate),
    [events, selectedDate],
  )

  const cells = useMemo(() => {
    const startDay = cursor.day()
    const daysInMonth = cursor.daysInMonth()
    const list: { date: string | null; day: number | null }[] = []
    for (let i = 0; i < startDay; i++) list.push({ date: null, day: null })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = cursor.date(d).format('YYYY-MM-DD')
      list.push({ date, day: d })
    }
    while (list.length % 7 !== 0) list.push({ date: null, day: null })
    return list
  }, [cursor])

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-text-primary text-base font-semibold">🗓️ 미니 캘린더</h2>
        <button
          onClick={() => navigate('/calendar')}
          className="text-[11px] text-text-quaternary hover:text-text-tertiary transition-colors"
        >
          전체 →
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {/* 좌측: 미니 캘린더 그리드 */}
        <div className="md:w-3/5 bg-surface-2 border border-line rounded-lg p-3">
          {/* 월 헤더 + 이동 버튼 */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setCursor((c) => c.subtract(1, 'month'))}
              aria-label="이전 달"
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M6.5 1.5L3 5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="text-text-primary text-xs font-semibold tabular-nums">
              {year}년 {month}월
            </p>
            <button
              onClick={() => setCursor((c) => c.add(1, 'month'))}
              aria-label="다음 달"
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3.5 1.5L7 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[10px] font-medium ${
                  i === 0 ? 'text-danger/70' : i === 6 ? 'text-brand/70' : 'text-text-quaternary'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell.date || !cell.day) {
                return <div key={`empty-${idx}`} className="aspect-square" />
              }
              const isToday = cell.date === today
              const isSelected = cell.date === selectedDate
              const hasEvent = eventDates.has(cell.date)
              const dow = idx % 7

              return (
                <button
                  key={cell.date}
                  onClick={() => setSelectedDate(cell.date!)}
                  disabled={isLoading}
                  aria-label={`${month}월 ${cell.day}일${hasEvent ? ', 일정 있음' : ''}${isToday ? ', 오늘' : ''}`}
                  aria-pressed={isSelected}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center rounded-md text-[11px] transition-colors
                    ${isSelected && !isToday ? 'bg-card-strong text-text-primary font-semibold' : ''}
                    ${isToday ? 'bg-brand text-text-primary font-semibold' : ''}
                    ${!isSelected && !isToday ? 'hover:bg-card' : ''}
                    ${!isToday && !isSelected && dow === 0 ? 'text-danger/80' : ''}
                    ${!isToday && !isSelected && dow === 6 ? 'text-brand/80' : ''}
                    ${!isToday && !isSelected && dow !== 0 && dow !== 6 ? 'text-text-secondary' : ''}
                  `}
                >
                  <span>{cell.day}</span>
                  {hasEvent && !isToday && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-brand" />
                  )}
                  {hasEvent && isToday && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-text-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 우측: 선택 날짜 패널 (CalendarDayPanel 재사용) */}
        <div className="md:w-2/5 h-[360px] md:h-[420px] overflow-hidden rounded-lg border border-line bg-surface-2">
          <CalendarDayPanel date={selectedDate} events={dayEvents} />
        </div>
      </div>
    </section>
  )
}
