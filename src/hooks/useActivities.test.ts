/**
 * F6 PR 2 Phase 5.6.8 — useNoteSummaryStatus hook + useSummarizeLog invalidate 검증.
 *
 * 매트릭스:
 *   1. logId 있음 → API 호출 + perNoteUsed/Limit/Remaining 반환
 *   2. logId undefined → enabled=false → API 호출 X
 *   3. staleTime=0 + refetchOnMount='always' → mount 시 항상 fetch
 *   4. useSummarizeLog onSuccess → note-summary-status invalidate (logId 별)
 *   5. useSummarizeLog onSuccess → me/ai-quotas invalidate
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/activity', () => ({
  activityApi: {
    summarizeStatus: vi.fn(),
    summarizeLog: vi.fn(),
    listActivities: vi.fn().mockResolvedValue([]),
    listActivityLogs: vi.fn().mockResolvedValue([]),
    listReflections: vi.fn().mockResolvedValue([]),
  },
}))

import { activityApi } from '@/api/activity'
import {
  useNoteSummaryStatus,
  useSummarizeLog,
} from './useActivities'

const statusMock = vi.mocked(activityApi.summarizeStatus)
const summarizeMock = vi.mocked(activityApi.summarizeLog)

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  function Wrap({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
  return { qc, invalidateSpy, Wrap }
}

describe('useNoteSummaryStatus', () => {
  beforeEach(() => {
    statusMock.mockReset()
    summarizeMock.mockReset()
  })

  it('1) logId 있음 → API 호출 + 정상 응답', async () => {
    statusMock.mockResolvedValue({
      perNoteUsed: 2,
      perNoteLimit: 5,
      remainingPerNote: 3,
    })
    const { Wrap } = makeWrapper()
    const { result } = renderHook(() => useNoteSummaryStatus('log-1'), {
      wrapper: Wrap,
    })
    await waitFor(() => expect(statusMock).toHaveBeenCalledWith('log-1'))
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toEqual({
      perNoteUsed: 2,
      perNoteLimit: 5,
      remainingPerNote: 3,
    })
  })

  it('2) logId undefined → enabled=false → API 호출 X', async () => {
    const { Wrap } = makeWrapper()
    renderHook(() => useNoteSummaryStatus(undefined), { wrapper: Wrap })
    await new Promise((r) => setTimeout(r, 30))
    expect(statusMock).not.toHaveBeenCalled()
  })

  it('3) invalidate 후 → 즉시 refetch (staleTime=0)', async () => {
    statusMock.mockResolvedValue({
      perNoteUsed: 0,
      perNoteLimit: 5,
      remainingPerNote: 5,
    })
    const { qc, Wrap } = makeWrapper()
    renderHook(() => useNoteSummaryStatus('log-1'), { wrapper: Wrap })
    await waitFor(() => expect(statusMock).toHaveBeenCalledTimes(1))
    await qc.invalidateQueries({ queryKey: ['note-summary-status', 'log-1'] })
    await waitFor(() => expect(statusMock).toHaveBeenCalledTimes(2))
  })
})

describe('useSummarizeLog invalidate (5.6.8 추가)', () => {
  beforeEach(() => {
    summarizeMock.mockReset()
    statusMock.mockReset()
  })

  it('4) onSuccess → note-summary-status invalidate (logId 별)', async () => {
    summarizeMock.mockResolvedValue({
      status: 'ok',
      summary: '요약',
      cached: false,
      perNoteLimit: 5,
      remainingPerNote: 4,
    } as never)
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(() => useSummarizeLog('act-1'), {
      wrapper: Wrap,
    })
    result.current.mutate({ logId: 'log-1', force: false })
    await waitFor(() => expect(summarizeMock).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['note-summary-status', 'log-1'],
    })
  })

  it('5) onSuccess → me/ai-quotas invalidate (총 잔여 chip 갱신)', async () => {
    summarizeMock.mockResolvedValue({
      status: 'ok',
      summary: '요약',
      cached: false,
      perNoteLimit: 5,
      remainingPerNote: 4,
    } as never)
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(() => useSummarizeLog('act-1'), {
      wrapper: Wrap,
    })
    result.current.mutate({ logId: 'log-1', force: false })
    await waitFor(() => expect(summarizeMock).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['me', 'ai-quotas'],
    })
  })
})
