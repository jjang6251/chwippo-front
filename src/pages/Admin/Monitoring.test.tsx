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
const updateMock = vi.mocked(alertThresholdsApi.update)

function makeThresholds(overrides: Partial<import('@/api/alertThresholds').AlertThresholds> = {}) {
  return {
    id: 1 as const,
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
    ...overrides,
  }
}

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

  // PR_B2 Phase 2b — 신규 6 임계치 form 동작 매트릭스 (CTO 시각 검증 spec)
  describe('PR_B2 Phase 2b — 신규 6 임계치 변경', () => {
    beforeEach(() => {
      getMock.mockResolvedValue({
        thresholds: makeThresholds(),
        history: [],
      })
      updateMock.mockResolvedValue(makeThresholds())
    })

    it('초기 로드 시 신규 6 input 의 default 값 채워짐 (admin grant 2 + 신규 4)', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      // admin grant 2
      expect(screen.getByLabelText('admin 시간당 grant 합계 (코인)')).toHaveValue(
        10000,
      )
      expect(screen.getByLabelText('admin 1회 grant 임계치 (코인)')).toHaveValue(
        10000,
      )
      // Phase 2 신규 4
      expect(screen.getByLabelText('문의 SLA 시간')).toHaveValue(24)
      expect(screen.getByLabelText('abuser 의심 일 호출')).toHaveValue(100)
      expect(screen.getByLabelText('Free 가입 폭증 (%)')).toHaveValue(200)
      expect(screen.getByLabelText('cost outlier σ')).toHaveValue(2)
    })

    it('admin 시간당 grant 변경 → save 시 payload 에 정확 포함', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText('admin 시간당 grant 합계 (코인)')
      fireEvent.change(input, { target: { value: '20000' } })
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(updateMock).toHaveBeenCalled())
      const payload = updateMock.mock.calls[0][0]
      expect(payload.adminGrantPerHourAlert).toBe(20000)
      expect(payload.adminGrantSingleAlert).toBe(10000) // 미변경
    })

    it('문의 SLA input 의 onChange → state 변경 → input 자체에 반영', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText('문의 SLA 시간') as HTMLInputElement
      fireEvent.change(input, { target: { value: '4' } })
      await waitFor(() => expect(input.value).toBe('4'))
    })

    it('abuser 일 호출 input 의 onChange → input 자체에 반영', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText(
        'abuser 의심 일 호출',
      ) as HTMLInputElement
      fireEvent.change(input, { target: { value: '50' } })
      await waitFor(() => expect(input.value).toBe('50'))
    })

    it('Free 가입 폭증 % input → input 자체에 반영', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText(
        'Free 가입 폭증 (%)',
      ) as HTMLInputElement
      fireEvent.change(input, { target: { value: '300' } })
      await waitFor(() => expect(input.value).toBe('300'))
    })

    it('cost outlier σ 의 소수 → input 자체에 반영', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const input = screen.getByLabelText('cost outlier σ') as HTMLInputElement
      fireEvent.change(input, { target: { value: '2.5' } })
      await waitFor(() => expect(input.value).toBe('2.5'))
    })

    it('값 미변경 시 저장 버튼 disabled (dirty=false)', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      const saveBtn = screen.getByText('저장') as HTMLButtonElement
      expect(saveBtn.disabled).toBe(true)
    })

    it('1 임계치만 변경해도 save 시 payload 6 + 기존 3 모두 포함 (PATCH 안전)', async () => {
      render(<Monitoring />, { wrapper })
      await waitForRow()

      fireEvent.change(screen.getByLabelText('admin 1회 grant 임계치 (코인)'), {
        target: { value: '5000' },
      })
      fireEvent.click(screen.getByText('저장'))

      await waitFor(() => expect(updateMock).toHaveBeenCalled())
      const payload = updateMock.mock.calls[0][0]
      // Phase 1 + Phase 2 6 임계치 모두 포함
      expect(payload).toHaveProperty('adminGrantPerHourAlert')
      expect(payload).toHaveProperty('adminGrantSingleAlert')
      expect(payload).toHaveProperty('inquirySlaHours')
      expect(payload).toHaveProperty('abuserSuspectDailyCalls')
      expect(payload).toHaveProperty('freeUserSignupSpikePct')
      expect(payload).toHaveProperty('costOutlierStddev')
      // 기존 3
      expect(payload).toHaveProperty('dailyCostThresholdUsd')
      expect(payload).toHaveProperty('hourlyErrorRateThreshold')
      expect(payload).toHaveProperty('vsYesterdayIncreaseThreshold')
      expect(payload).toHaveProperty('enabled')
    })

    it('서버에서 다른 default 값 받아도 input 반영 (server-driven)', async () => {
      getMock.mockResolvedValue({
        thresholds: makeThresholds({
          adminGrantPerHourAlert: 5000,
          inquirySlaHours: 12,
          costOutlierStddev: 3.5,
        }),
        history: [],
      })
      render(<Monitoring />, { wrapper })
      await waitForRow()

      expect(screen.getByLabelText('admin 시간당 grant 합계 (코인)')).toHaveValue(
        5000,
      )
      expect(screen.getByLabelText('문의 SLA 시간')).toHaveValue(12)
      expect(screen.getByLabelText('cost outlier σ')).toHaveValue(3.5)
    })
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
