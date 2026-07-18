/**
 * U8/U9 — 월 그리드 셀 탭 · "+N개" 탭 시나리오:
 * 1. 셀 탭 → onSelectDate(date) (셀은 role=button)
 * 2. 이벤트 5개(pill+dot3+overflow1) → "+N개" button(aria-label) 노출
 * 3. "+N개" 탭 → onSelectDate 1회만 (stopPropagation, 셀과 중복 호출 없음)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarMonthlyGrid } from './CalendarMonthlyGrid'
import { addDays, todayLocal } from '@/utils/datetime'
import type { CalendarEvent } from '@/api/calendar'

const today = dayjs().startOf('day')
const TODAY = today.format('YYYY-MM-DD')
const DAY_NUM = String(today.date())

function ev(partial: Partial<CalendarEvent> & { type: CalendarEvent['type'] }): CalendarEvent {
  return {
    date: TODAY,
    time: null,
    applicationId: null,
    stepId: null,
    examId: null,
    noteId: null,
    companyName: '회사',
    stepName: null,
    location: null,
    content: null,
    ...partial,
  }
}

// 5개 → pill(step no-time) + dot×3(exam) + overflow×1
const FIVE_EVENTS: CalendarEvent[] = [
  ev({ type: 'step', stepName: '서류' }),
  ev({ type: 'exam', examId: 'e1' }),
  ev({ type: 'exam', examId: 'e2' }),
  ev({ type: 'exam', examId: 'e3' }),
  ev({ type: 'exam', examId: 'e4' }),
]

describe('CalendarMonthlyGrid — 셀·+N개 탭 (U8/U9)', () => {
  it('1) 셀 탭 → onSelectDate(date)', () => {
    const onSelectDate = vi.fn()
    render(<CalendarMonthlyGrid events={[ev({ type: 'exam', examId: 'e1' })]} onSelectDate={onSelectDate} />)
    const cell = screen.getByText(DAY_NUM).closest('[role="button"]')!
    fireEvent.click(cell)
    expect(onSelectDate).toHaveBeenCalledWith(TODAY)
  })

  it('2) 5개 이벤트 → "+N개" button 노출', () => {
    render(<CalendarMonthlyGrid events={FIVE_EVENTS} onSelectDate={vi.fn()} />)
    expect(screen.getByRole('button', { name: '이벤트 1개 더 보기' })).toBeInTheDocument()
  })

  it('3) "+N개" 탭 → onSelectDate 1회만 (stopPropagation)', () => {
    const onSelectDate = vi.fn()
    render(<CalendarMonthlyGrid events={FIVE_EVENTS} onSelectDate={onSelectDate} />)
    fireEvent.click(screen.getByRole('button', { name: '이벤트 1개 더 보기' }))
    expect(onSelectDate).toHaveBeenCalledTimes(1)
    expect(onSelectDate).toHaveBeenCalledWith(TODAY)
  })
})

/**
 * M8·U22·링 — 월뷰 A안 (목업 확정) 시나리오:
 * 1. 같은 날 종일 마감 3건 → pill 1개(첫 회사명) + "+2" 뱃지 (나머지 개별 pill 없음)
 * 2. 마감 1건 → "+N" 뱃지 없음
 * 3. 마감 있는 날 날짜 숫자 → warning 링 클래스
 * 4. pill 회사명 → 11px 클래스
 *
 * 날짜는 @/utils/datetime + 정오 KST 고정(fake timer) 으로 UTC·KST 러너 모두 동일 판정.
 * (컴포넌트 내부 dayjs() '오늘'과 todayLocal() 이 정오엔 갈라지지 않음 — CI TZ 안전)
 */
describe('CalendarMonthlyGrid — 마감 pill·"+N" 뱃지·링 (M8·U22)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-07-15 정오 KST (= 03:00Z) — UTC·KST 러너 양쪽에서 7월 그리드
    vi.setSystemTime(new Date('2026-07-15T03:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // 오늘(15)이 아닌 미래·비오늘 날짜 → past opacity·today 배지 간섭 없음
  const DEADLINE_DAY = addDays(todayLocal(), 2) // 2026-07-17
  const DEADLINE_DAY_NUM = String(Number(DEADLINE_DAY.slice(8, 10))) // '17'

  function deadlineEvents(n: number): CalendarEvent[] {
    return Array.from({ length: n }, (_, i) =>
      ev({ type: 'step', stepName: '서류', companyName: `회사${i}`, date: DEADLINE_DAY }),
    )
  }

  it('1) 같은 날 종일 마감 3건 → pill 1개 + "+2" 뱃지', () => {
    render(<CalendarMonthlyGrid events={deadlineEvents(3)} onSelectDate={vi.fn()} />)
    // 첫 회사명만 pill 로
    expect(screen.getByText('회사0')).toBeInTheDocument()
    expect(screen.queryByText('회사1')).toBeNull()
    expect(screen.queryByText('회사2')).toBeNull()
    // 나머지 2건 = "+2" 뱃지
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('2) 마감 1건 → "+N" 뱃지 없음', () => {
    render(<CalendarMonthlyGrid events={deadlineEvents(1)} onSelectDate={vi.fn()} />)
    expect(screen.getByText('회사0')).toBeInTheDocument()
    expect(screen.queryByText(/^\+\d/)).toBeNull()
  })

  it('3) 마감 있는 날 날짜 숫자 → warning 링 클래스', () => {
    render(<CalendarMonthlyGrid events={deadlineEvents(1)} onSelectDate={vi.fn()} />)
    const badge = screen.getByText(DEADLINE_DAY_NUM)
    expect(badge.className).toContain('ring-warning/50')
  })

  it('4) pill 회사명 → 11px 클래스', () => {
    render(<CalendarMonthlyGrid events={deadlineEvents(1)} onSelectDate={vi.fn()} />)
    const pillLabel = screen.getByText('회사0')
    expect(pillLabel.className).toContain('text-[11px]')
  })
})
