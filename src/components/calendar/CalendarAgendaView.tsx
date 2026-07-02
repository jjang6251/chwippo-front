import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { CalendarEvent } from '@/api/calendar'
import { AgendaEventCard } from './AgendaEventCard'
import { AgendaDateHeader } from './AgendaDateHeader'

/**
 * 캘린더 UX 재구성 — 세로 아젠다 뷰.
 *
 * 이벤트를 3그룹으로 분할:
 *   1. 이번 주 (오늘부터 이번 주 일요일까지 — 주 시작은 월요일)
 *   2. 다음 주 (다음 월요일부터 그 주 일요일까지)
 *   3. 그 이후 (다음 다음 주 이후)
 *
 * 각 그룹에 timeline rail + 날짜별 소그룹 표시.
 * 지난 날짜는 상단에서 collapsed (필요 시 확장 · 이번 iteration 은 그냥 hide).
 * 즐겨찾기 필터 활성 시 step 이벤트 중 isStarred=true 만 표시 (exam·note pass-through).
 */
interface Props {
  events: CalendarEvent[]
  starOnly?: boolean
  onAddOnDate?: (date: string) => void
}

/** 주 시작 (월요일 00:00) 계산 · 한국 KST 기준 */
function weekStartMonday(d: dayjs.Dayjs): dayjs.Dayjs {
  const day = d.day() // 0=일 ... 6=토
  const daysFromMonday = day === 0 ? 6 : day - 1
  return d.subtract(daysFromMonday, 'day').startOf('day')
}

interface DateGroup {
  date: string
  events: CalendarEvent[]
  isToday: boolean
}

interface WeekGroup {
  key: 'this' | 'next' | 'later'
  label: string
  rangeHint?: string
  dates: DateGroup[]
}

export function CalendarAgendaView({ events, starOnly = false, onAddOnDate }: Props) {
  const today = dayjs().startOf('day')
  const todayStr = today.format('YYYY-MM-DD')
  const thisWeekStart = weekStartMonday(today)
  const thisWeekEnd = thisWeekStart.add(6, 'day')
  const nextWeekStart = thisWeekStart.add(7, 'day')
  const nextWeekEnd = nextWeekStart.add(6, 'day')
  const [showPast, setShowPast] = useState(false)

  // 지난 일정 (오늘 미포함 · 이번 달 및 다음 달 범위 내)
  const pastDates = useMemo<DateGroup[]>(() => {
    const filtered = events.filter((e) => {
      if (!starOnly) return true
      if (e.type !== 'step') return true
      return e.isStarred === true
    })
    const byDate = new Map<string, CalendarEvent[]>()
    for (const e of filtered) {
      if (e.date >= todayStr) continue
      const arr = byDate.get(e.date) ?? []
      arr.push(e)
      byDate.set(e.date, arr)
    }
    return Array.from(byDate.keys())
      .sort((a, b) => b.localeCompare(a)) // 최근 지난 것부터
      .map((date) => ({ date, events: byDate.get(date)!, isToday: false }))
  }, [events, starOnly, todayStr])

  const groups = useMemo<WeekGroup[]>(() => {
    // 필터
    const filtered = events.filter((e) => {
      if (!starOnly) return true
      // step 만 필터 · exam/note pass-through
      if (e.type !== 'step') return true
      return e.isStarred === true
    })

    // 오늘 이후만 남기고 날짜별 그룹
    const byDate = new Map<string, CalendarEvent[]>()
    for (const e of filtered) {
      if (e.date < todayStr) continue
      const arr = byDate.get(e.date) ?? []
      arr.push(e)
      byDate.set(e.date, arr)
    }

    // 날짜 오름차순 정렬
    const sortedDates = Array.from(byDate.keys()).sort()

    const thisWeekDates: DateGroup[] = []
    const nextWeekDates: DateGroup[] = []
    const laterDates: DateGroup[] = []

    for (const date of sortedDates) {
      const d = dayjs(date)
      const grp: DateGroup = {
        date,
        events: byDate.get(date)!,
        isToday: date === todayStr,
      }
      if (!d.isBefore(thisWeekStart) && !d.isAfter(thisWeekEnd)) {
        thisWeekDates.push(grp)
      } else if (!d.isBefore(nextWeekStart) && !d.isAfter(nextWeekEnd)) {
        nextWeekDates.push(grp)
      } else {
        laterDates.push(grp)
      }
    }

    // 이번 주 그룹에 오늘 날짜가 없으면 (오늘 이벤트 없음) 빈 오늘 헤더 추가
    if (!thisWeekDates.some((g) => g.date === todayStr)) {
      thisWeekDates.unshift({ date: todayStr, events: [], isToday: true })
    }

    const fmtRange = (start: dayjs.Dayjs, end: dayjs.Dayjs) =>
      `${start.month() + 1}/${start.date()} – ${end.month() + 1}/${end.date()}`

    return [
      {
        key: 'this',
        label: '이번 주',
        rangeHint: fmtRange(thisWeekStart, thisWeekEnd),
        dates: thisWeekDates,
      },
      {
        key: 'next',
        label: '다음 주',
        rangeHint: fmtRange(nextWeekStart, nextWeekEnd),
        dates: nextWeekDates,
      },
      { key: 'later', label: '그 이후', dates: laterDates },
    ]
  }, [events, starOnly, todayStr, thisWeekStart, thisWeekEnd, nextWeekStart, nextWeekEnd])

  const hasAny = groups.some((g) => g.dates.length > 0)
  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-line bg-surface/50 p-8 text-center">
        <p className="text-xs text-text-tertiary mb-1">다가오는 일정이 없어요</p>
        <p className="text-[11px] text-text-quaternary">
          지원카드나 시험 일정을 등록하면 여기에 표시돼요.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* 지난 일정 토글 (최상단) */}
      {pastDates.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <span>{showPast ? '지난 일정 접기' : `지난 일정 보기 (${pastDates.length}일)`}</span>
            <span className="opacity-60">{showPast ? '↓' : '↑'}</span>
          </button>
          {showPast && (
            <div className="mt-3 relative pl-6 opacity-70">
              <div
                className="absolute left-[6px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent to-line-strong"
                aria-hidden="true"
              />
              <div className="space-y-4">
                {pastDates.map((dg) => (
                  <div key={dg.date} className="relative">
                    <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-line-strong ring-2 ring-bg" />
                    <AgendaDateHeader date={dg.date} isToday={false} />
                    <div className="space-y-2">
                      {dg.events.map((e) => (
                        <AgendaEventCard key={eventKey(e)} event={e} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {groups.map((group) => {
        if (group.dates.length === 0) return null
        const isThis = group.key === 'this'
        return (
          <div key={group.key} className="mb-7 last:mb-0">
            <div className="flex items-center gap-2 mb-3 pl-6">
              <span
                className={`text-[10px] font-semibold ${
                  isThis ? 'text-brand' : 'text-text-tertiary'
                }`}
              >
                {group.label}
              </span>
              <span
                className={`h-px flex-1 ${
                  isThis ? 'bg-brand/20' : 'bg-line-strong'
                }`}
              />
              {group.rangeHint && (
                <span className="text-[10px] text-text-quaternary tabular-nums">
                  {group.rangeHint}
                </span>
              )}
            </div>

            <div className="relative pl-6">
              <div
                className="absolute left-[6px] top-0 bottom-0 w-px bg-gradient-to-b from-line-strong to-transparent"
                aria-hidden="true"
              />

              <div className="space-y-6">
                {group.dates.map((dg) => (
                  <div key={dg.date} className="relative">
                    <span
                      className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-2 ring-bg ${dotColorForGroup(
                        dg,
                      )}`}
                    />
                    <AgendaDateHeader
                      date={dg.date}
                      isToday={dg.isToday}
                      onAdd={onAddOnDate ? () => onAddOnDate(dg.date) : undefined}
                    />
                    {dg.events.length === 0 ? (
                      <p className="text-[11px] text-text-quaternary pl-1">
                        오늘 등록된 일정이 없어요
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dg.events.map((e) => (
                          <AgendaEventCard key={eventKey(e)} event={e} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * timeline rail 도트 색 = 첫 이벤트 종류 색.
 * - 오늘 = brand
 * - 이벤트 종류: 서류 마감(warning) / 면접(brand) / 시험(violet) / 메모(info)
 * - 빈 날짜 = line-strong
 */
function dotColorForGroup(dg: DateGroup): string {
  if (dg.isToday) return 'bg-brand'
  if (dg.events.length === 0) return 'bg-line-strong'
  const first = dg.events[0]
  switch (first.type) {
    case 'exam':
      return 'bg-violet'
    case 'note':
      return 'bg-info'
    case 'step': {
      const name = first.stepName ?? ''
      if (/서류|공채|자소서|지원/.test(name)) return 'bg-warning'
      if (/면접/.test(name)) return 'bg-brand/70'
      return 'bg-line-strong'
    }
    default:
      return 'bg-line-strong'
  }
}

function eventKey(e: CalendarEvent): string {
  return (
    e.type +
    ':' +
    (e.stepId ?? e.examId ?? e.noteId ?? `${e.date}:${e.time ?? ''}`)
  )
}
