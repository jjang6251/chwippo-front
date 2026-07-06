import type { CalendarEvent } from '@/api/calendar'

/**
 * A4 — 일정 충돌 감지.
 *
 * 판정 대상: 시간이 지정된 step·exam 이벤트만 (CEO 확정 2026-07-07).
 * - 서류 마감처럼 날짜만 있는 일정은 같은 날 여러 개여도 충돌 아님 (노이즈 방지)
 * - time '00:00' 은 "날짜만 저장" 관행값이라 제외 (DdayList 표기 규칙과 동일)
 *
 * 레벨:
 * - 'overlap'  — 같은 날 두 일정의 시간 차가 2시간 미만 (이동·진행 시간상 실질 겹침)
 * - 'same-day' — 같은 날 시간 일정 2개 이상 (겹치진 않지만 확인 필요)
 */

export interface DayConflict {
  level: 'overlap' | 'same-day'
  events: CalendarEvent[]
}

const OVERLAP_WINDOW_MIN = 120

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function detectScheduleConflicts(
  events: CalendarEvent[],
): Map<string, DayConflict> {
  const timed = events.filter(
    (e) =>
      (e.type === 'step' || e.type === 'exam') && e.time && e.time !== '00:00',
  )

  const byDate = new Map<string, CalendarEvent[]>()
  for (const e of timed) {
    const list = byDate.get(e.date)
    if (list) list.push(e)
    else byDate.set(e.date, [e])
  }

  const conflicts = new Map<string, DayConflict>()
  for (const [date, list] of byDate) {
    if (list.length < 2) continue
    const sorted = [...list].sort(
      (a, b) => toMinutes(a.time!) - toMinutes(b.time!),
    )
    let overlap = false
    for (let i = 1; i < sorted.length; i++) {
      if (
        toMinutes(sorted[i].time!) - toMinutes(sorted[i - 1].time!) <
        OVERLAP_WINDOW_MIN
      ) {
        overlap = true
        break
      }
    }
    conflicts.set(date, {
      level: overlap ? 'overlap' : 'same-day',
      events: sorted,
    })
  }
  return conflicts
}
