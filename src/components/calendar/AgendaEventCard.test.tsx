/**
 * U27 — 아젠다 카드 인라인 완료 체크박스 시나리오:
 * 1. note 미완료 → 체크박스(완료 표시) · 제목 취소선 없음
 * 2. note 클릭 → 낙관 토글 (updateNote isDone=true) · 즉시 완료 상태(취소선)
 * 3. note isDone=true → 체크박스(완료 취소) · 취소선
 * 4. 실패 롤백 → onError 시 미완료로 복귀 + 에러 토스트
 * 5. step/exam → 체크박스 없음 · 상세 링크 렌더
 * 6. 외부 갱신 반영 — 서버값 일치 후 override 해제, 이후 외부(시트) 변경 반영
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgendaEventCard } from './AgendaEventCard'
import { useToastStore } from '@/stores/toastStore'
import { DEADLINE_DISPLAY_TIME } from '@/utils/datetime'
import type { CalendarEvent } from '@/api/calendar'

const updateMutate = vi.fn()

vi.mock('@/hooks/useCalendar', () => ({
  useUpdateDailyNote: () => ({ mutate: updateMutate }),
}))

function ev(partial: Partial<CalendarEvent> & { type: CalendarEvent['type'] }): CalendarEvent {
  return {
    date: '2026-07-16',
    time: null,
    applicationId: null,
    stepId: null,
    examId: null,
    noteId: null,
    companyName: null,
    stepName: null,
    location: null,
    content: null,
    ...partial,
  }
}

function renderCard(event: CalendarEvent) {
  return render(
    <MemoryRouter>
      <AgendaEventCard event={event} />
    </MemoryRouter>,
  )
}

describe('AgendaEventCard — 완료 체크박스 (U27)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMutate.mockReset()
    useToastStore.setState({ toasts: [] })
  })

  it('1) note 미완료 → 체크박스 + 취소선 없음', () => {
    renderCard(ev({ type: 'note', noteId: 'n1', content: '인적성 문제집' }))
    expect(screen.getByRole('button', { name: '완료 표시' })).toBeInTheDocument()
    expect(screen.getByText('인적성 문제집')).not.toHaveClass('line-through')
  })

  it('2) note 클릭 → 낙관 토글 (updateNote) · 즉시 완료 표시', () => {
    renderCard(ev({ type: 'note', noteId: 'n1', content: '인적성 문제집' }))
    fireEvent.click(screen.getByRole('button', { name: '완료 표시' }))
    expect(updateMutate).toHaveBeenCalledWith(
      { id: 'n1', isDone: true },
      expect.objectContaining({ onError: expect.any(Function) }),
    )
    // 낙관 업데이트: 즉시 완료 상태 (aria-label 전환 + 취소선)
    expect(screen.getByRole('button', { name: '완료 취소' })).toBeInTheDocument()
    expect(screen.getByText('인적성 문제집')).toHaveClass('line-through')
  })

  it('3) note isDone=true → 완료 취소 · 취소선', () => {
    renderCard(ev({ type: 'note', noteId: 'n1', content: '완료된 일', isDone: true }))
    expect(screen.getByRole('button', { name: '완료 취소' })).toBeInTheDocument()
    expect(screen.getByText('완료된 일')).toHaveClass('line-through')
  })

  it('4) 실패 롤백 → 미완료 복귀 + 에러 토스트', () => {
    updateMutate.mockImplementation((_vars, opts) => opts?.onError?.())
    renderCard(ev({ type: 'note', noteId: 'n1', content: '인적성 문제집' }))
    fireEvent.click(screen.getByRole('button', { name: '완료 표시' }))
    // 롤백: 다시 미완료
    expect(screen.getByRole('button', { name: '완료 표시' })).toBeInTheDocument()
    expect(screen.getByText('인적성 문제집')).not.toHaveClass('line-through')
    expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true)
  })

  it('5) step/exam → 체크박스 없음 · 상세 링크', () => {
    const { unmount } = renderCard(
      ev({ type: 'step', applicationId: 'a1', stepId: 's1', companyName: '카카오', stepName: '면접' }),
    )
    expect(screen.queryByRole('button', { name: /완료/ })).toBeNull()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/board/a1/steps/s1')
    unmount()

    renderCard(ev({ type: 'exam', examId: 'e1', companyName: 'TOEIC' }))
    expect(screen.queryByRole('button', { name: /완료/ })).toBeNull()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/myinfo#exam-schedules')
  })

  // F8 — 종일 마감(시간 없는 step)은 DEADLINE_DISPLAY_TIME 상수로 표시 (하드코딩 '23:59' 아님)
  it('8) 시간 없는 step 마감 → DEADLINE_DISPLAY_TIME 상수 표시 (F8)', () => {
    renderCard(ev({ type: 'step', applicationId: 'a1', stepId: 's1', companyName: '카카오', stepName: '서류' }))
    expect(screen.getByText(DEADLINE_DISPLAY_TIME)).toBeInTheDocument()
  })

  it('7) 카드 구분감 v2 (U11+U29) — surface-2 승격 + 유형 스트라이프 + hover', () => {
    renderCard(ev({ type: 'note', noteId: 'n1', content: '메모' }))
    const card = screen.getByText('메모').closest('.rounded-lg')
    // U29 v2 — 다크 저알파 틴트 지각 불가 → surface 승격 + 좌측 유형색 스트라이프
    expect(card?.className).toContain('bg-card-solid')
    expect(card?.className).toContain('border-l-[3px]')
    expect(card?.className).toContain('border-l-info')
    expect(card?.className).toContain('shadow-sm')
    expect(card?.className).toContain('hover:bg-surface-3')
    expect(card?.className).toContain('transition-colors')
    // no-op bare 'card-hover' 클래스 잔존 금지
    expect(card?.className.split(/\s+/)).not.toContain('card-hover')
  })

  it('6) 외부 갱신 반영 — 서버값 일치 후 override 해제, 이후 외부 변경 반영', () => {
    const { rerender } = renderCard(ev({ type: 'note', noteId: 'n1', content: '인적성 문제집' }))
    fireEvent.click(screen.getByRole('button', { name: '완료 표시' }))
    expect(screen.getByRole('button', { name: '완료 취소' })).toBeInTheDocument()

    // refetch: 서버값이 낙관값과 일치 → override 해제
    rerender(
      <MemoryRouter>
        <AgendaEventCard
          event={ev({ type: 'note', noteId: 'n1', content: '인적성 문제집', isDone: true })}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: '완료 취소' })).toBeInTheDocument()

    // 외부(시트)에서 다시 미완료로 변경 → 카드가 낡은 완료 상태에 고정되지 않고 따라감
    rerender(
      <MemoryRouter>
        <AgendaEventCard
          event={ev({ type: 'note', noteId: 'n1', content: '인적성 문제집', isDone: false })}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: '완료 표시' })).toBeInTheDocument()
    expect(screen.getByText('인적성 문제집')).not.toHaveClass('line-through')
  })
})
