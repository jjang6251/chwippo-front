import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MyInfoEmptyAdd } from './MyInfoEmptyAdd'

describe('MyInfoEmptyAdd', () => {
  it('default — emoji·label·example 표시', () => {
    render(
      <MyInfoEmptyAdd
        emoji="🎓"
        label="첫 학력 추가하기"
        example="예: 서울대학교 · 컴퓨터공학"
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('🎓')).toBeInTheDocument()
    expect(screen.getByText(/첫 학력 추가하기/)).toBeInTheDocument()
    expect(screen.getByText(/서울대학교/)).toBeInTheDocument()
  })

  it('compact — label 만, emoji·example 안 보임', () => {
    render(
      <MyInfoEmptyAdd
        emoji="🎓"
        label="학력 추가"
        example="예: ..."
        compact
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('학력 추가')).toBeInTheDocument()
    expect(screen.queryByText('🎓')).not.toBeInTheDocument()
    expect(screen.queryByText(/예:/)).not.toBeInTheDocument()
  })

  it('클릭 → onClick 호출', () => {
    const onClick = vi.fn()
    render(<MyInfoEmptyAdd label="추가" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('default 와 compact — 다른 스타일', () => {
    const { container, rerender } = render(<MyInfoEmptyAdd label="추가" onClick={vi.fn()} />)
    const defaultBtn = container.querySelector('button')
    expect(defaultBtn?.className).toContain('py-8')

    rerender(<MyInfoEmptyAdd label="추가" compact onClick={vi.fn()} />)
    const compactBtn = container.querySelector('button')
    expect(compactBtn?.className).toContain('py-3')
    expect(compactBtn?.className).not.toContain('py-8')
  })
})
