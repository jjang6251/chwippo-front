import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CalendarEvent } from '@/api/calendar'

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 00~23
const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']
const ROW_HEIGHT = 44 // px per hour row
const GRID_HEIGHT = 480 // visible scroll container height

interface Props {
  weekStart: dayjs.Dayjs
  events: CalendarEvent[]
  selectedDate: string
  today: string
  isLoading?: boolean
  onSelectDate: (date: string) => void
}

export function CalendarWeekView({ weekStart, events, selectedDate, today, isLoading, onSelectDate }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
  const scrollRef = useRef<HTMLDivElement>(null)
  const nowHour = dayjs().hour()
  const nowMinute = dayjs().minute()
  const todayInWeek = days.some((d) => d.format('YYYY-MM-DD') === today)

  // 현재 시각 위치 (px) - 분 단위 정밀도
  const nowPx = nowHour * ROW_HEIGHT + (nowMinute / 60) * ROW_HEIGHT

  const weekStartKey = weekStart.format('YYYY-MM-DD')
  useEffect(() => {
    if (!scrollRef.current) return
    const targetHour = todayInWeek ? nowHour : 8
    // 현재 시간이 컨테이너 상단 1/3 위치에 오도록
    const scrollTop = Math.max(0, targetHour * ROW_HEIGHT - GRID_HEIGHT / 3)
    scrollRef.current.scrollTop = scrollTop
    // 주가 바뀔 때만 재스크롤. nowHour/todayInWeek는 마운트 시 초기값으로 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartKey])

  // All-day row: hourSlot=null daily-notes (메모)
  const allDayByDate: Record<string, CalendarEvent[]> = {}
  // Time grid: step + exam + hourSlot 있는 note
  const timedByDateHour: Record<string, Record<number, CalendarEvent[]>> = {}

  for (const e of events) {
    if (e.type === 'note' && !e.time) {
      if (!allDayByDate[e.date]) allDayByDate[e.date] = []
      allDayByDate[e.date].push(e)
    } else if (e.time) {
      const [h] = e.time.split(':').map(Number)
      if (h >= 0 && h <= 23) {
        if (!timedByDateHour[e.date]) timedByDateHour[e.date] = {}
        if (!timedByDateHour[e.date][h]) timedByDateHour[e.date][h] = []
        timedByDateHour[e.date][h].push(e)
      }
    } else if (e.type === 'step' || e.type === 'exam') {
      // 시간 없는 step/exam → 08:00 행에 표시
      if (!timedByDateHour[e.date]) timedByDateHour[e.date] = {}
      if (!timedByDateHour[e.date][8]) timedByDateHour[e.date][8] = []
      timedByDateHour[e.date][8].push(e)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-surface-2 border border-line rounded-xl overflow-hidden animate-pulse">
        <div className="h-14 bg-card border-b border-line" />
        <div className="h-8 bg-card border-b border-line" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-11 border-b border-line bg-card" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
      {/* Day headers — 스크롤과 분리. pr-2로 아래 time grid의 scrollbar(8px) width 매칭 */}
      <div className="grid border-b border-line pr-2" style={{ gridTemplateColumns: '44px repeat(7, minmax(0, 1fr))' }}>
        <div className="border-r border-line" />
        {days.map((day) => {
          const dateStr = day.format('YYYY-MM-DD')
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === today
          const isSun = day.day() === 0
          const isSat = day.day() === 6
          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`py-2 text-center transition-colors hover:bg-card active:bg-card-strong border-r border-line last:border-r-0 ${isSelected ? 'bg-brand/8' : ''}`}
            >
              <div className={`text-[10px] font-medium ${isSun ? 'text-danger/70' : isSat ? 'text-info/70' : 'text-text-quaternary'}`}>
                {KO_DAYS[day.day()]}
              </div>
              <div className={`mt-0.5 w-6 h-6 flex items-center justify-center rounded-full mx-auto text-xs font-semibold transition-colors ${
                isToday ? 'bg-brand text-text-primary' : isSelected ? 'text-brand' : isSun ? 'text-danger/80' : isSat ? 'text-info/80' : 'text-text-secondary'
              }`}>
                {day.date()}
              </div>
            </button>
          )
        })}
      </div>

      {/* Time grid — 내부 스크롤 (h-[480px] 고정 높이). 종일 row를 안에 sticky로 두어 스크롤바 width 동기화 */}
      <div ref={scrollRef} className="overflow-y-scroll relative" style={{ height: `${GRID_HEIGHT}px`, scrollbarGutter: 'stable' }}>
        {/* All-day row (마감 + 시간 없는 메모) — sticky로 상단 고정 */}
        <div className="sticky top-0 z-20 grid border-b border-line min-h-[28px] bg-surface-2" style={{ gridTemplateColumns: '44px repeat(7, minmax(0, 1fr))' }}>
          <div className="flex items-center justify-end px-1 border-r border-line">
            <span className="text-[8px] text-text-quaternary font-medium">종일</span>
          </div>
          {days.map((day) => {
            const dateStr = day.format('YYYY-MM-DD')
            const allDay = allDayByDate[dateStr] ?? []
            const isSelected = dateStr === selectedDate
            return (
              <div
                key={dateStr}
                className={`min-w-0 overflow-hidden px-0.5 py-0.5 border-r border-line last:border-r-0 min-h-[28px] ${isSelected ? 'bg-brand/5' : ''}`}
              >
                {allDay.map((e, idx) => (
                  <div
                    key={idx}
                    className="block text-[9px] font-medium px-1 py-0.5 rounded bg-info/15 text-info truncate mb-0.5"
                    title={e.content ?? ''}
                  >
                    {e.content}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* 현재 시각 표시선 (오늘이 이번 주에 있을 때만) */}
        {todayInWeek && (
          <div
            className="absolute left-[44px] right-0 z-10 pointer-events-none flex items-center"
            style={{ top: `${nowPx}px` }}
          >
            <div className="w-2 h-2 rounded-full bg-danger shrink-0 -ml-1" />
            <div className="flex-1 h-px bg-danger/60" />
          </div>
        )}

        {HOURS.map((hour) => {
          const isCurrentHour = todayInWeek && hour === nowHour
          return (
            <div
              key={hour}
              className="grid border-b border-line last:border-b-0"
              style={{ gridTemplateColumns: '44px repeat(7, minmax(0, 1fr))', minHeight: `${ROW_HEIGHT}px` }}
            >
              {/* Hour label */}
              <div className="flex items-start justify-end px-1.5 pt-1 border-r border-line shrink-0">
                <span className={`text-[9px] font-mono select-none ${isCurrentHour ? 'text-danger font-semibold' : 'text-text-quaternary'}`}>
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              {/* Day cells */}
              {days.map((day) => {
                const dateStr = day.format('YYYY-MM-DD')
                const hourEvents = timedByDateHour[dateStr]?.[hour] ?? []
                const isSelected = dateStr === selectedDate
                const isTodayCell = dateStr === today && isCurrentHour
                return (
                  <div
                    key={dateStr}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectDate(dateStr)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectDate(dateStr)}
                    className={`min-w-0 overflow-hidden cursor-pointer border-r border-line last:border-r-0 px-0.5 py-0.5 transition-colors hover:bg-card active:bg-card-strong ${
                      isTodayCell ? 'bg-danger/5' : isSelected ? 'bg-brand/5' : ''
                    }`}
                  >
                    {hourEvents.map((e, idx) => {
                      if (e.type === 'exam') {
                        return (
                          <Link
                            key={idx}
                            to="/myinfo#exam-schedules"
                            onClick={(ev) => ev.stopPropagation()}
                            className="block text-[9px] font-medium px-1 py-0.5 rounded-sm bg-violet/15 text-violet border-l border-violet truncate mb-0.5 hover:bg-violet/20 transition-colors"
                            title={e.companyName ?? ''}
                          >
                            {e.companyName}
                          </Link>
                        )
                      }
                      if (e.type === 'note') {
                        return (
                          <div
                            key={idx}
                            onClick={(ev) => ev.stopPropagation()}
                            className="block text-[9px] font-medium px-1 py-0.5 rounded-sm bg-info/15 text-info border-l border-info truncate mb-0.5"
                            title={e.content ?? ''}
                          >
                            {e.content}
                          </div>
                        )
                      }
                      // step
                      return (
                        <Link
                          key={idx}
                          to={e.stepId ? `/board/${e.applicationId}/steps/${e.stepId}` : `/board/${e.applicationId}`}
                          onClick={(ev) => ev.stopPropagation()}
                          className="block text-[9px] font-medium px-1 py-0.5 rounded-sm bg-warning/15 text-warning border-l border-warning truncate mb-0.5 hover:bg-warning/20 transition-colors"
                          title={`${e.companyName} ${e.stepName ?? ''}`.trim()}
                        >
                          {e.companyName}
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
