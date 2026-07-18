/**
 * U6 — 아젠다 지난 일정 토글 chevron 시나리오:
 * 1. 지난 일정 있으면 "지난 일정 보기" 토글 노출 · ↑/↓ 텍스트 화살표 미사용
 * 2. 토글에 CollapsibleChevron SVG 렌더
 *
 * leaf(AgendaEventCard·AgendaDateHeader)는 자체 훅/라우터 의존이 있어 stub 처리 —
 * 여기선 CalendarAgendaView 의 토글 chevron 만 검증.
 * 정오 KST 고정으로 UTC·KST 러너 동일 판정.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarAgendaView } from './CalendarAgendaView'
import { addDays, todayLocal } from '@/utils/datetime'
import type { CalendarEvent } from '@/api/calendar'

vi.mock('./AgendaEventCard', () => ({
  AgendaEventCard: () => <div>event-card</div>,
}))
vi.mock('./AgendaDateHeader', () => ({
  AgendaDateHeader: () => <div>date-header</div>,
}))

function ev(partial: Partial<CalendarEvent> & { type: CalendarEvent['type'] }): CalendarEvent {
  return {
    date: todayLocal(),
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

describe('CalendarAgendaView — 지난 일정 토글 chevron (U6)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T03:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1) 지난 일정 토글 → 텍스트 화살표(↑/↓) 미사용 + SVG chevron', () => {
    const events = [
      ev({ type: 'exam', examId: 'e-past', date: addDays(todayLocal(), -5) }),
      ev({ type: 'exam', examId: 'e-future', date: addDays(todayLocal(), 3) }),
    ]
    render(<CalendarAgendaView events={events} />)

    const toggle = screen.getByRole('button', { name: /지난 일정 보기/ })
    expect(toggle.textContent).not.toContain('↑')
    expect(toggle.textContent).not.toContain('↓')
    expect(toggle.querySelector('svg')).toBeTruthy()
  })
})
