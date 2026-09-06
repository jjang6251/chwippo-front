/**
 * useExtension — 캐시 무효화 경계.
 *
 * 시나리오:
 * 1. `useExtensionSessions` 가 목록을 읽는다
 * 2. `useCreatePairCode` 는 목록을 무효화하지 **않는다** (코드만으로는 세션이 안 생긴다)
 * 3. `useDisconnectExtension` 은 성공 시 목록을 무효화한다 (해제된 행이 남으면 또 누른다)
 * 4. 해제 실패 시에는 무효화하지 않는다
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const api = vi.hoisted(() => ({
  listSessions: vi.fn(),
  createPairCode: vi.fn(),
  disconnect: vi.fn(),
}))
vi.mock('@/api/extension', () => ({ extensionApi: api }))

import {
  useCreatePairCode,
  useDisconnectExtension,
  useExtensionSessions,
} from './useExtension'

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listSessions.mockResolvedValue([])
  api.createPairCode.mockResolvedValue({
    code: '638836',
    expiresAt: '2026-09-06T04:07:38.066Z',
    ttlSeconds: 60,
  })
  api.disconnect.mockResolvedValue({ disconnected: 1 })
})

describe('useExtensionSessions', () => {
  it('목록을 읽는다', async () => {
    const { result } = renderHook(() => useExtensionSessions(), {
      wrapper: wrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.listSessions).toHaveBeenCalledTimes(1)
  })

  it('enabled:false 면 요청하지 않는다', async () => {
    renderHook(() => useExtensionSessions({ enabled: false }), {
      wrapper: wrapper(),
    })
    await Promise.resolve()
    expect(api.listSessions).not.toHaveBeenCalled()
  })
})

describe('useCreatePairCode', () => {
  /** 코드를 뽑는 것만으로는 세션이 안 생긴다 — 무효화하면 헛 요청만 는다 */
  it('성공해도 목록을 다시 읽지 않는다', async () => {
    const wrap = wrapper()
    const { result } = renderHook(
      () => ({
        sessions: useExtensionSessions(),
        create: useCreatePairCode(),
      }),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.sessions.isSuccess).toBe(true))
    const before = api.listSessions.mock.calls.length

    result.current.create.mutate()
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true))

    expect(api.listSessions.mock.calls.length).toBe(before)
  })
})

describe('useDisconnectExtension', () => {
  it('성공 시 목록을 다시 읽는다', async () => {
    const wrap = wrapper()
    const { result } = renderHook(
      () => ({
        sessions: useExtensionSessions(),
        disconnect: useDisconnectExtension(),
      }),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.sessions.isSuccess).toBe(true))
    const before = api.listSessions.mock.calls.length

    result.current.disconnect.mutate('sess-1')
    await waitFor(() => expect(result.current.disconnect.isSuccess).toBe(true))

    await waitFor(() =>
      expect(api.listSessions.mock.calls.length).toBe(before + 1),
    )
    expect(api.disconnect).toHaveBeenCalledWith('sess-1')
  })

  it('실패 시에는 다시 읽지 않는다', async () => {
    api.disconnect.mockRejectedValueOnce(new Error('500'))
    const wrap = wrapper()
    const { result } = renderHook(
      () => ({
        sessions: useExtensionSessions(),
        disconnect: useDisconnectExtension(),
      }),
      { wrapper: wrap },
    )
    await waitFor(() => expect(result.current.sessions.isSuccess).toBe(true))
    const before = api.listSessions.mock.calls.length

    result.current.disconnect.mutate('sess-1')
    await waitFor(() => expect(result.current.disconnect.isError).toBe(true))

    expect(api.listSessions.mock.calls.length).toBe(before)
  })
})
