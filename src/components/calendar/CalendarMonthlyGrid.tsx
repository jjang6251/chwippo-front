import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import type { CalendarEvent } from '@/api/calendar'
import { useDemoLink } from '@/hooks/useDemoLink'
import { detectScheduleConflicts } from '@/utils/scheduleConflict'
import { getHolidayName } from '@/utils/holidays'
import { todayLocal } from '@/utils/datetime'

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
  /** U10+ — T 단축키 피드백: >0 이면 오늘 배지 펄스 (리마운트로 재생) */
  todayPulse?: number
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface EventPresentation {
  /** 첫 종일 마감 → pill. extra = 같은 날 추가 종일 마감 수 ("+N" 뱃지) · event = U7 스텝 딥링크 소스 */
  pill?: { label: string; className: string; extra: number; event: CalendarEvent }
  dots: { className: string; label: string }[]
  overflow: number
}

function presentDayEvents(events: CalendarEvent[]): EventPresentation {
  let pill: { label: string; className: string; event: CalendarEvent } | undefined
  let pillExtra = 0
  const dots: EventPresentation['dots'] = []
  let hiddenDots = 0

  for (const e of events) {
    // 종일 = time null 인 step (마감) → 첫 건은 pill, 추가 건은 "+N" 뱃지로 합류
    if (e.type === 'step' && !e.time) {
      if (!pill) {
        pill = {
          // U22/M8 — pill 은 회사명만 (마감 색이 유형을 표시 · 23:59 는 상세에서)
          label: e.companyName ?? '',
          className: 'bg-warning/15 border-warning/30 text-warning',
          event: e,
        }
      } else {
        pillExtra++
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
    } else {
      hiddenDots++
    }
  }

  return {
    pill: pill ? { ...pill, extra: pillExtra } : undefined,
    dots,
    overflow: hiddenDots,
  }
}

export function CalendarMonthlyGrid({ events, selectedDate, onSelectDate, onToday, todayPulse = 0 }: Props) {
  // U4 — 로컬 TZ 의존 제거: '오늘'·초기 월 커서는 KST 기준 (date-only)
  const todayStr = todayLocal()
  const today = dayjs(todayStr)
  const [cursor, setCursor] = useState(today.startOf('month'))
  const demoLink = useDemoLink()

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
      {/* Month nav — M4: 나브 행 + 축약 카운트 행 2단 (320px 무넘침) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <button
              aria-label="이전 달"
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
              aria-label="다음 달"
              onClick={() => setCursor((c) => c.add(1, 'month'))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-text-tertiary hover:text-text-secondary"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
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
        {/* 축약 카운트 요약 — "마감 3 · 면접 2 · 시험 1" (목업 A안) */}
        {counts.total > 0 && (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] tabular-nums">
            <span className="text-warning font-semibold">
              마감 {counts.deadline}
            </span>
            <span className="text-text-quaternary">·</span>
            <span className="text-brand font-semibold">
              면접 {counts.interview}
            </span>
            <span className="text-text-quaternary">·</span>
            <span className="text-violet font-semibold">
              시험 {counts.exam}
            </span>
          </div>
        )}
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
            // A6 — 공휴일은 일요일과 같은 빨간 톤 + 이름 라벨
            const holidayName = getHolidayName(dateStr)

            // 날짜 원형 배지 — 오늘만 브랜드 fill, 나머지는 색상만
            const dateBadge = isToday
              ? 'bg-brand text-bg'
              : isSun || holidayName
                ? 'text-danger/80'
                : isSat
                  ? 'text-info/80'
                  : 'text-text-secondary'

            const cellBg = isSelected
              ? 'bg-brand/8'
              : 'hover:bg-card active:bg-card-strong'

            return (
              // U9 — 셀은 div role=button (셀 안 "+N개" 를 중첩 button 없이 렌더하기 위함)
              <div
                key={dateStr}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDate?.(dateStr)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectDate?.(dateStr)
                  }
                }}
                className={`min-h-[64px] sm:min-h-[80px] overflow-hidden flex flex-col items-start p-1.5 gap-1 border-line transition-colors text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60 ${!isLastRow ? 'border-b' : ''} ${!isLastCol ? 'border-r' : ''} ${cellBg} ${isPast && !isToday ? 'opacity-50' : ''}`}
              >
                {/* M5 — 상단 배지+⚠️+공휴일명 clip (min-w-0 + 인접 셀 침범 차단) */}
                <span className="flex items-center gap-0.5 w-full min-w-0">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold shrink-0 ${dateBadge} ${presentation.pill && !isToday ? 'ring-1 ring-warning/50' : ''} ${isToday && todayPulse > 0 ? 'animate-today-pulse' : ''}`}
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
                  {holidayName && (
                    <span className="text-[9px] text-danger/70 font-medium truncate min-w-0 flex-1 leading-tight" title={holidayName}>
                      {holidayName}
                    </span>
                  )}
                </span>
                {presentation.pill && (() => {
                  // U7 — pill 회사명 클릭 → 첫 마감 스텝 딥링크. "+N" 뱃지는 셀로 버블 = 기존 날짜 선택 동작 유지.
                  const pillEvent = presentation.pill.event
                  const rawPillTo =
                    pillEvent.stepId && pillEvent.applicationId
                      ? `/board/${pillEvent.applicationId}/steps/${pillEvent.stepId}`
                      : pillEvent.applicationId
                        ? `/board/${pillEvent.applicationId}`
                        : null
                  const pillTo = rawPillTo ? demoLink(rawPillTo) : null
                  return (
                    // M8/U22 — pill 11px + 회사명 truncate + 같은 날 마감 2건+ "+N" 뱃지
                    <span
                      className={`flex items-center gap-1 w-full px-1.5 py-0.5 rounded border leading-tight ${presentation.pill.className}`}
                      title={presentation.pill.label}
                    >
                      {pillTo ? (
                        <Link
                          to={pillTo}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-0 flex-1 truncate text-left text-[11px] font-medium rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                        >
                          {presentation.pill.label}
                        </Link>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-left text-[11px] font-medium">
                          {presentation.pill.label}
                        </span>
                      )}
                      {presentation.pill.extra > 0 && (
                        <span className="shrink-0 rounded bg-warning/15 px-1 text-[10px] font-bold tabular-nums leading-tight">
                          +{presentation.pill.extra}
                        </span>
                      )}
                    </span>
                  )
                })()}
                {presentation.dots.map((dot, j) => (
                  <div key={j} className="flex items-center gap-1 text-[11px] text-text-secondary w-full min-w-0">
                    <span className={`inline-block w-1 h-1 rounded-full shrink-0 ${dot.className}`} />
                    <span className="truncate min-w-0">{dot.label}</span>
                  </div>
                ))}
                {presentation.overflow > 0 && (
                  <button
                    type="button"
                    aria-label={`이벤트 ${presentation.overflow}개 더 보기`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectDate?.(dateStr)
                    }}
                    className="text-[11px] text-text-quaternary hover:text-text-secondary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                  >
                    +{presentation.overflow}개
                  </button>
                )}
              </div>
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
