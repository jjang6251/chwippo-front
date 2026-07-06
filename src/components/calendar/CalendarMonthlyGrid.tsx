import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { CalendarEvent } from '@/api/calendar'
import { detectScheduleConflicts } from '@/utils/scheduleConflict'

/**
 * 캘린더 UX 재구성 — 월별 뷰 그리드 (탭 활성 시).
 *
 * Apple Stacked 셀 (종일 pill + 시간 이벤트 도트).
 * 이번 주 하이라이트 배경.
 * 셀 클릭 → 부모에 date 알림 (사이드 상세 갱신).
 */
interface Props {
  events: CalendarEvent[]
  selectedDate?: string
  onSelectDate?: (date: string) => void
  onToday?: () => void
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface EventPresentation {
  pill?: { label: string; className: string }
  dots: { className: string; label: string }[]
  overflow: number
}

function presentDayEvents(events: CalendarEvent[]): EventPresentation {
  let pill: EventPresentation['pill']
  const dots: EventPresentation['dots'] = []

  for (const e of events) {
    // 종일 = time null 인 step (마감) → warning pill
    if (e.type === 'step' && !e.time && !pill) {
      pill = {
        label: `${e.companyName ?? ''} · 23:59`,
        className: 'bg-warning/15 border-warning/30 text-warning',
      }
      continue
    }
    // 도트 색
    let dotClass = 'bg-line-strong'
    if (e.type === 'exam') dotClass = 'bg-violet'
    else if (e.type === 'note') dotClass = 'bg-info'
    else if (e.type === 'step') {
      const name = e.stepName ?? ''
      if (/서류|공채|자소서|지원/.test(name)) dotClass = 'bg-warning'
      else if (/면접/.test(name)) dotClass = 'bg-brand'
    }
    if (dots.length < 3) {
      dots.push({
        className: dotClass,
        label: e.stepName ?? e.companyName ?? '',
      })
    }
  }

  const overflow = events.length - (pill ? 1 : 0) - dots.length
  return { pill, dots, overflow: overflow > 0 ? overflow : 0 }
}

export function CalendarMonthlyGrid({ events, selectedDate, onSelectDate, onToday }: Props) {
  const today = dayjs().startOf('day')
  const todayStr = today.format('YYYY-MM-DD')
  const [cursor, setCursor] = useState(today.startOf('month'))

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

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [events])

  // A4 — 일정 충돌 (시간 있는 step·exam 이 같은 날 2개+)
  const conflicts = useMemo(() => detectScheduleConflicts(events), [events])

  const counts = useMemo(() => {
    let deadline = 0
    let interview = 0
    let exam = 0
    for (const e of events) {
      if (e.type === 'exam') exam++
      else if (e.type === 'step') {
        const name = e.stepName ?? ''
        if (/서류|공채|자소서|지원/.test(name)) deadline++
        else if (/면접/.test(name)) interview++
      }
    }
    return { total: events.length, deadline, interview, exam }
  }, [events])

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <button
            aria-label="이전"
            onClick={() => setCursor((c) => c.subtract(1, 'month'))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-text-tertiary hover:text-text-secondary"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-text-primary tracking-tight px-2">
            {cursor.year()}년 {cursor.month() + 1}월
          </h2>
          <button
            aria-label="다음"
            onClick={() => setCursor((c) => c.add(1, 'month'))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-text-tertiary hover:text-text-secondary"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 4l4 4-4 4" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
            <span>
              이번 달 <span className="text-text-secondary font-semibold tabular-nums">{counts.total}</span>
            </span>
            <span className="text-text-quaternary">·</span>
            <span className="text-warning">
              마감 <span className="tabular-nums font-semibold">{counts.deadline}</span>
            </span>
            <span className="text-text-quaternary">·</span>
            <span className="text-brand">
              면접 <span className="tabular-nums font-semibold">{counts.interview}</span>
            </span>
            <span className="text-text-quaternary">·</span>
            <span className="text-violet">
              시험 <span className="tabular-nums font-semibold">{counts.exam}</span>
            </span>
          </div>
          {onToday && (
            <button
              onClick={() => {
                setCursor(today.startOf('month'))
                onToday()
              }}
              className="h-8 px-3 rounded-lg border border-line bg-surface text-text-secondary text-[11px] font-medium hover:border-line-strong"
            >
              오늘
            </button>
          )}
        </div>
      </div>

      {/* Grid — 원래 캘린더 색감·디자인 (bg-surface-2 · border-b/border-r · 오늘=원형 배지 · 선택=bg-brand/8) */}
      <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`py-2.5 text-center text-xs font-medium ${
                i === 0
                  ? 'text-danger/70'
                  : i === 6
                    ? 'text-info/70'
                    : 'text-text-quaternary'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isLastRow = i >= cells.length - 7
            const isLastCol = (i + 1) % 7 === 0

            if (!day) {
              return (
                <div
                  key={`empty-${i}`}
                  className={`min-h-[64px] sm:min-h-[80px] border-line ${!isLastRow ? 'border-b' : ''} ${!isLastCol ? 'border-r' : ''}`}
                />
              )
            }
            const dateStr = day.format('YYYY-MM-DD')
            const dayEvents = eventsByDate.get(dateStr) ?? []
            const presentation = presentDayEvents(dayEvents)

            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const isPast = dateStr < todayStr
            const isSun = day.day() === 0
            const isSat = day.day() === 6

            // 날짜 원형 배지 — 오늘만 브랜드 fill, 나머지는 색상만
            const dateBadge = isToday
              ? 'bg-brand text-text-primary'
              : isSun
                ? 'text-danger/80'
                : isSat
                  ? 'text-info/80'
                  : 'text-text-secondary'

            const cellBg = isSelected
              ? 'bg-brand/8'
              : 'hover:bg-card active:bg-card-strong'

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate?.(dateStr)}
                className={`min-h-[64px] sm:min-h-[80px] flex flex-col items-start p-1.5 gap-1 border-line transition-colors text-left w-full ${!isLastRow ? 'border-b' : ''} ${!isLastCol ? 'border-r' : ''} ${cellBg} ${isPast && !isToday ? 'opacity-50' : ''}`}
              >
                <span className="flex items-center gap-0.5">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold shrink-0 ${dateBadge}`}
                  >
                    {day.date()}
                  </span>
                  {conflicts.has(dateStr) && (
                    <span
                      className={`text-[10px] leading-none ${conflicts.get(dateStr)!.level === 'overlap' ? 'text-danger' : 'text-warning'}`}
                      title={conflicts.get(dateStr)!.level === 'overlap' ? '일정이 겹쳐요 — 시간 확인 필요' : '같은 날 시간 일정 2개 이상'}
                      aria-label="일정 충돌 주의"
                    >
                      ⚠️
                    </span>
                  )}
                </span>
                {presentation.pill && (
                  <span
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded border block w-full text-left truncate leading-tight ${presentation.pill.className}`}
                    title={presentation.pill.label}
                  >
                    {presentation.pill.label}
                  </span>
                )}
                {presentation.dots.map((dot, j) => (
                  <div key={j} className="flex items-center gap-1 text-[9px] text-text-secondary w-full">
                    <span className={`inline-block w-1 h-1 rounded-full shrink-0 ${dot.className}`} />
                    <span className="truncate">{dot.label}</span>
                  </div>
                ))}
                {presentation.overflow > 0 && (
                  <span className="text-[9px] text-text-quaternary">+{presentation.overflow}개</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-[10px] text-text-quaternary">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />서류 마감</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />면접</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet inline-block" />시험</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-info inline-block" />메모</span>
      </div>
    </div>
  )
}
