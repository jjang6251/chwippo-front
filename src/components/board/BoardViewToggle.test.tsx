/**
 * A11 — BoardViewToggle 시나리오.
 *   1. 카드·리스트·그룹 3버튼 렌더 + role=group
 *   2. 현재 값 버튼만 aria-pressed=true
 *   3. 다른 버튼 클릭 → onChange 해당 view 전달
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BoardViewToggle } from './BoardViewToggle'

describe('BoardViewToggle', () => {
  it('1) 3버튼 + role=group 렌더', () => {
    render(<BoardViewToggle value="card" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: '보기 방식' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카드 보기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '리스트 보기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '그룹 보기' })).toBeInTheDocument()
  })

  it('2) 현재 값 버튼만 aria-pressed=true', () => {
    render(<BoardViewToggle value="list" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '카드 보기' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '리스트 보기' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '그룹 보기' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('3) 버튼 클릭 → onChange(view)', () => {
    const onChange = vi.fn()
    render(<BoardViewToggle value="card" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '그룹 보기' }))
    expect(onChange).toHaveBeenCalledWith('group')
    fireEvent.click(screen.getByRole('button', { name: '리스트 보기' }))
    expect(onChange).toHaveBeenCalledWith('list')
  })
})
