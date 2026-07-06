/**
 * A9 — 성장 페이지 "얻은 것들" 섹션 시나리오:
 * 1. 회고 있는 FAILED 카드만 · 최신(failedTakeawayAt)순 · 카드 링크
 * 2. 회고 0개 → 섹션 미렌더 (여백 없음)
 * 3. FAILED 여도 회고 없거나 공백이면 제외
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TakeawaysSection } from './TakeawaysSection'
import type { Application } from '@/types/application'

let apps: Array<Partial<Application>> = []

vi.mock('@/hooks/useApplications', () => ({
  useApplications: () => ({ data: apps }),
}))

const app = (over: Partial<Application>): Partial<Application> => ({
  id: Math.random().toString(36).slice(2),
  companyName: '카카오',
  status: 'FAILED',
  failedTakeaway: '회고',
  failedTakeawayAt: '2026-07-01T00:00:00Z',
  ...over,
})

function renderSection() {
  return render(
    <MemoryRouter>
      <TakeawaysSection />
    </MemoryRouter>,
  )
}

describe('TakeawaysSection', () => {
  beforeEach(() => {
    apps = []
  })

  it('1) 회고 있는 FAILED 만 · 최신순 · 카드 링크', () => {
    apps = [
      app({ id: 'a1', companyName: '카카오', failedTakeaway: '옛 회고', failedTakeawayAt: '2026-06-01T00:00:00Z' }),
      app({ id: 'a2', companyName: '네이버', failedTakeaway: '새 회고', failedTakeawayAt: '2026-07-01T00:00:00Z' }),
      app({ id: 'a3', status: 'IN_PROGRESS', failedTakeaway: '진행 중 카드' }),
    ]
    renderSection()
    const quotes = screen.getAllByText(/회고”/)
    expect(quotes[0].textContent).toContain('새 회고')
    expect(quotes[1].textContent).toContain('옛 회고')
    expect(screen.queryByText(/진행 중 카드/)).toBeNull()
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/board/a2')
  })

  it('2) 회고 0개 → 미렌더', () => {
    const { container } = renderSection()
    expect(container.firstChild).toBeNull()
  })

  it('3) FAILED 여도 회고 없음·공백 → 제외', () => {
    apps = [
      app({ failedTakeaway: null }),
      app({ failedTakeaway: '   ' }),
    ]
    const { container } = renderSection()
    expect(container.firstChild).toBeNull()
  })
})
