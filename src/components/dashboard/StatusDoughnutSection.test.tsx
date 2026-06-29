/**
 * W3 — StatusDoughnutSection spec.
 *
 * 5축 — 정상 status 5개 / 빈 상태 / 401·503 silent / status 라벨 한글
 */
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusDoughnutSection } from './StatusDoughnutSection'
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

const makeResponse = (
  statusDistribution: DashboardStreakResponse['statusDistribution'],
): DashboardStreakResponse => ({
  streak: { current: 0, lastActivityDate: null },
  heatmap: [],
  statusDistribution,
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
})

describe('StatusDoughnutSection', () => {
  it('5 status 분포 표시 — 한글 라벨 + count + 퍼센트', async () => {
    apiMock.mockResolvedValue(
      makeResponse([
        { status: 'IN_PROGRESS', count: 2 },
        { status: 'APPLIED', count: 1 },
        { status: 'INTERVIEW', count: 1 },
        { status: 'PASSED', count: 1 },
        { status: 'FAILED', count: 1 },
      ]),
    )
    render(<StatusDoughnutSection />, { wrapper })

    await waitFor(() => expect(screen.getByText('지원 현황')).toBeInTheDocument())
    expect(screen.getByText('작성 중')).toBeInTheDocument()
    expect(screen.getByText('지원 완료')).toBeInTheDocument()
    expect(screen.getByText('면접')).toBeInTheDocument()
    expect(screen.getByText('합격')).toBeInTheDocument()
    expect(screen.getByText('불합격')).toBeInTheDocument()
    // 총 6건
    expect(screen.getByText(/6건/)).toBeInTheDocument()
  })

  it('statusDistribution 빈 배열 → "아직 지원 카드가 없어요" 메시지', async () => {
    apiMock.mockResolvedValue(makeResponse([]))
    render(<StatusDoughnutSection />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText(/아직 지원 카드가 없어요/)).toBeInTheDocument(),
    )
    expect(screen.queryByText('작성 중')).not.toBeInTheDocument()
  })

  it('count=0 인 status 슬라이스 미표시 (legend·chart 양쪽)', async () => {
    apiMock.mockResolvedValue(
      makeResponse([
        { status: 'IN_PROGRESS', count: 3 },
        { status: 'FAILED', count: 0 }, // 0 이면 표시 X
      ]),
    )
    render(<StatusDoughnutSection />, { wrapper })

    await waitFor(() => expect(screen.getByText('작성 중')).toBeInTheDocument())
    expect(screen.queryByText('불합격')).not.toBeInTheDocument()
  })

  it('401 → silent 미렌더', async () => {
    apiMock.mockRejectedValue(makeAxiosError(401))
    const { container } = render(<StatusDoughnutSection />, { wrapper })

    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })

  it('503 → silent 미렌더', async () => {
    apiMock.mockRejectedValue(makeAxiosError(503))
    const { container } = render(<StatusDoughnutSection />, { wrapper })

    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })
})
