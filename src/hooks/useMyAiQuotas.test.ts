/**
 * F6 PR 2 Phase 5.1 — useAiQuotaBlocked 테스트.
 * 5곳에서 button disabled 판단에 사용. quota 우선순위:
 *   1. quota 미로드 (undefined) → blocked=false (silent — 정상 동작)
 *   2. enabled=false → blocked (kill switch)
 *   3. cooldown (nextAvailableAt 미래) → blocked
 *   4. dayUsed >= dayLimit → blocked
 *   5. monthUsed >= monthLimit → blocked
 *   6. 그 외 → blocked=false
 */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiQuotaBlocked } from './useMyAiQuotas'
import { aiQuotaApi } from '@/api/aiQuota'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MyAiQuotaRow } from '@/types/aiQuota'
import type { ReactNode } from 'react'
import React from 'react'

vi.mock('@/api/aiQuota', () => ({
  aiQuotaApi: { getMyQuotas: vi.fn() },
}))

const apiMock = vi.mocked(aiQuotaApi.getMyQuotas)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

async function renderBlocked(row: MyAiQuotaRow | null) {
  apiMock.mockResolvedValue(row ? [row] : [])
  const hook = renderHook(() => useAiQuotaBlocked('note_summary'), { wrapper })
  // useQuery 가 비동기 resolve 될 때까지 microtask flush
  await new Promise((r) => setTimeout(r, 0))
  hook.rerender()
  return hook
}

describe('useAiQuotaBlocked', () => {
  beforeEach(() => apiMock.mockReset())

  it('quota 미로드 → blocked=false (silent)', async () => {
    const { result } = await renderBlocked(null)
    expect(result.current).toEqual({ blocked: false, reason: null })
  })

  it('enabled=false → blocked + 🚧', async () => {
    const { result } = await renderBlocked({
      feature: 'note_summary',
      enabled: false,
      dayUsed: 0,
      dayLimit: 5,
      monthUsed: 0,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    expect(result.current.blocked).toBe(true)
    expect(result.current.reason).toContain('🚧')
  })

  it('cooldown (nextAvailableAt 미래) → blocked', async () => {
    const { result } = await renderBlocked({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 1,
      dayLimit: 5,
      monthUsed: 1,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: new Date(Date.now() + 10_000).toISOString(),
    })
    expect(result.current.blocked).toBe(true)
    expect(result.current.reason).toContain('⏳')
  })

  it('day 한도 도달 → blocked', async () => {
    const { result } = await renderBlocked({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 5,
      dayLimit: 5,
      monthUsed: 5,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    expect(result.current.blocked).toBe(true)
    expect(result.current.reason).toBe('오늘 한도 소진')
  })

  it('month 한도 도달 → blocked', async () => {
    const { result } = await renderBlocked({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 1,
      dayLimit: 5,
      monthUsed: 100,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    expect(result.current.blocked).toBe(true)
    expect(result.current.reason).toBe('이번 달 한도 소진')
  })

  it('정상 (잔여 있음) → blocked=false', async () => {
    const { result } = await renderBlocked({
      feature: 'note_summary',
      enabled: true,
      dayUsed: 2,
      dayLimit: 5,
      monthUsed: 10,
      monthLimit: 100,
      cooldownSeconds: 30,
      nextAvailableAt: null,
    })
    expect(result.current).toEqual({ blocked: false, reason: null })
  })
})

// ── 5.6.소급 — useMyAiQuotas refetch 정책 (staleTime=0 + refetchOnMount + invalidate) ──
describe('useMyAiQuotas refetch 정책', () => {
  beforeEach(() => apiMock.mockReset())

  it('1) 초기 mount → API 호출 1회', async () => {
    apiMock.mockResolvedValue([])
    const { useMyAiQuotas } = await import('./useMyAiQuotas')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrap({ children }: { children: ReactNode }) {
      return React.createElement(QueryClientProvider, { client: qc }, children)
    }
    renderHook(() => useMyAiQuotas(), { wrapper: Wrap })
    await new Promise((r) => setTimeout(r, 0))
    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  it('2) staleTime=0 + invalidate → 즉시 refetch', async () => {
    apiMock.mockResolvedValue([])
    const { useMyAiQuotas } = await import('./useMyAiQuotas')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrap({ children }: { children: ReactNode }) {
      return React.createElement(QueryClientProvider, { client: qc }, children)
    }
    renderHook(() => useMyAiQuotas(), { wrapper: Wrap })
    await new Promise((r) => setTimeout(r, 0))
    expect(apiMock).toHaveBeenCalledTimes(1)
    // invalidate 후 active observer 면 refetch
    await qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
    await new Promise((r) => setTimeout(r, 0))
    expect(apiMock).toHaveBeenCalledTimes(2)
  })

  // useNoteSummaryStatus 와 같은 파일에 두기엔 mock 충돌 — 별도 파일 (useActivities.test.ts) 에서 다룸
  it('3) 5곳 동시 mount (같은 queryKey) → dedup 으로 API 1번', async () => {
    apiMock.mockResolvedValue([])
    const { useMyAiQuotas } = await import('./useMyAiQuotas')
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrap({ children }: { children: ReactNode }) {
      return React.createElement(QueryClientProvider, { client: qc }, children)
    }
    // 5곳 부착 시뮬레이션 — 같은 hook 5번 mount
    renderHook(
      () => {
        useMyAiQuotas()
        useMyAiQuotas()
        useMyAiQuotas()
        useMyAiQuotas()
        useMyAiQuotas()
      },
      { wrapper: Wrap },
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(apiMock).toHaveBeenCalledTimes(1) // React Query 자동 dedup
  })
})
