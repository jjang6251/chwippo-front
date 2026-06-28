/**
 * W1 — EmptyBoardState spec — render + CTA click.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyBoardState } from './EmptyBoardState'

describe('EmptyBoardState', () => {
  it('render — 타이틀 + 카피 + CTA 표시', () => {
    render(<EmptyBoardState onAddFirst={vi.fn()} />)
    expect(screen.getByText(/첫 회사를 추가해볼까요/)).toBeInTheDocument()
    expect(screen.getByText(/관심 있는 회사부터 가볍게 등록/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /첫 회사 추가/ })).toBeInTheDocument()
  })

  it('CTA 클릭 → onAddFirst 호출', () => {
    const onAdd = vi.fn()
    render(<EmptyBoardState onAddFirst={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: /첫 회사 추가/ }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})
