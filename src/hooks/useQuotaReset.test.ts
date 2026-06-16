/**
 * F6 PR 2 Phase 5.6.9 — useResetAiQuota.
 *
 * 매트릭스 #12 — onSuccess → me/ai-quotas + note-summary-status invalidate
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/quotaReset', () => ({
  quotaResetApi: { reset: vi.fn() },
}))

import { quotaResetApi } from '@/api/quotaReset'
import { useResetAiQuota } from './useQuotaReset'

const resetMock = vi.mocked(quotaResetApi.reset)

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  function Wrap({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
  return { qc, invalidateSpy, Wrap }
}

describe('useResetAiQuota (5.6.9)', () => {
  beforeEach(() => resetMock.mockReset())

  it('12-a) reset({}) 전체 → mutation 호출 + me/ai-quotas invalidate', async () => {
    resetMock.mockResolvedValue({ affected: 5, scope: 'all_users' })
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(() => useResetAiQuota(), { wrapper: Wrap })
    result.current.mutate({})
    await waitFor(() => expect(resetMock).toHaveBeenCalledWith({}))
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['me', 'ai-quotas'],
    })
  })

  it('12-b) reset({userId}) 특정 사용자 → mutation 호출 + note-summary-status invalidate', async () => {
    resetMock.mockResolvedValue({ affected: 1, scope: 'single_user' })
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(() => useResetAiQuota(), { wrapper: Wrap })
    result.current.mutate({ userId: 'u-1' })
    await waitFor(() => expect(resetMock).toHaveBeenCalledWith({ userId: 'u-1' }))
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['note-summary-status'],
    })
  })

  it('12-c) reset 실패 → mutation error, invalidate 호출 안 됨', async () => {
    resetMock.mockRejectedValueOnce(new Error('forbidden'))
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(() => useResetAiQuota(), { wrapper: Wrap })
    let caught = false
    result.current.mutate({}, { onError: () => (caught = true) })
    await waitFor(() => expect(caught).toBe(true))
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['me', 'ai-quotas'],
    })
  })
})
