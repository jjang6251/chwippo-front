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
