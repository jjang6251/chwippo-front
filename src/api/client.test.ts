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
 * - handleAuthFailure: 네트워크(응답 없음)·5xx → 비파괴 (콜드스타트 랜딩 flash 수리)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import {
  performRefresh,
  handleAuthFailure,
  jobTitleRequiredApplicationId,
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

// postToNative 만 관찰용으로 바꾸고 isInNativeApp 은 **실제 구현**을 쓴다 —
// 앱 판정은 window.ReactNativeWebView 주입/제거로 재현해야 실제 계약을 검증한다.
vi.mock('@/utils/nativeBridge', async () => {
  const actual =
    await vi.importActual<typeof import('@/utils/nativeBridge')>(
      '@/utils/nativeBridge',
    )
  return { ...actual, postToNative: vi.fn() }
})

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
  // 모드 누수 금지 — 앱 판정이 남으면 다른 케이스가 엉뚱한 이유로 통과한다
  delete (window as unknown as RNWindowMock).ReactNativeWebView
})

interface RNWindowMock {
  ReactNativeWebView?: { postMessage: (data: string) => void }
}

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

  /**
   * 🔴 refresh 단일 주체화 (plan refresh-single-writer, 2026-08-13).
   * 앱에선 웹뷰가 유일 회전자 — 회전 성공마다 네이티브에 새 access 를 밀어줘야
   * 네이티브(푸시 등록·배지 폴링)가 만료 토큰으로 401 을 맞지 않는다.
   * 실패 시엔 보내지 않는다 — 죽은 토큰을 SecureStore 에 밀어넣으면 안 된다.
   */
  it('🔴 회전 성공 → 네이티브에 token 브리지 발신', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'new-token' }, message: 'ok' },
    })
    await performRefresh()
    expect(mockedPostToNative).toHaveBeenCalledWith({
      type: 'token',
      accessToken: 'new-token',
    })
  })

  it('🔴 회전 실패(401) → token 브리지 미발신', async () => {
    mockedAxiosPost.mockRejectedValueOnce({ response: { status: 401 } })
    await expect(performRefresh()).rejects.toBeTruthy()
    expect(mockedPostToNative).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'token' }),
    )
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
    // status 401 명시 — 부수효과(토스트)는 세션 만료 확정일 때만 발생한다.
    mockedAxiosPost.mockRejectedValueOnce(
      Object.assign(new Error('refresh fail'), {
        response: { status: 401, data: { message: '로그인이 만료되었습니다.' } },
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
  // 🔴 status 401 을 명시한다 — 백엔드 jwt-refresh.strategy 는 정지 계정에도
  // UnauthorizedException(401) 을 던진다. status 없는 에러는 "판정 불가" 경로라 조용하다.
  it("'정지' 메시지 포함(401) → 정지 toast", () => {
    handleAuthFailure({
      response: { status: 401, data: { message: '계정이 정지되었습니다.' } },
    })
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('정지'),
    )
  })

  it('401 (메시지 없음) → 만료 toast', () => {
    handleAuthFailure({ response: { status: 401 } })
    expect(toast.error).toHaveBeenCalledWith('로그인이 만료되었습니다.')
  })

  it('401 → clearAuth 호출 + window.location.href 갱신', () => {
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
    handleAuthFailure({ response: { status: 401 } })
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

  it('401 = 세션 만료 확정 → clearAuth + redirect (파괴 경로 유지)', () => {
    useAuthStore.setState({ accessToken: 'a', user: null })
    handleAuthFailure({ response: { status: 401 } })
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(window.location.href).toBe('/')
  })
})

/**
 * 🔴 네트워크(응답 없음)·5xx = 세션 판정 불가 → 부수효과 전부 금지.
 *
 * 실기 증상 (2026-08-12): iOS 콜드스타트에서 네트워크 준비 전 첫 refresh 가 실패하면
 * 여기서 clearAuth + href='/' 를 타 랜딩이 깜빡 떴다 앱으로 복귀했다.
 * 서버가 "세션 죽었다"고 말한 적이 없는 실패는 로그아웃 근거가 못 된다.
 */
describe('handleAuthFailure — 네트워크·5xx 비파괴', () => {
  const keepUser = {
    id: 'u',
    nickname: 'n',
    email: null,
    role: 'user' as const,
    onboardedAt: null,
    termsAgreedAt: null,
    aiConsentAt: null,
    aiConsentVersion: null,
    onboardedCoinAt: null,
    signupJobCategories: null,
    signupOtherText: null,
    sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
  }

  it.each([
    ['네트워크 오류 (response 없음)', new Error('Network Error')],
    ['axios 타임아웃 (response 없음)', { code: 'ECONNABORTED', message: 'timeout' }],
    ['500 Internal Server Error', { response: { status: 500 } }],
    ['502 Bad Gateway', { response: { status: 502 } }],
    ['503 Service Unavailable', { response: { status: 503 } }],
    ['504 Gateway Timeout', { response: { status: 504 } }],
  ])(
    '%s → clearAuth 미호출 · location 미변경 · 토스트 없음 · logout 브리지 미발신',
    (_label, err) => {
      useAuthStore.setState({ accessToken: 'keep-me', user: keepUser })
      handleAuthFailure(err)
      expect(useAuthStore.getState().accessToken).toBe('keep-me')
      expect(useAuthStore.getState().user).toEqual(keepUser)
      expect(window.location.href).toBe('')
      expect(toast.error).not.toHaveBeenCalled()
      expect(mockedPostToNative).not.toHaveBeenCalled()
    },
  )

  it('5xx 메시지에 "정지" 가 들어 있어도 로그아웃하지 않는다 (판정은 401 만)', () => {
    useAuthStore.setState({ accessToken: 'keep-me', user: null })
    handleAuthFailure({
      response: { status: 503, data: { message: '정지된 계정입니다.' } },
    })
    expect(useAuthStore.getState().accessToken).toBe('keep-me')
    expect(window.location.href).toBe('')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('performRefresh 네트워크 실패 → reject 되지만 세션은 그대로 (caller 가 재시도)', async () => {
    useAuthStore.setState({ accessToken: 'keep-me', user: null })
    mockedAxiosPost.mockRejectedValueOnce(new Error('Network Error'))
    await expect(performRefresh()).rejects.toBeDefined()
    expect(useAuthStore.getState().accessToken).toBe('keep-me')
    expect(window.location.href).toBe('')
    expect(toast.error).not.toHaveBeenCalled()
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

/**
 * 🔴 앱 웹뷰 랜딩 깜빡임 — 세션 만료(401) 경로 (2026-08-12).
 *
 * 401 확정이면 브리지를 보내고 네이티브가 로그인 화면으로 바꾼다. 그동안 웹뷰는 계속
 * 보이므로 여기서 랜딩으로 밀면 안 된다. 사용자 로그아웃과 같은 증상을 세션 만료도 겪었다.
 *
 * 시나리오:
 * - 앱 + 401 → href 미변경 · logout 브리지 발신 · clearAuth · 토스트는 그대로
 * - 브라우저 + 401 → 기존대로 href='/'
 * - 앱 + 429/네트워크 → 애초에 파괴 경로 아님 (앱 분기가 이 판정을 흔들지 않는다)
 */
describe('handleAuthFailure — 앱 웹뷰에서는 랜딩으로 밀지 않는다', () => {
  const enterApp = () => {
    ;(window as unknown as RNWindowMock).ReactNativeWebView = {
      postMessage: vi.fn(),
    }
  }

  it('앱 + 401 → href 미변경 · logout 브리지 발신 · clearAuth 는 그대로', () => {
    enterApp()
    useAuthStore.setState({ accessToken: 'dying', user: null })

    handleAuthFailure({ response: { status: 401 } })

    expect(window.location.href).toBe('')
    expect(mockedPostToNative).toHaveBeenCalledWith({ type: 'logout' })
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(toast.error).toHaveBeenCalledWith('로그인이 만료되었습니다.')
  })

  it('브라우저 + 401 → 기존대로 href=/ (웹 경로 무손상)', () => {
    useAuthStore.setState({ accessToken: 'dying', user: null })

    handleAuthFailure({ response: { status: 401 } })

    expect(window.location.href).toBe('/')
    expect(mockedPostToNative).toHaveBeenCalledWith({ type: 'logout' })
  })

  it('앱 + 429·네트워크 → 세션 유지 판정은 그대로 (브리지·href 모두 없음)', () => {
    enterApp()
    useAuthStore.setState({ accessToken: 'keep-me', user: null })

    handleAuthFailure({ response: { status: 429 } })
    handleAuthFailure(new Error('Network Error'))

    expect(useAuthStore.getState().accessToken).toBe('keep-me')
    expect(window.location.href).toBe('')
    expect(mockedPostToNative).not.toHaveBeenCalled()
  })
})


/**
 * 🔴 앱 웹뷰 다중 회전 경합 락 (plan refresh-rotation-lock, 2026-08-13).
 *
 * 탭마다 웹뷰가 1개(최대 5)라 single-flight 큐가 웹뷰마다 따로 있다 — access 만료 후
 * 복귀하면 N개가 같은 RT 쿠키로 동시에 회전해 429·재사용 감지 로그아웃이 났다.
 * 순서만 네이티브가 중재한다: 락 요청 → grant 받은 1명만 HTTP, 나머지는 방송된 토큰으로 해소.
 *
 * 여기서 못박는 계약 (plan §4 케이스 1~8):
 * - 모든 실패 모드가 "현행 이하로 안 나빠짐" — 무응답이면 단독 회전 = 수리 전 동작
 * - 브라우저에선 이 경로 자체가 없다 (리스너 등록조차 안 함)
 */
describe('performRefresh — 앱 웹뷰 회전 락', () => {
  const enterApp = () => {
    ;(window as unknown as RNWindowMock).ReactNativeWebView = {
      postMessage: vi.fn(),
    }
  }

  /** 방금 발신된 락 요청의 reqId — 네이티브가 회신에 그대로 실어 보내는 값 */
  const lockReqId = (): string => {
    const call = mockedPostToNative.mock.calls.find(
      ([m]) => m.type === 'refresh-lock-request',
    )
    if (!call) throw new Error('refresh-lock-request 미발신')
    const msg = call[0]
    if (msg.type !== 'refresh-lock-request') throw new Error('메시지 타입 불일치')
    return msg.reqId
  }

  const grant = (reqId: string) =>
    window.dispatchEvent(
      new CustomEvent('chwippo:refresh-lock-grant', { detail: { reqId } }),
    )

  const queued = (reqId: string) =>
    window.dispatchEvent(
      new CustomEvent('chwippo:refresh-lock-queued', { detail: { reqId } }),
    )

  const broadcast = (accessToken: string) =>
    window.dispatchEvent(
      new CustomEvent('chwippo:token-broadcast', { detail: { accessToken } }),
    )

  const sentTypes = () => mockedPostToNative.mock.calls.map(([m]) => m.type)

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1. grant 수신 → HTTP 회전 1회 + 기존 token 브리지 발신 (락 해제 겸용)', async () => {
    enterApp()
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'granted-token' } },
    })

    const p = performRefresh()
    expect(sentTypes()).toContain('refresh-lock-request')
    expect(mockedAxiosPost).not.toHaveBeenCalled() // grant 전엔 HTTP 금지
    grant(lockReqId())

    const result = await p
    expect(result.accessToken).toBe('granted-token')
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
    expect(mockedPostToNative).toHaveBeenCalledWith({
      type: 'token',
      accessToken: 'granted-token',
    })
    // 성공은 token 이 해제를 겸한다 — 별도 release 를 보내면 락이 두 번 풀린다
    expect(sentTypes()).not.toContain('refresh-lock-release')
  })

  it('2. 대기 중 token-broadcast 수신 → HTTP 0회 + 토큰 반영 후 resolve', async () => {
    enterApp()

    const p = performRefresh()
    broadcast('broadcast-token')

    const result = await p
    expect(result.accessToken).toBe('broadcast-token')
    expect(useAuthStore.getState().accessToken).toBe('broadcast-token')
    expect(mockedAxiosPost).not.toHaveBeenCalled() // 남이 이미 회전했다
    // 남의 회전 결과를 내가 다시 네이티브에 되쏘지 않는다 (방송 루프 방지)
    expect(sentTypes()).toEqual(['refresh-lock-request'])
  })

  // ⚠️ 아래 3·3b 는 **queued 회신조차 없는** 전제다 — 락 관리자가 없는 구앱(웹 번들이
  // 네이티브 빌드보다 먼저 나가는 창)·브리지 사망. queued 를 받은 정상 대기는 9·10 참조.
  it('3. 어떤 회신도 없음 700ms → 단독 회전 (구앱·브리지 실패 폴백)', async () => {
    enterApp()
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'solo-token' } },
    })

    const p = performRefresh()
    expect(mockedAxiosPost).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(699)
    expect(mockedAxiosPost).not.toHaveBeenCalled() // 아직 대기 (조기 폴백 금지)
    await vi.advanceTimersByTimeAsync(1)

    expect(await p).toEqual({ accessToken: 'solo-token', user: null })
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
  })

  it('3b. 다른 웹뷰 몫 grant(reqId 불일치)는 무시 → 폴백까지 대기', async () => {
    enterApp()
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'solo-token' } },
    })

    const p = performRefresh()
    grant('someone-else')
    await vi.advanceTimersByTimeAsync(0)
    expect(mockedAxiosPost).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(700)
    await p
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
  })

  it('4. 회전 실패(401) → release 발신 + 기존 handleAuthFailure 경로 무변경', async () => {
    enterApp()
    useAuthStore.setState({ accessToken: 'dying', user: null })
    mockedAxiosPost.mockRejectedValueOnce({ response: { status: 401 } })

    const p = performRefresh()
    grant(lockReqId())
    await expect(p).rejects.toBeDefined()

    expect(sentTypes()).toContain('refresh-lock-release')
    expect(mockedPostToNative).toHaveBeenCalledWith({
      type: 'refresh-lock-release',
      reqId: lockReqId(),
    })
    // 기존 401 계약 그대로 — clearAuth + logout 브리지 + 만료 토스트, 앱이라 href 는 미변경
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(mockedPostToNative).toHaveBeenCalledWith({ type: 'logout' })
    expect(toast.error).toHaveBeenCalledWith('로그인이 만료되었습니다.')
    expect(window.location.href).toBe('')
  })

  it('5. 회전 실패(네트워크) → release 발신 + 비파괴 계약 유지', async () => {
    enterApp()
    useAuthStore.setState({ accessToken: 'keep-me', user: null })
    mockedAxiosPost.mockRejectedValueOnce(new Error('Network Error'))

    const p = performRefresh()
    grant(lockReqId())
    await expect(p).rejects.toBeDefined()

    expect(sentTypes()).toContain('refresh-lock-release')
    // 세션 판정 불가 → clearAuth·토스트·logout 전파 전부 금지 (락이 이 계약을 흔들지 않는다)
    expect(useAuthStore.getState().accessToken).toBe('keep-me')
    expect(toast.error).not.toHaveBeenCalled()
    expect(sentTypes()).not.toContain('logout')
  })

  it('6. 브라우저(브리지 부재) → 락 경로 0 호출 · 리스너 등록조차 안 함', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'web-token' } },
    })

    const result = await performRefresh()

    expect(result.accessToken).toBe('web-token')
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1) // 대기 없이 즉시 회전
    expect(sentTypes()).not.toContain('refresh-lock-request')
    expect(addSpy).not.toHaveBeenCalledWith(
      'chwippo:refresh-lock-grant',
      expect.anything(),
    )
    expect(addSpy).not.toHaveBeenCalledWith(
      'chwippo:token-broadcast',
      expect.anything(),
    )
    addSpy.mockRestore()
  })

  // 상한(8s) 자체를 잠그는 건 10번 — 여기선 "해소 후 리스너가 확실히 걷혔는지"만 본다.
  it('7. 폴백으로 해소된 뒤 지각 grant/broadcast 는 추가 회전·store 오염을 안 만든다', async () => {
    enterApp()
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'solo-token' } },
    })

    const p = performRefresh()
    await vi.advanceTimersByTimeAsync(700)
    expect(await p).toEqual({ accessToken: 'solo-token', user: null })
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)

    // 리스너가 남아 있으면 지각 신호가 store 를 덮어쓰거나 회전을 또 태운다
    grant(lockReqId())
    queued(lockReqId())
    broadcast('late-token')
    await vi.advanceTimersByTimeAsync(8000)
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().accessToken).toBe('solo-token')
  })

  it('8. 동시 caller 5개 → 락 요청도 HTTP 도 1회 (웹뷰 내 single-flight 유지)', async () => {
    enterApp()
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'shared-token' } },
    })

    const all = Promise.all([
      performRefresh(),
      performRefresh(),
      performRefresh(),
      performRefresh(),
      performRefresh(),
    ])
    grant(lockReqId())

    const results = await all
    expect(results.every((r) => r.accessToken === 'shared-token')).toBe(true)
    expect(
      sentTypes().filter((t) => t === 'refresh-lock-request'),
    ).toHaveLength(1)
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
  })

  /*
    🔴 queued ack (CEO 승인 2026-08-13) — 수리의 핵심 조건.

    이 회신이 없으면 웹은 '남이 락을 쥐고 있어 대기 중'과 '락 관리자가 없는 구앱'을
    구분할 수 없어 둘 다 700ms 폴백을 태운다. 그러면 승자의 회전이 700ms 만 넘겨도
    (409 backoff·느린 네트워크) 대기자 전원이 단독 회전으로 흩어져 R2 가 재발한다.
  */
  it('9. queued 수신 → 700ms 폴백 해제 · 승자의 broadcast 로 HTTP 0회 해소', async () => {
    enterApp()

    const p = performRefresh()
    queued(lockReqId())

    // 700ms 를 한참 넘겨도 단독 회전 금지 — 승자를 기다리는 게 이 회신의 존재 이유
    await vi.advanceTimersByTimeAsync(3000)
    expect(mockedAxiosPost).not.toHaveBeenCalled()

    broadcast('winner-token')
    const result = await p

    expect(result.accessToken).toBe('winner-token')
    expect(useAuthStore.getState().accessToken).toBe('winner-token')
    expect(mockedAxiosPost).not.toHaveBeenCalled()
    expect(sentTypes()).toEqual(['refresh-lock-request'])
  })

  it('10. queued 후 8s 까지 무신호 → 절대 상한에서 단독 회전 폴백', async () => {
    enterApp()
    mockedAxiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'capped-token' } },
    })

    const p = performRefresh()
    queued(lockReqId())

    await vi.advanceTimersByTimeAsync(7999)
    expect(mockedAxiosPost).not.toHaveBeenCalled() // 상한 전 조기 폴백 금지
    await vi.advanceTimersByTimeAsync(1)

    // 승자·중재자가 통째로 죽어도 무기한 매달리지 않는다 (현행 폴백으로 복귀)
    expect(await p).toEqual({ accessToken: 'capped-token', user: null })
    expect(mockedAxiosPost).toHaveBeenCalledTimes(1)
  })
})

/**
 * 직무 미입력 400 → **토스트 대신 입력 모달**.
 *
 * 🔴 백엔드 `assertJobTextPresent` 가 던지는 payload 모양에 의존한다
 * (`{ code: 'JOB_TITLE_REQUIRED', applicationId }`). 백엔드 쪽 회귀는
 * `chwippo-back/src/applications/job-text.spec.ts` 가 같은 계약을 고정한다.
 * 한쪽만 바뀌면 사용자는 "실패했어요" 만 보고 뭘 해야 할지 모르게 된다.
 */
describe('jobTitleRequiredApplicationId — 직무 게이트 400 판별', () => {
  it('code + applicationId 가 맞으면 카드 id 를 돌려준다', () => {
    expect(
      jobTitleRequiredApplicationId(400, {
        code: 'JOB_TITLE_REQUIRED',
        applicationId: 'app-1',
        message: '지원 직무를 먼저 입력해 주세요.',
      }),
    ).toBe('app-1')
  })

  it.each([
    ['400 이 아니면', 403, { code: 'JOB_TITLE_REQUIRED', applicationId: 'a' }],
    ['다른 code 면', 400, { code: 'QUOTA_EXCEEDED', applicationId: 'a' }],
    ['code 가 없으면', 400, { message: '뭔가 잘못됨' }],
    ['applicationId 가 없으면', 400, { code: 'JOB_TITLE_REQUIRED' }],
    ['applicationId 가 빈 문자열이면', 400, { code: 'JOB_TITLE_REQUIRED', applicationId: '' }],
    ['body 가 없으면', 400, undefined],
  ])('%s null — 기존 토스트 경로로 흘려보낸다', (_label, status, data) => {
    expect(jobTitleRequiredApplicationId(status, data)).toBeNull()
  })
})
