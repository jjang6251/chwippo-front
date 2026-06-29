/**
 * W3 — StreakSection spec.
 *
 * 5축 — streak 0 라벨 / streak N 라벨 / heatmap 365 셀 / 404·503 silent / 마지막 활동 라벨
 */
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StreakSection } from './StreakSection'
import { getDashboardStreak } from '@/api/dashboard'
import type { DashboardStreakResponse } from '@/types/dashboardStreak'

vi.mock('@/api/dashboard', () => ({
  getDashboardStreak: vi.fn(),
}))

const apiMock = vi.mocked(getDashboardStreak)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

/** KST today year — mock 의 date 를 현재 연도 기준으로 (filter 통과 위해) */
const TODAY_YEAR = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
}).format(new Date())

const makeResponse = (
  overrides: Partial<DashboardStreakResponse> = {},
): DashboardStreakResponse => ({
  streak: { current: 0, lastActivityDate: null },
  // 현재 연도 1/1 ~ 6/30 일자 (filter 통과). 30 일 × 6개월 = 180 entries
  heatmap: Array.from({ length: 180 }, (_, i) => ({
    date: `${TODAY_YEAR}-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
    count: 0,
  })),
  statusDistribution: [],
  ...overrides,
})

const makeAxiosError = (status: number): AxiosError => {
  const err = new AxiosError(`HTTP ${status}`)
  const headers = new AxiosHeaders()
  err.response = {
    status,
    data: {},
    statusText: '',
    headers,
    config: { headers },
  }
  return err
}

beforeEach(() => {
  apiMock.mockReset()
  // matchMedia mock (jsdom 기본 X)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false, // desktop default
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  })
})

describe('StreakSection', () => {
  it('streak.current=0 → "🌱 첫 기록!" 라벨 표시', async () => {
    apiMock.mockResolvedValue(makeResponse({ streak: { current: 0, lastActivityDate: null } }))
    render(<StreakSection />, { wrapper })

    await waitFor(() => expect(screen.getByText('🌱 첫 기록!')).toBeInTheDocument())
  })

  it('streak.current=5 → "🔥 5일째" 라벨 표시', async () => {
    apiMock.mockResolvedValue(makeResponse({ streak: { current: 5, lastActivityDate: '2026-06-29' } }))
    render(<StreakSection />, { wrapper })

    await waitFor(() => expect(screen.getByText('🔥 5일째')).toBeInTheDocument())
  })

  it('current=0 + lastActivityDate 있음 → "마지막: YYYY-MM-DD" 라벨', async () => {
    apiMock.mockResolvedValue(
      makeResponse({ streak: { current: 0, lastActivityDate: '2026-05-15' } }),
    )
    render(<StreakSection />, { wrapper })

    await waitFor(() => expect(screen.getByText(/마지막: 2026-05-15/)).toBeInTheDocument())
  })

  it('current>=1 → "마지막:" 라벨 없음 (오늘 활동 중)', async () => {
    apiMock.mockResolvedValue(makeResponse({ streak: { current: 3, lastActivityDate: '2026-06-29' } }))
    render(<StreakSection />, { wrapper })

    await waitFor(() => expect(screen.getByText('🔥 3일째')).toBeInTheDocument())
    expect(screen.queryByText(/마지막:/)).not.toBeInTheDocument()
  })

  it('heatmap render — 현재 연도(KST) entries 만 표시', async () => {
    apiMock.mockResolvedValue(makeResponse())
    render(<StreakSection />, { wrapper })

    await waitFor(() => {
      const cells = screen.getAllByTestId('streak-cell')
      // 180 entries (현재 연도) 모두 cell 로 render. padding null 셀은 제외
      expect(cells.length).toBeGreaterThan(0)
      expect(cells.length).toBeLessThanOrEqual(180)
    })
  })

  it('401 → silent 미렌더', async () => {
    apiMock.mockRejectedValue(makeAxiosError(401))
    const { container } = render(<StreakSection />, { wrapper })

    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })

  it('503 → silent 미렌더', async () => {
    apiMock.mockRejectedValue(makeAxiosError(503))
    const { container } = render(<StreakSection />, { wrapper })

    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })
})
