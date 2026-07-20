/**
 * card-detail-remodel — 공고 요건은 application.jobPosting 단일 소스.
 * 카드 상세·자소서 어느 쪽에서 parse/edit/delete 해도 ['applications', id] 를 invalidate →
 * 두 표면이 같은 쿼리를 refetch 해 자동 동기화됨을 증명.
 */
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/jobPosting', () => ({
  jobPostingApi: {
    parse: vi.fn().mockResolvedValue({ jobPosting: {}, quota: { used: 1, limit: 5 } }),
    update: vi.fn().mockResolvedValue({ jobPosting: {} }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

import {
  useParseJobPosting,
  useUpdateJobPosting,
  useDeleteJobPosting,
} from './useJobPosting'

let qc: QueryClient
let invalidateSpy: ReturnType<typeof vi.spyOn>

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
})

describe('useJobPosting — 단일 데이터 소스 (같은 쿼리 키 invalidate)', () => {
  it('parse 성공 → ["applications", id] + ["me","ai-quotas"] invalidate', async () => {
    const { result } = renderHook(() => useParseJobPosting('app-1'), { wrapper })
    result.current.mutate('충분히 긴 공고 텍스트입니다 최소 길이 이상으로 입력')
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications', 'app-1'] }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me', 'ai-quotas'] })
  })

  it('update 성공 → ["applications", id] invalidate', async () => {
    const { result } = renderHook(() => useUpdateJobPosting('app-1'), { wrapper })
    result.current.mutate({ requirements: ['x'] })
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications', 'app-1'] }),
    )
  })

  it('delete 성공 → ["applications", id] invalidate', async () => {
    const { result } = renderHook(() => useDeleteJobPosting('app-1'), { wrapper })
    result.current.mutate()
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications', 'app-1'] }),
    )
  })
})
