/**
 * F6 PR 2 Phase 5.6.소급 — useDeleteInterviewSession + AI mutation 의 ai-quotas invalidate 검증.
 *
 * 시나리오 매트릭스:
 *   1. 정상 delete → mutationFn 호출 + applicationId invalidate
 *   2. applicationId undefined → invalidate skip (mutation 만)
 *   3. delete 실패 (404 등) → mutation throw, invalidate 안 됨
 *   4. AI mutation 들 (generate / followup / company research) → ai-quotas invalidate 검증
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/interviewPrep', () => ({
  interviewPrepApi: {
    remove: vi.fn(),
    generate: vi.fn(),
    createFollowup: vi.fn(),
  },
}))

import { interviewPrepApi } from '@/api/interviewPrep'
import {
  useCreateInterviewFollowup,
  useDeleteInterviewSession,
  useGenerateInterviewSession,
} from './useInterviewPrep'

const removeMock = vi.mocked(interviewPrepApi.remove)
const generateMock = vi.mocked(interviewPrepApi.generate)
const followupMock = vi.mocked(interviewPrepApi.createFollowup)

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  function Wrap({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
  return { qc, invalidateSpy, Wrap }
}

describe('useDeleteInterviewSession', () => {
  beforeEach(() => removeMock.mockReset())

  it('1) 정상 delete → mutationFn 호출 + applicationId invalidate', async () => {
    removeMock.mockResolvedValue({} as never)
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(
      () => useDeleteInterviewSession('app-1'),
      { wrapper: Wrap },
    )
    result.current.mutate('session-1')
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('session-1'))
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['interview-prep-sessions', 'app-1'],
    })
  })

  it('2) applicationId undefined → invalidate skip (delete 는 진행)', async () => {
    removeMock.mockResolvedValue({} as never)
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(
      () => useDeleteInterviewSession(undefined),
      { wrapper: Wrap },
    )
    result.current.mutate('session-1')
    await waitFor(() => expect(removeMock).toHaveBeenCalled())
    // applicationId 없으면 invalidate 호출 X
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['interview-prep-sessions']),
      }),
    )
  })

  it('3) delete 실패 → mutation error, invalidate 안 됨', async () => {
    removeMock.mockRejectedValueOnce(new Error('not found'))
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(
      () => useDeleteInterviewSession('app-1'),
      { wrapper: Wrap },
    )
    let caught = false
    result.current.mutate('session-1', { onError: () => (caught = true) })
    await waitFor(() => expect(caught).toBe(true))
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['interview-prep-sessions', 'app-1'],
    })
  })
})

describe('AI mutation → ai-quotas invalidate (5.6.6 검증)', () => {
  it('4) useGenerateInterviewSession onSuccess → ai-quotas invalidate', async () => {
    generateMock.mockResolvedValue({
      status: 'ok',
      meta: { mainCount: 5, followupCount: 10 },
    } as never)
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(
      () => useGenerateInterviewSession('session-1'),
      { wrapper: Wrap },
    )
    result.current.mutate(false)
    await waitFor(() =>
      expect(generateMock).toHaveBeenCalledWith('session-1', false),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['me', 'ai-quotas'],
    })
  })

  it('5) useCreateInterviewFollowup onSuccess → ai-quotas invalidate', async () => {
    followupMock.mockResolvedValue({ status: 'ok', question: { id: 'q-1' } } as never)
    const { invalidateSpy, Wrap } = makeWrapper()
    const { result } = renderHook(
      () => useCreateInterviewFollowup('session-1'),
      { wrapper: Wrap },
    )
    result.current.mutate({ parentQuestionId: 'q-parent' })
    await waitFor(() => expect(followupMock).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['me', 'ai-quotas'],
    })
  })

})
