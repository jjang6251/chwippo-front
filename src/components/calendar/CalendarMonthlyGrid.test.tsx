/**
 * U8/U9 — 월 그리드 셀 탭 · "+N개" 탭 시나리오:
 * 1. 셀 탭 → onSelectDate(date) (셀은 role=button)
 * 2. 이벤트 5개(pill+dot3+overflow1) → "+N개" button(aria-label) 노출
 * 3. "+N개" 탭 → onSelectDate 1회만 (stopPropagation, 셀과 중복 호출 없음)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import dayjs from 'dayjs'
import { describe, expect, it, vi } from 'vitest'
import { CalendarMonthlyGrid } from './CalendarMonthlyGrid'
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
