/**
 * A4 — 일정 충돌 감지 시나리오:
 * 1. 같은 날 시간 일정 2개 (2시간 이상 간격) → same-day
 * 2. 2시간 미만 간격 → overlap
 * 3. 동일 시각 → overlap
 * 4. 시간 null · '00:00'(날짜만 관행값) 만 → 충돌 없음
 * 5. note 타입은 시간 있어도 제외
 * 6. 다른 날짜 각 1개 → 없음
 * 7. 3개 중 한 쌍만 근접 → overlap + 시간순 정렬 3개
 * 8. step + exam 혼합 → 감지
 */
import { describe, expect, it } from 'vitest'
import { detectScheduleConflicts } from './scheduleConflict'
import type { CalendarEvent } from '@/api/calendar'

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  date: '2026-07-10',
  time: '14:00',
  type: 'step',
  applicationId: 'app-1',
  stepId: 's-1',
  examId: null,
  noteId: null,
  companyName: '카카오',
  stepName: '면접',
  location: null,
  content: null,
  ...over,
})

describe('detectScheduleConflicts', () => {
  it('1) 같은 날 2시간 이상 간격 → same-day', () => {
    const c = detectScheduleConflicts([
      ev({ time: '10:00' }),
      ev({ time: '15:00', companyName: '네이버' }),
    ])
    expect(c.get('2026-07-10')?.level).toBe('same-day')
  })

  it('2) 2시간 미만 간격 → overlap', () => {
    const c = detectScheduleConflicts([
      ev({ time: '14:00' }),
      ev({ time: '15:30', companyName: '네이버' }),
    ])
    expect(c.get('2026-07-10')?.level).toBe('overlap')
  })

  it('3) 동일 시각 → overlap', () => {
    const c = detectScheduleConflicts([
      ev({ time: '14:00' }),
      ev({ time: '14:00', companyName: '네이버' }),
    ])
    expect(c.get('2026-07-10')?.level).toBe('overlap')
  })

  it("4) 시간 null · '00:00' 만 → 충돌 없음", () => {
    const c = detectScheduleConflicts([
      ev({ time: null }),
      ev({ time: null, companyName: '네이버' }),
      ev({ time: '00:00', companyName: '토스' }),
      ev({ time: '00:00', companyName: '당근' }),
    ])
    expect(c.size).toBe(0)
  })

  it('5) note 타입은 시간 있어도 제외', () => {
    const c = detectScheduleConflicts([
      ev({ type: 'note', time: '14:00' }),
      ev({ type: 'note', time: '14:30' }),
    ])
    expect(c.size).toBe(0)
  })

  it('6) 다른 날짜 각 1개 → 없음', () => {
    const c = detectScheduleConflicts([
      ev({ date: '2026-07-10' }),
      ev({ date: '2026-07-11' }),
    ])
    expect(c.size).toBe(0)
  })

  it('7) 3개 중 한 쌍만 근접 → overlap + 시간순 정렬', () => {
    const c = detectScheduleConflicts([
      ev({ time: '18:00', companyName: '토스' }),
      ev({ time: '09:00' }),
      ev({ time: '10:00', companyName: '네이버' }),
    ])
    const conflict = c.get('2026-07-10')!
    expect(conflict.level).toBe('overlap')
    expect(conflict.events.map((e) => e.time)).toEqual(['09:00', '10:00', '18:00'])
  })

  it('8) step + exam 혼합 → 감지', () => {
    const c = detectScheduleConflicts([
      ev({ time: '13:00' }),
      ev({ type: 'exam', time: '14:00', companyName: '정보처리기사' }),
    ])
    expect(c.get('2026-07-10')?.level).toBe('overlap')
  })
})
