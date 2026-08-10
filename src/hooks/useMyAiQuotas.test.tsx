/**
 * AI 쿼터 조회 — **`enabled: false` 면 네트워크를 타지 않는다.**
 *
 * 🔴 **왜 필요했나** (2026-08-09). 랜딩이 제품 컴포넌트를 실물로 렌더하면서
 * `InterviewQuestionCard` 가 이 훅 체인을 타고 **비로그인 방문자가 `/me/ai-quotas` 를 호출**했다.
 * 401 이 나자 refresh 재시도까지 연쇄돼 **요청 30건 + "많은 새로고침 요청" 토스트**가 떴다.
 *
 * 🔴 **`useAiQuotaBlocked` 안에는 `useQuery` 가 없다** — 그래서 "query 0개" 라고 단정했는데
 * **한 단계 아래 `useMyAiQuotas`** 에 있었다. 그 체인 전체를 여기서 잠근다.
 *
 * `refetchOnMount: 'always'` 라 **마운트만 해도** 요청이 나가는 훅이므로,
 * 끄는 경로가 실제로 막히는지가 이 파일의 전부다.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { useMyAiQuotas, useAiQuotaBlocked } from './useMyAiQuotas'
import { aiQuotaApi } from '@/api/aiQuota'

vi.mock('@/api/aiQuota', () => ({
  aiQuotaApi: { getMyQuotas: vi.fn(() => Promise.resolve([])) },
}))

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useMyAiQuotas — enabled 게이트', () => {
  beforeEach(() => vi.mocked(aiQuotaApi.getMyQuotas).mockClear())

  it('기본값은 조회한다 (기존 동작 무변경)', async () => {
    renderHook(() => useMyAiQuotas(), { wrapper: wrap() })
    await waitFor(() => expect(aiQuotaApi.getMyQuotas).toHaveBeenCalled())
  })

  it('🔴 enabled: false → 마운트해도 요청이 나가지 않는다', async () => {
    renderHook(() => useMyAiQuotas({ enabled: false }), { wrapper: wrap() })
    // 켜져 있었다면 이 사이에 나갔을 시간
    await new Promise((r) => setTimeout(r, 50))
    expect(aiQuotaApi.getMyQuotas).not.toHaveBeenCalled()
  })

  /**
   * 🔴 **체인 전체를 확인한다.** `useAiQuotaBlocked → useMyAiQuota → useMyAiQuotas` 로
   * 두 단계를 거치는데, 중간에서 옵션을 떨어뜨리면 게이트가 조용히 무력화된다.
   * 실제로 그 "한 단계 아래" 를 못 봐서 사고가 났다.
   */
  it('🔴 useAiQuotaBlocked 의 enabled 가 두 단계 아래까지 전달된다', async () => {
    renderHook(() => useAiQuotaBlocked('interview_prep_answer', { enabled: false }), {
      wrapper: wrap(),
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(aiQuotaApi.getMyQuotas).not.toHaveBeenCalled()
  })

  it('useAiQuotaBlocked 기본값은 조회한다', async () => {
    renderHook(() => useAiQuotaBlocked('interview_prep_answer'), { wrapper: wrap() })
    await waitFor(() => expect(aiQuotaApi.getMyQuotas).toHaveBeenCalled())
  })
})
