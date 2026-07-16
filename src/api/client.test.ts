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
import { postToNative } from '@/utils/nativeBridge'

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

vi.mock('@/utils/nativeBridge', () => ({
  postToNative: vi.fn(),
}))

const mockedAxiosPost = vi.mocked(axios.post)
const mockedPostToNative = vi.mocked(postToNative)

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
    const result = await performRefresh()
    expect(result.accessToken).toBe('new-token')
    expect(result.user).toBeNull()
    expect(useAuthStore.getState().accessToken).toBe('new-token')
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
  })

  it('user 포함 응답 → setUser도 호출 + 반환값에 user 포함', async () => {
    const user = {
      id: 'u1',
      nickname: 'tester',
      email: 'a@b.c',
      role: 'user' as const,
      onboardedAt: null,
      termsAgreedAt: '2026-01-01T00:00:00.000Z',
    }
    mockedAxiosPost.mockResolvedValueOnce({
      data: { accessToken: 'tok', user },
    })
    const result = await performRefresh()
    expect(result.accessToken).toBe('tok')
    expect(result.user).toEqual(user)
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('user 없는 응답 → setUser 호출 안 됨 (기존 user 유지)', async () => {
    const existing = {
      id: 'u1',
      nickname: 'before',
      email: null,
      role: 'user' as const,
      onboardedAt: null,
      termsAgreedAt: null, aiConsentAt: null, aiConsentVersion: null, onboardedCoinAt: null, signupJobCategories: null, signupOtherText: null, sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
    }
    useAuthStore.setState({ user: existing })
    mockedAxiosPost.mockResolvedValueOnce({
      data: { accessToken: 'tok' },
    })
    await performRefresh()
    expect(useAuthStore.getState().user).toEqual(existing)
  })

  it('409 경합 → backoff 후 재시도 성공 (세션 유지·로그아웃 안 함)', async () => {
    mockedAxiosPost
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'RETRY' } } })
      .mockResolvedValueOnce({
        data: { data: { accessToken: 'retry-tok' }, message: 'ok' },
      })
    const result = await performRefresh()
    expect(result.accessToken).toBe('retry-tok')
    expect(mockedAxiosPost).toHaveBeenCalledTimes(2) // 최초 409 + 재시도 성공
    expect(useAuthStore.getState().accessToken).toBe('retry-tok')
  })

  it('409 재시도 3회 소진 → throw (단 window redirect·clearAuth 안 함)', async () => {
    useAuthStore.setState({ accessToken: 'keep', user: null })
    mockedAxiosPost.mockRejectedValue({ response: { status: 409 } })
    await expect(performRefresh()).rejects.toBeDefined()
    expect(mockedAxiosPost).toHaveBeenCalledTimes(3)
    // handleAuthFailure(409) 는 세션 유지 — clearAuth·redirect 금지
    expect(window.location.href).toBe('')
  })

  it('동시 5개 호출 → axios.post 1번만 (queue 동작) + 모두 같은 결과', async () => {
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
    expect(results.map((r) => r.accessToken)).toEqual([
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
    expect(r1.accessToken).toBe('t1')
    expect(r2.accessToken).toBe('t2')
    expect(mockedAxiosPost).toHaveBeenCalledTimes(2)
  })

  it('wrap 없는 응답 (data.accessToken) fallback 지원', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { accessToken: 'flat-token' },
    })
    const result = await performRefresh()
    expect(result.accessToken).toBe('flat-token')
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
        termsAgreedAt: null, aiConsentAt: null, aiConsentVersion: null, onboardedCoinAt: null, signupJobCategories: null, signupOtherText: null, sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
      },
    })
    handleAuthFailure(new Error('x'))
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(window.location.href).toBe('/')
  })

  it('429 → 세션 유지 (clearAuth/redirect 안 함) + rate limit 토스트', () => {
    const existingUser = {
      id: 'u',
      nickname: 'n',
      email: null,
      role: 'user' as const,
      onboardedAt: null,
      termsAgreedAt: null, aiConsentAt: null, aiConsentVersion: null, onboardedCoinAt: null, signupJobCategories: null, signupOtherText: null, sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
    }
    useAuthStore.setState({ accessToken: 'keep-me', user: existingUser })
    handleAuthFailure({ response: { status: 429 } })
    // 세션 유지
    expect(useAuthStore.getState().accessToken).toBe('keep-me')
    expect(useAuthStore.getState().user).toEqual(existingUser)
    // redirect 안 함
    expect(window.location.href).toBe('')
    // rate limit 토스트
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('잠시'),
    )
  })

  it('409 → 세션 유지 (clearAuth/redirect 안 함, refresh 경합)', () => {
    useAuthStore.setState({ accessToken: 'keep-me', user: null })
    handleAuthFailure({ response: { status: 409 } })
    expect(useAuthStore.getState().accessToken).toBe('keep-me')
    expect(window.location.href).toBe('')
  })

  it('429가 아닌 모든 status는 기존 로직 (401, 500 등) — clearAuth + redirect', () => {
    useAuthStore.setState({ accessToken: 'a', user: null })
    handleAuthFailure({ response: { status: 401 } })
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(window.location.href).toBe('/')
  })
})

// 네이티브(WebView) 세션만료 동기화 — 401 확정일 때만 postToNative({type:'logout'}) 전파.
// 오탐 전파(네트워크·5xx·409·429·데모)를 못박아 계정 교차·오프라인 로그아웃을 차단한다.
describe('handleAuthFailure — 네이티브 로그아웃 전파 (401 한정)', () => {
  it('401 → postToNative({type:logout}) 호출됨', () => {
    handleAuthFailure({ response: { status: 401 } })
    expect(mockedPostToNative).toHaveBeenCalledTimes(1)
    expect(mockedPostToNative).toHaveBeenCalledWith({ type: 'logout' })
  })

  it('409 → 전파 안 함 (refresh 경합, 세션 유효)', () => {
    handleAuthFailure({ response: { status: 409 } })
    expect(mockedPostToNative).not.toHaveBeenCalled()
  })

  it('429 → 전파 안 함 (rate limit, 세션 유효)', () => {
    handleAuthFailure({ response: { status: 429 } })
    expect(mockedPostToNative).not.toHaveBeenCalled()
  })

  it('네트워크 오류 (response 없음) → 전파 안 함 (오프라인 로그아웃 방지)', () => {
    handleAuthFailure(new Error('Network Error'))
    expect(mockedPostToNative).not.toHaveBeenCalled()
  })

  it('500 → 전파 안 함 (백엔드 순단, 세션 유효 가능)', () => {
    handleAuthFailure({ response: { status: 500 } })
    expect(mockedPostToNative).not.toHaveBeenCalled()
  })

  it('데모 경로 → 전파 안 함 (early-return 선행)', () => {
    Object.defineProperty(window, 'location', {
      value: { href: '', pathname: '/demo/calendar' },
      writable: true,
    })
    handleAuthFailure({ response: { status: 401 } })
    expect(mockedPostToNative).not.toHaveBeenCalled()
  })
})
