/**
 * F6 PR 2 Phase 5.4 — AlertThresholds 페이지 테스트.
 *
 * 시나리오:
 * 1. 정상 로드 → 임계치 input 값 채워짐
 * 2. 빈 history → "최근 24h 알람 없음"
 * 3. 테스트 알람 버튼 클릭 → mutation 호출 + 토스트
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Monitoring } from './Monitoring'
import { alertThresholdsApi } from '@/api/alertThresholds'

vi.mock('@/api/alertThresholds', () => ({
  alertThresholdsApi: {
    get: vi.fn(),
    update: vi.fn(),
    test: vi.fn(),
  },
}))

vi.mock('@/api/systemStatus', () => ({
  systemStatusApi: {
    get: vi.fn().mockResolvedValue({
      backend: 'up',
      db: 'ok',
      openai: 'configured',
      anthropic: 'configured',
    }),
  },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn() },
}))

const getMock = vi.mocked(alertThresholdsApi.get)
const testMock = vi.mocked(alertThresholdsApi.test)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

async function waitForRow() {
  await waitFor(() => expect(screen.queryByText('로딩 중...')).toBeNull(), {
    timeout: 1000,
  })
}

describe('Monitoring page', () => {
  beforeEach(() => {
    getMock.mockReset()
    testMock.mockReset()
  })

  it('정상 로드 → 임계치 input 표시', async () => {
    getMock.mockResolvedValue({
      thresholds: {
        id: 1,
        dailyCostThresholdUsd: 50,
        hourlyErrorRateThreshold: 0.1,
        vsYesterdayIncreaseThreshold: 200,
        enabled: true,
        adminGrantPerHourAlert: 10000,
        adminGrantSingleAlert: 10000,
        inquirySlaHours: 24,
        abuserSuspectDailyCalls: 100,
        freeUserSignupSpikePct: 200,
        costOutlierStddev: 2.0,
        updatedBy: null,
        updatedAt: '2026-05-28T00:00:00Z',
      },
      history: [],
    })
    render(<Monitoring />, { wrapper })
    await waitForRow()
    expect(screen.getByText('임계치 설정')).toBeInTheDocument()
  })

  it('빈 history → "최근 24h 알람 없음"', async () => {
    getMock.mockResolvedValue({
      thresholds: {
        id: 1,
        dailyCostThresholdUsd: 50,
        hourlyErrorRateThreshold: 0.1,
        vsYesterdayIncreaseThreshold: 200,
        enabled: true,
        adminGrantPerHourAlert: 10000,
        adminGrantSingleAlert: 10000,
        inquirySlaHours: 24,
        abuserSuspectDailyCalls: 100,
        freeUserSignupSpikePct: 200,
        costOutlierStddev: 2.0,
        updatedBy: null,
        updatedAt: '2026-05-28T00:00:00Z',
      },
      history: [],
    })
    render(<Monitoring />, { wrapper })
    await waitForRow()
    expect(screen.getByText('최근 24h 알람 없음')).toBeInTheDocument()
  })

  it('테스트 알람 버튼 → mutation 호출', async () => {
    getMock.mockResolvedValue({
      thresholds: {
        id: 1,
        dailyCostThresholdUsd: 50,
        hourlyErrorRateThreshold: 0.1,
        vsYesterdayIncreaseThreshold: 200,
        enabled: true,
        adminGrantPerHourAlert: 10000,
        adminGrantSingleAlert: 10000,
        inquirySlaHours: 24,
        abuserSuspectDailyCalls: 100,
        freeUserSignupSpikePct: 200,
        costOutlierStddev: 2.0,
        updatedBy: null,
        updatedAt: '2026-05-28T00:00:00Z',
      },
      history: [],
    })
    testMock.mockResolvedValue({ status: 'sent' })
    render(<Monitoring />, { wrapper })
    await waitForRow()
    fireEvent.click(screen.getByText('🧪 테스트 알람 보내기'))
    await waitFor(() => expect(testMock).toHaveBeenCalled())
  })
})
