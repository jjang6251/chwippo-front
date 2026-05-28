/**
 * F6 PR 2 Phase 5.6.소급 — AdminCard 시나리오.
 *
 * 매트릭스:
 *   1. children 렌더 (필수)
 *   2. title 옵션 — header 표시
 *   3. action 옵션 — header 우측 표시
 *   4. hint 옵션 — ⓘ 아이콘 + title 속성
 *   5. flush=true → 본문 padding 제거
 *   6. flush=false (default) → 본문 padding p-5
 *   7. title 없으면 header 자체 안 렌더
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminCard } from './AdminCard'

describe('AdminCard', () => {
  it('1) children 렌더', () => {
    render(<AdminCard>본문</AdminCard>)
    expect(screen.getByText('본문')).toBeInTheDocument()
  })

  it('2) title 렌더', () => {
    render(<AdminCard title="제목">본문</AdminCard>)
    expect(screen.getByText('제목')).toBeInTheDocument()
  })

  it('3) action 렌더', () => {
    render(
      <AdminCard title="제목" action={<button>액션</button>}>
        본문
      </AdminCard>,
    )
    expect(screen.getByRole('button', { name: '액션' })).toBeInTheDocument()
  })

  it('4) hint → ⓘ 아이콘 + title tooltip', () => {
    render(
      <AdminCard title="제목" hint="도움말">
        본문
      </AdminCard>,
    )
    const hint = screen.getByText('ⓘ')
    expect(hint).toBeInTheDocument()
    expect(hint).toHaveAttribute('title', '도움말')
  })

  it('5) flush=true → 본문 padding 클래스 없음', () => {
    const { container } = render(<AdminCard flush>본문</AdminCard>)
    const body = container.querySelector('div')
    expect(body?.className).not.toContain('p-5')
  })

  it('6) flush=false (default) → 본문 padding p-5', () => {
    const { container } = render(<AdminCard>본문</AdminCard>)
    // section 안 첫 div 가 본문 wrapper
    const body = container.querySelector('section > div')
    expect(body?.className).toContain('p-5')
  })

  it('7) title 없으면 header 안 렌더 (action·hint 만 있어도)', () => {
    const { container } = render(<AdminCard>본문</AdminCard>)
    expect(container.querySelector('header')).toBeNull()
  })
})
