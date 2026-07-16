/**
 * U19 — AddEventSheet 메모 입력 시나리오 (백엔드 varchar(200) 정합):
 * 1. 메모 textarea maxLength=200
 * 2. 카운터는 150자+ 만 노출 (149 미노출 · 200 노출)
 *
 * (데스크탑 모달 경로 — jsdom matchMedia 미구현 → useIsMobile=false)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddEventSheet } from './AddEventSheet'

vi.mock('@/hooks/useCalendar', () => ({
  useCreateDailyNote: () => ({ mutate: vi.fn(), isPending: false }),
}))

function openMemoView() {
  render(<AddEventSheet open defaultDate="2026-07-16" onClose={vi.fn()} />)
  fireEvent.click(screen.getByText('이 날 할 일 · 메모'))
  return screen.getByPlaceholderText('예: 자소서 초안 다듬기') as HTMLTextAreaElement
}

describe('AddEventSheet — 메모 200자 (U19)', () => {
  it('1) textarea maxLength=200', () => {
    const textarea = openMemoView()
    expect(textarea.maxLength).toBe(200)
  })

  it('2) 카운터 150 경계', () => {
    const textarea = openMemoView()
    fireEvent.change(textarea, { target: { value: 'a'.repeat(149) } })
    expect(screen.queryByText('149/200')).toBeNull()

    fireEvent.change(textarea, { target: { value: 'a'.repeat(150) } })
    expect(screen.getByText('150/200')).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'a'.repeat(200) } })
    expect(screen.getByText('200/200')).toBeInTheDocument()
  })
})
