/**
 * 직무 게이트 훅 실동작 — **직무가 있으면 모달이 뜨지 않는다**.
 *
 * 🔴 이게 깨지면 직무를 이미 적은 사용자가 AI 를 누를 때마다 모달을 보게 된다.
 * 가장 흔한 원인은 "프론트가 보는 응답에 `jobTitle` 이 없는 경우" 라서,
 * 서버 응답을 그대로 흉내 낸 fixture 로 태운다 (규칙만 단위 검증하면 못 잡는다).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRequireJobTitle } from './useRequireJobTitle'
import { useJobTitleGateStore } from '@/stores/jobTitleGateStore'

const getMock = vi.fn()
vi.mock('@/api/applications', () => ({
  applicationsApi: { get: (id: string) => getMock(id) },
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

/** GET /applications/:id 응답 모양 (백엔드는 엔티티를 whitelist 없이 그대로 준다) */
const app = (over: Record<string, unknown> = {}) => ({
  id: 'app-1',
  companyName: '카카오',
  jobTitle: null,
  jobCategory: null,
  status: 'IN_PROGRESS',
  steps: [],
  ...over,
})

describe('useRequireJobTitle — 직무가 있으면 모달이 뜨지 않는다', () => {
  beforeEach(() => {
    getMock.mockReset()
    useJobTitleGateStore.setState({ applicationId: null, _resolve: null })
  })

  it.each([
    ['jobTitle 만', { jobTitle: '백엔드 개발자', jobCategory: null }],
    ['jobCategory 만', { jobTitle: null, jobCategory: 'IT개발' }],
    ['둘 다', { jobTitle: '백엔드 개발자', jobCategory: '금융' }],
  ])('%s 있으면 즉시 통과 + 모달 미오픈', async (_label, over) => {
    getMock.mockResolvedValue(app(over))
    const { result } = renderHook(() => useRequireJobTitle('app-1'), {
      wrapper,
    })
    await expect(result.current()).resolves.toBe(true)
    expect(useJobTitleGateStore.getState().applicationId).toBeNull()
  })

  it('연속 호출해도 계속 통과한다 — 반복 노출 회귀', async () => {
    getMock.mockResolvedValue(app({ jobTitle: '백엔드 개발자' }))
    const { result } = renderHook(() => useRequireJobTitle('app-1'), {
      wrapper,
    })
    for (let i = 0; i < 3; i++) {
      await expect(result.current()).resolves.toBe(true)
    }
    expect(useJobTitleGateStore.getState().applicationId).toBeNull()
  })

  it('🔴 공백만 있는 건 "있는 것" 이 아니다 — 모달을 연다', async () => {
    getMock.mockResolvedValue(app({ jobTitle: '   ', jobCategory: '  ' }))
    const { result } = renderHook(() => useRequireJobTitle('app-1'), {
      wrapper,
    })
    void result.current()
    await waitFor(() =>
      expect(useJobTitleGateStore.getState().applicationId).toBe('app-1'),
    )
  })

  it('직무가 아예 없으면 모달을 연다', async () => {
    getMock.mockResolvedValue(app())
    const { result } = renderHook(() => useRequireJobTitle('app-1'), {
      wrapper,
    })
    void result.current()
    await waitFor(() =>
      expect(useJobTitleGateStore.getState().applicationId).toBe('app-1'),
    )
  })

  it('조회가 실패하면 통과시킨다 — 네트워크 문제로 사용자를 가두지 않는다 (서버가 다시 막는다)', async () => {
    getMock.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useRequireJobTitle('app-1'), {
      wrapper,
    })
    await expect(result.current()).resolves.toBe(true)
    expect(useJobTitleGateStore.getState().applicationId).toBeNull()
  })

  it('applicationId 가 없으면 호출조차 안 한다', async () => {
    const { result } = renderHook(() => useRequireJobTitle(undefined), {
      wrapper,
    })
    await expect(result.current()).resolves.toBe(false)
    expect(getMock).not.toHaveBeenCalled()
  })
})
