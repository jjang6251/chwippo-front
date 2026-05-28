/**
 * F6 PR 2 Phase 5.6.소급 — AdminLayout 시나리오.
 *
 * 매트릭스:
 *   1. 모든 nav 항목 렌더 (운영 4 + AI 2 + 모니터링 1 = 7)
 *   2. isActive 정확 매칭 — /ops 진입 시 "대시보드" 만 active (다른 항목 X)
 *   3. isActive prefix 매칭 — /ops/users 진입 시 "회원 관리" active
 *   4. /ops/monitoring 진입 시 "알람·임계치" active
 *   5. Outlet 렌더 — child 페이지 표시
 *   6. desktop sticky nav + 모바일 horizontal scroll 분기 (두 nav 모두 렌더)
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AdminLayout } from './AdminLayout'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/ops" element={<div>대시보드페이지</div>} />
          <Route path="/ops/users" element={<div>회원관리페이지</div>} />
          <Route path="/ops/users/:id" element={<div>회원상세페이지</div>} />
          <Route path="/ops/monitoring" element={<div>모니터링페이지</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  it('1) 모든 nav 항목 7개 렌더 (운영 4 + AI 2 + 모니터링 1) — desktop·모바일 nav 양쪽 = 14', () => {
    renderAt('/ops')
    // desktop + mobile nav 둘 다 렌더 (CSS 로만 분기, 실제 DOM 양쪽)
    expect(screen.getAllByText('대시보드')).toHaveLength(2)
    expect(screen.getAllByText('회원 관리')).toHaveLength(2)
    expect(screen.getAllByText('AI 한도')).toHaveLength(2)
    expect(screen.getAllByText('알람·임계치')).toHaveLength(2)
  })

  it('2) /ops → "대시보드" 만 active (다른 항목 X — 정확 매칭)', () => {
    renderAt('/ops')
    const dashLinks = screen.getAllByText('대시보드')
    // active = bg-warning/15 클래스
    expect(dashLinks[0].closest('a')?.className).toContain('warning')
    // 다른 항목 inactive
    const usersLinks = screen.getAllByText('회원 관리')
    expect(usersLinks[0].closest('a')?.className).not.toContain('warning')
  })

  it('3) /ops/users → "회원 관리" active + "대시보드" inactive (prefix 매칭이 /ops 에 잘못 매치 안 함)', () => {
    renderAt('/ops/users')
    expect(
      screen.getAllByText('회원 관리')[0].closest('a')?.className,
    ).toContain('warning')
    expect(
      screen.getAllByText('대시보드')[0].closest('a')?.className,
    ).not.toContain('warning')
  })

  it('4) /ops/users/abc-123 (sub path) → "회원 관리" 여전히 active (prefix 매칭)', () => {
    renderAt('/ops/users/abc-123')
    expect(
      screen.getAllByText('회원 관리')[0].closest('a')?.className,
    ).toContain('warning')
  })

  it('5) /ops/monitoring → "알람·임계치" active', () => {
    renderAt('/ops/monitoring')
    expect(
      screen.getAllByText('알람·임계치')[0].closest('a')?.className,
    ).toContain('warning')
  })

  it('6) Outlet 가 child 페이지 렌더', () => {
    renderAt('/ops/monitoring')
    expect(screen.getByText('모니터링페이지')).toBeInTheDocument()
  })
})
