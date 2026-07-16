/**
 * U1 — 모바일 날짜 상세 시트 시나리오:
 * 1. open=false → 렌더 안 함
 * 2. date=null → 렌더 안 함
 * 3. open + date → 날짜 헤더 + 하단 CTA 렌더
 * 4. CTA "이 날짜에 일정 추가" 탭 → onAddOnDate(date)
 * 5. 닫기 버튼 → onClose
 *
 * (vaul Drawer 는 passthrough 로 목킹 — jsdom matchMedia 의존 제거)
 */
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CalendarDaySheet } from './CalendarDaySheet'

vi.mock('vaul', () => ({
  Drawer: {
    Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Portal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Overlay: () => null,
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
}))

vi.mock('@/hooks/useCalendar', () => ({
  useDailyNotes: () => ({ data: [] }),
  useCreateDailyNote: () => ({ mutate: vi.fn() }),
  useUpdateDailyNote: () => ({ mutate: vi.fn() }),
  useDeleteDailyNote: () => ({ mutate: vi.fn() }),
  useCarryOverDailyNote: () => ({ mutate: vi.fn() }),
  useUrgentChecklist: () => ({ data: [] }),
  useCompleteUrgentChecklistItem: () => ({ mutate: vi.fn(), isPending: false }),
}))

function renderSheet(props: Partial<Parameters<typeof CalendarDaySheet>[0]> = {}) {
  const onClose = vi.fn()
  const onAddOnDate = vi.fn()
  render(
    <MemoryRouter>
      <CalendarDaySheet
        open
        date="2026-07-16"
        events={[]}
        onClose={onClose}
        onAddOnDate={onAddOnDate}
        {...props}
      />
    </MemoryRouter>,
  )
  return { onClose, onAddOnDate }
}

describe('CalendarDaySheet (U1)', () => {
  it('1) open=false → 렌더 안 함', () => {
    const { container } = render(
      <MemoryRouter>
        <CalendarDaySheet open={false} date="2026-07-16" events={[]} onClose={vi.fn()} onAddOnDate={vi.fn()} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('2) date=null → 렌더 안 함', () => {
    const { container } = render(
      <MemoryRouter>
        <CalendarDaySheet open date={null} events={[]} onClose={vi.fn()} onAddOnDate={vi.fn()} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('3) open + date → 헤더 + CTA 렌더', () => {
    renderSheet()
    expect(screen.getByText(/7월 16일/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이 날짜에 일정 추가' })).toBeInTheDocument()
  })

  it('4) CTA 탭 → onAddOnDate(date)', () => {
    const { onAddOnDate } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: '이 날짜에 일정 추가' }))
    expect(onAddOnDate).toHaveBeenCalledWith('2026-07-16')
  })

  it('5) 닫기 → onClose', () => {
    const { onClose } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
