/**
 * U28/U26 — 아젠다 날짜 헤더 시나리오:
 * 1. onSelect 있음 → 날짜 영역이 button(상세 보기) · 클릭 시 onSelect
 * 2. onSelect 없음 → 날짜 영역 정적 (button 아님)
 * 3. onAdd 버튼 별도 유지 · 클릭 시 onAdd (onSelect 와 독립)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgendaDateHeader } from './AgendaDateHeader'

describe('AgendaDateHeader — 날짜 탭 (U28) · + 버튼 (U26)', () => {
  it('1) onSelect 있음 → 날짜 영역 button · 클릭 시 onSelect', () => {
    const onSelect = vi.fn()
    render(<AgendaDateHeader date="2026-07-16" isToday onSelect={onSelect} />)
    const selectBtn = screen.getByRole('button', { name: /상세 보기/ })
    fireEvent.click(selectBtn)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('2) onSelect 없음 → 날짜 영역 button 아님', () => {
    render(<AgendaDateHeader date="2026-07-16" isToday />)
    expect(screen.queryByRole('button', { name: /상세 보기/ })).toBeNull()
  })

  it('3) onAdd 버튼 별도 유지 · onSelect 와 독립', () => {
    const onSelect = vi.fn()
    const onAdd = vi.fn()
    render(<AgendaDateHeader date="2026-07-16" isToday onSelect={onSelect} onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: /일정 추가/ }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
