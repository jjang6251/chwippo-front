import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MyInfoItemRow } from './MyInfoItemRow'

describe('MyInfoItemRow', () => {
  it('emoji·title·meta 표시', () => {
    render(
      <MyInfoItemRow
        emoji="🎓"
        title="서울대학교 · 컴퓨터공학"
        meta="학사 · 2020.03 ~ 2024.02"
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('🎓')).toBeInTheDocument()
    expect(screen.getByText('서울대학교 · 컴퓨터공학')).toBeInTheDocument()
    expect(screen.getByText('학사 · 2020.03 ~ 2024.02')).toBeInTheDocument()
  })

  it('클릭 시 onClick 호출', () => {
    const onClick = vi.fn()
    render(<MyInfoItemRow emoji="🎓" title="학교" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('meta 없으면 meta 영역 안 보임', () => {
    render(<MyInfoItemRow emoji="🎓" title="학교" onClick={vi.fn()} />)
    expect(screen.queryByText(/학사/)).not.toBeInTheDocument()
  })

  it('rightSlot 있으면 chevron 대신 표시', () => {
    render(
      <MyInfoItemRow
        emoji="🎓"
        title="학교"
        onClick={vi.fn()}
        rightSlot={<span>custom</span>}
      />,
    )
    expect(screen.getByText('custom')).toBeInTheDocument()
    expect(screen.queryByText('›')).not.toBeInTheDocument()
  })

  it('accent prop — emoji 배경 색 변경', () => {
    const { container, rerender } = render(
      <MyInfoItemRow emoji="🎓" title="학교" accent="brand" onClick={vi.fn()} />,
    )
    expect(container.querySelector('.bg-brand\\/15')).toBeInTheDocument()

    rerender(<MyInfoItemRow emoji="🎓" title="학교" accent="warning" onClick={vi.fn()} />)
    expect(container.querySelector('.bg-warning\\/15')).toBeInTheDocument()
  })
})
