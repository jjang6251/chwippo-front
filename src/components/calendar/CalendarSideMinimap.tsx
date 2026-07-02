import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { CalendarEvent } from '@/api/calendar'

/**
 * 캘린더 UX 재구성 — 사이드 미니 월맵 (B안).
 *
 * 320px 폭 사이드 상단에 노출. 아젠다 뷰의 부감 역할.
 * 이벤트가 있는 날짜에 도트 표시 (첫 이벤트 종류 색).
 * 셀 클릭 → 부모에게 date 알림.
 */
interface Props {
  events: CalendarEvent[]
  selectedDate?: string
  onSelectDate?: (date: string) => void
  onToday?: () => void
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function getWeekStartMonday(date: dayjs.Dayjs): dayjs.Dayjs {
  const day = date.day()
  const daysFromMonday = day === 0 ? 6 : day - 1
  return date.subtract(daysFromMonday, 'day').startOf('day')
}

function dotForFirstEvent(events: CalendarEvent[]): string | null {
  if (events.length === 0) return null
  const first = events[0]
  switch (first.type) {
    case 'exam':
      return 'bg-violet'
    case 'note':
      return 'bg-info'
    case 'step': {
      const name = first.stepName ?? ''
      if (/서류|공채|자소서|지원/.test(name)) return 'bg-warning'
      if (/면접/.test(name)) return 'bg-brand'
      return 'bg-line-strong'
    }
  }
  return null
}

export function CalendarSideMinimap({ events, selectedDate, onSelectDate, onToday }: Props) {
  const today = dayjs().startOf('day')
  const todayStr = today.format('YYYY-MM-DD')
  const [cursor, setCursor] = useState(today.startOf('month'))

  const cells = useMemo(() => {
    const firstDay = cursor.day() // 0=일
    const daysInMonth = cursor.daysInMonth()
    const result: (dayjs.Dayjs | null)[] = [
      ...Array<null>(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => cursor.add(i, 'day')),
    ]
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [cursor])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [events])

  const thisWeekStart = useMemo(() => getWeekStartMonday(today), [today])
  const thisWeekEnd = useMemo(() => thisWeekStart.add(6, 'day'), [thisWeekStart])

  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-line flex items-center justify-between">
        <span className="text-xs font-bold text-text-primary tracking-tight">
          {cursor.year()}년 {cursor.month() + 1}월
        </span>
        <div className="flex items-center gap-0.5">
          <button
            aria-label="이전 달"
            onClick={() => setCursor((c) => c.subtract(1, 'month'))}
            className="w-6 h-6 flex items-center justify-center rounded text-text-quaternary hover:text-text-secondary"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>
          <button
            aria-label="다음 달"
            onClick={() => setCursor((c) => c.add(1, 'month'))}
            className="w-6 h-6 flex items-center justify-center rounded text-text-quaternary hover:text-text-secondary"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-2.5">
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`h-5 flex items-center justify-center text-[9px] font-medium ${
                i === 0
                  ? 'text-danger/60'
                  : i === 6
                    ? 'text-info/60'
                    : 'text-text-quaternary'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="h-8" />
            }
            const dateStr = day.format('YYYY-MM-DD')
            const dayEvents = eventsByDate.get(dateStr) ?? []
            const dot = dotForFirstEvent(dayEvents)
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const isSun = day.day() === 0
            const isSat = day.day() === 6
            const isThisWeek =
              !day.isBefore(thisWeekStart) && !day.isAfter(thisWeekEnd)

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate?.(dateStr)}
                className={`h-8 flex flex-col items-center justify-center rounded ${
                  isSelected
                    ? 'bg-accent/10 ring-1 ring-accent/40'
                    : isToday
                      ? 'bg-brand/15 border border-brand/40'
                      : isThisWeek
                        ? 'bg-brand/[0.03]'
                        : 'hover:bg-surface-2'
                }`}
              >
                <span
                  className={`text-[10px] tabular-nums ${
                    isToday
                      ? 'font-bold text-brand'
                      : isSelected
                        ? 'font-semibold text-accent'
                        : isSun
                          ? 'text-danger/70'
                          : isSat
                            ? 'text-info/70'
                            : 'text-text-tertiary'
                  }`}
                >
                  {day.date()}
                </span>
                {dot && (
                  <span className="mt-0.5 flex gap-[2px]">
                    <span className={`inline-block w-1 h-1 rounded-full ${dot}`} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-3 pb-2.5 flex items-center justify-between text-[10px] text-text-quaternary">
        <span>이번 달 {events.length}건</span>
        {onToday && (
          <button
            onClick={onToday}
            className="hover:text-text-tertiary"
          >
            오늘
          </button>
        )}
      </div>
    </div>
  )
}
