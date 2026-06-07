/**
 * PR_B2 Phase 2b — useAiUsageMetrics hooks 시나리오 매트릭스.
 *
 * 5축 cover — 정상 / 빈 데이터 / period 5 / error / cache key 별 격리.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  useAiUsageByFeaturePeriod,
  useAiUsageByModelPeriod,
  useAiUsageMetricsPeriod,
  useAiUsageTopUsersPeriod,
} from './useAiUsageMetrics'
import { aiUsageMetricsApi } from '@/api/aiUsageMetrics'

vi.mock('@/api/aiUsageMetrics', async () => {
  const actual = await vi.importActual<
    typeof import('@/api/aiUsageMetrics')
  >('@/api/aiUsageMetrics')
  return {
    ...actual,
    aiUsageMetricsApi: {
      metrics: vi.fn(),
      topUsers: vi.fn(),
      byFeature: vi.fn(),
      byModel: vi.fn(),
    },
  }
})

const mocked = aiUsageMetricsApi as {
  metrics: ReturnType<typeof vi.fn>
  topUsers: ReturnType<typeof vi.fn>
  byFeature: ReturnType<typeof vi.fn>
  byModel: ReturnType<typeof vi.fn>
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    children,
  )
}

describe('useAiUsageMetricsPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('period=day → metrics 호출 + 정상 data', async () => {
    mocked.metrics.mockResolvedValue({
      period: 'day',
      from: '2026-06-08T00:00:00Z',
      to: '2026-06-09T00:00:00Z',
      totalCostUsd: 10.5,
      totalCalls: 100,
      cacheHitRate: 0.3,
      errorRate: 0.05,
      delta: {
        previousCostUsd: 5,
        previousCalls: 50,
        costDeltaPct: 110,
        callsDeltaPct: 100,
      },
    })

    const { result } = renderHook(() => useAiUsageMetricsPeriod('day'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocked.metrics).toHaveBeenCalledWith('day')
    expect(result.current.data?.totalCostUsd).toBe(10.5)
    expect(result.current.data?.delta.costDeltaPct).toBe(110)
  })

  it('period 5 (day/week/month/quarter/year) — 각 period 별 cache key 격리', async () => {
    mocked.metrics.mockResolvedValue({
      period: 'week',
      from: '',
      to: '',
      totalCostUsd: 0,
      totalCalls: 0,
      cacheHitRate: 0,
      errorRate: 0,
      delta: {
        previousCostUsd: 0,
        previousCalls: 0,
        costDeltaPct: 0,
        callsDeltaPct: 0,
      },
    })

    const { rerender } = renderHook(
      ({ p }: { p: 'day' | 'week' }) => useAiUsageMetricsPeriod(p),
      { wrapper, initialProps: { p: 'day' as 'day' | 'week' } },
    )

    await waitFor(() => expect(mocked.metrics).toHaveBeenCalledWith('day'))
    rerender({ p: 'week' })
    await waitFor(() => expect(mocked.metrics).toHaveBeenCalledWith('week'))
    expect(mocked.metrics).toHaveBeenCalledTimes(2)
  })

  it('빈 데이터 — totalCostUsd=0, deltaPct=0 안전', async () => {
    mocked.metrics.mockResolvedValue({
      period: 'day',
      from: '',
      to: '',
      totalCostUsd: 0,
      totalCalls: 0,
      cacheHitRate: 0,
      errorRate: 0,
      delta: {
        previousCostUsd: 0,
        previousCalls: 0,
        costDeltaPct: 0,
        callsDeltaPct: 0,
      },
    })

    const { result } = renderHook(() => useAiUsageMetricsPeriod('day'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.totalCostUsd).toBe(0)
    expect(result.current.data?.cacheHitRate).toBe(0)
  })

  it('API 에러 → isError true', async () => {
    mocked.metrics.mockRejectedValue(new Error('500'))

    const { result } = renderHook(() => useAiUsageMetricsPeriod('day'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useAiUsageTopUsersPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('limit default 20', async () => {
    mocked.topUsers.mockResolvedValue([])

    renderHook(() => useAiUsageTopUsersPeriod('day'), { wrapper })

    await waitFor(() => expect(mocked.topUsers).toHaveBeenCalled())
    expect(mocked.topUsers).toHaveBeenCalledWith('day', 20)
  })

  it('custom limit 전달', async () => {
    mocked.topUsers.mockResolvedValue([])

    renderHook(() => useAiUsageTopUsersPeriod('week', 50), { wrapper })

    await waitFor(() => expect(mocked.topUsers).toHaveBeenCalled())
    expect(mocked.topUsers).toHaveBeenCalledWith('week', 50)
  })

  it('정상 결과 — top users 배열', async () => {
    mocked.topUsers.mockResolvedValue([
      { userId: 'u-1', nickname: 'A', totalCostUsd: 12.5, totalCalls: 50 },
    ])

    const { result } = renderHook(() => useAiUsageTopUsersPeriod('day'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].nickname).toBe('A')
  })
})

describe('useAiUsageByFeaturePeriod / useAiUsageByModelPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('byFeature — feature 별 cost 정상', async () => {
    mocked.byFeature.mockResolvedValue([
      { feature: 'company_research', totalCostUsd: 20.5, totalCalls: 100 },
    ])

    const { result } = renderHook(() => useAiUsageByFeaturePeriod('month'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].feature).toBe('company_research')
  })

  it('byModel — model 별 cost 정상', async () => {
    mocked.byModel.mockResolvedValue([
      { model: 'claude-haiku-4-5', totalCostUsd: 15, totalCalls: 50 },
    ])

    const { result } = renderHook(() => useAiUsageByModelPeriod('month'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].model).toBe('claude-haiku-4-5')
  })
})
