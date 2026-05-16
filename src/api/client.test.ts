/**
 * api/client.ts 단위 테스트 — performRefresh queue + handleAuthFailure
 *
 * 시나리오:
 * - performRefresh 단일 호출 → axios.post 1번 + setAccessToken + 반환
 * - 동시 호출 → axios.post 1번만 (queue 동작)
 * - 성공 후 reset → 다음 호출 시 axios.post 또 호출
 * - accessToken 누락 응답 → throw (defensive)
 * - 실패 시 handleAuthFailure 1번만 호출 (catch 단일성)
 * - handleAuthFailure: 정지 메시지 / 만료 메시지 분기
 * - handleAuthFailure: clearAuth + redirect 호출
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import {
  performRefresh,
  handleAuthFailure,
  __resetRefreshPromiseForTest,
} from './client'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios')
  return {
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        // apiClient는 mock 객체 — 본 테스트에선 직접 안 씀
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
      })),
      post: vi.fn(),
    },
  }
})

vi.mock('@/stores/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const mockedAxiosPost = vi.mocked(axios.post)

beforeEach(() => {
  vi.clearAllMocks()
  __resetRefreshPromiseForTest()
  useAuthStore.getState().clearAuth()
  // window.location.href 안전 mock
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  })
})

afterEach(() => {
  __resetRefreshPromiseForTest()
})

describe('performRefresh', () => {
  it('정상 응답 → setAccessToken + accessToken 반환', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'new-token' }, message: 'ok' },
    })
    const token = await performRefresh()
    expect(token).toBe('new-token')
    expect(useAuthStore.getState().accessToken).toBe('new-token')
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
  })

  it('동시 5개 호출 → axios.post 1번만 (queue 동작)', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'shared-token' } },
    })
    const results = await Promise.all([
      performRefresh(),
      performRefresh(),
      performRefresh(),
      performRefresh(),
      performRefresh(),
    ])
    expect(results).toEqual([
      'shared-token',
      'shared-token',
      'shared-token',
      'shared-token',
      'shared-token',
    ])
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
  })

  it('성공 완료 후 새 호출 → axios.post 또 호출 (finally reset)', async () => {
    mockedAxiosPost
      .mockResolvedValueOnce({ data: { data: { accessToken: 't1' } } })
      .mockResolvedValueOnce({ data: { data: { accessToken: 't2' } } })
    const r1 = await performRefresh()
    const r2 = await performRefresh()
    expect(r1).toBe('t1')
    expect(r2).toBe('t2')
    expect(mockedAxiosPost).toHaveBeenCalledTimes(2)
  })

  it('wrap 없는 응답 (data.accessToken) fallback 지원', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { accessToken: 'flat-token' },
    })
    const token = await performRefresh()
    expect(token).toBe('flat-token')
  })

  it('accessToken 없는 응답 → throw (defensive)', async () => {
    mockedAxiosPost.mockResolvedValueOnce({ data: {} })
    await expect(performRefresh()).rejects.toThrow(
      /accessToken/i,
    )
  })

  it('실패 시 동시 caller 모두 reject + handleAuthFailure 1번만 호출', async () => {
    mockedAxiosPost.mockRejectedValueOnce(
      Object.assign(new Error('refresh fail'), {
        response: { data: { message: '로그인이 만료되었습니다.' } },
      }),
    )
    const results = await Promise.allSettled([
      performRefresh(),
      performRefresh(),
      performRefresh(),
    ])
    // 모두 reject
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    // handleAuthFailure 부수효과 — 1번만
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('로그인이 만료되었습니다.')
  })
})

describe('handleAuthFailure', () => {
  it("'정지' 메시지 포함 → 정지 toast", () => {
    handleAuthFailure({
      response: { data: { message: '계정이 정지되었습니다.' } },
    })
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('정지'),
    )
  })

  it('일반 에러 (메시지 없음) → 만료 toast', () => {
    handleAuthFailure(new Error('network'))
    expect(toast.error).toHaveBeenCalledWith('로그인이 만료되었습니다.')
  })

  it('clearAuth 호출 + window.location.href 갱신', () => {
    useAuthStore.setState({
      accessToken: 'some',
      user: {
        id: 'u',
        nickname: 'n',
        email: null,
        role: 'user',
        onboardedAt: null,
        termsAgreedAt: null,
      },
    })
    handleAuthFailure(new Error('x'))
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(window.location.href).toBe('/')
  })
})
