/**
 * AuthGuard 테스트 (hotfix-auth-refresh-race)
 *
 * 시나리오 enumeration (구현 보기 전에 케이스 먼저):
 * 1. 초기 accessToken 있음 → performRefresh 호출 안 함, Outlet 즉시 렌더
 * 2. 초기 토큰 없음 → performRefresh 호출 → 성공 → 토큰 set → Outlet 렌더
 * 3. 초기 토큰 없음 → performRefresh 실패 (non-429, 예: 401) → 랜딩 redirect
 *    (handleAuthFailure 내부에서 redirect 처리, AuthGuard는 토큰 null이라 Navigate)
 * 4. 초기 토큰 없음 → performRefresh 429 → rate limit 화면 (랜딩 redirect 안 함)
 * 5. rate limit 화면 — 안내 문구·다시 시도 버튼 존재
 * 6. rate limit "다시 시도" 클릭 → window.location.reload 호출
 * 7. 토큰 있고 user.termsAgreedAt null → /terms-agreement 강제 redirect
 *    (단, 이미 /terms-agreement 경로면 redirect 안 함 — 루프 방지)
 * 8. 토큰 있고 user.termsAgreedAt 있음 → 보호 페이지 정상 렌더
 *
 * 네트워크 실패 자동 재시도 (콜드스타트 랜딩 flash 수리, 2026-08-12) — 케이스 먼저:
 * 9.  네트워크 실패 → 700ms 백오프 뒤 자동 재시도 → 성공하면 앱 진입 (랜딩 안 거침)
 * 10. 재시도 대기 중엔 빈 화면 유지 — 랜딩이 절대 안 보임 (이게 실기 증상 그 자체)
 * 11. 백오프 값 고정 — 699ms 에선 아직 재시도 안 하고 700ms 에 한다
 * 12. 재시도 2회까지 (700 → 1500), 전부 실패하면 네트워크 카드. 그 뒤엔 더 안 부름
 * 13. 5xx(503)도 같은 재시도 경로 (서버 순단 = 세션 판정 불가)
 * 14. 네트워크 카드 "다시 시도" → window.location.reload
 * 15. 401 은 재시도 대상 아님 — 즉시 랜딩 (재호출 없음)
 * 16. 429 도 재시도 대상 아님 — 즉시 rate limit 카드
 * 17. 언마운트되면 예약된 재시도 타이머는 발사되지 않는다
 *
 * 앱 웹뷰 로그아웃 깜빡임 (2026-08-12) — 케이스 먼저:
 * 18. 앱 + 401 확정(재시도 대상 아님) → 랜딩이 아니라 **빈 화면** (네이티브 전환 대기)
 * 19. 앱 + 로그인 중 clearAuth (사용자 로그아웃) → 랜딩 안 그림
 * 20. 브라우저 + 401 → 기존대로 랜딩 (앱 분기가 웹을 망가뜨리지 않는다)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthGuard } from './AuthGuard'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/api/client', () => ({
  performRefresh: vi.fn(),
}))

import { performRefresh } from '@/api/client'
const mockedPerformRefresh = vi.mocked(performRefresh)

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>LANDING_PAGE</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/dashboard" element={<div>DASHBOARD_PAGE</div>} />
          <Route
            path="/terms-agreement"
            element={<div>TERMS_PAGE_GUARDED</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const sampleUser = {
  id: 'u1',
  nickname: 'tester',
  email: 'a@b.c',
  role: 'user' as const,
  onboardedAt: '2026-01-01T00:00:00.000Z',
  termsAgreedAt: '2026-01-01T00:00:00.000Z',
  aiConsentAt: null,
  aiConsentVersion: null, onboardedCoinAt: null,
  signupJobCategories: null, signupOtherText: null, sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
  Object.defineProperty(window, 'location', {
    value: { href: '', reload: vi.fn() },
    writable: true,
  })
})

describe('AuthGuard', () => {
  it('1. 초기 토큰 있음 → performRefresh 호출 안 함, Outlet 즉시 렌더', async () => {
    useAuthStore.setState({ accessToken: 'existing', user: sampleUser })
    renderApp('/dashboard')
    expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy()
    expect(mockedPerformRefresh).not.toHaveBeenCalled()
  })

  it('2. 초기 토큰 없음 → performRefresh 성공 → 토큰 반영 후 Outlet 렌더', async () => {
    mockedPerformRefresh.mockImplementation(async () => {
      // performRefresh 내부에서 store 갱신을 흉내
      useAuthStore.setState({ accessToken: 'fresh', user: sampleUser })
      return { accessToken: 'fresh', user: sampleUser }
    })
    renderApp('/dashboard')
    await waitFor(() =>
      expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy(),
    )
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(1)
  })

  it('3. 초기 토큰 없음 → performRefresh 401 실패 → 랜딩 redirect', async () => {
    // handleAuthFailure는 mock된 performRefresh 내부에서 일어나지 않음 (mock이 단순 reject).
    // 실제 코드에선 handleAuthFailure가 clearAuth+window.location.href 처리.
    // 여기선 AuthGuard render 동작만 검증 — 토큰 없으면 <Navigate to="/" />.
    mockedPerformRefresh.mockRejectedValue({ response: { status: 401 } })
    renderApp('/dashboard')
    await waitFor(() => expect(screen.getByText('LANDING_PAGE')).toBeTruthy())
  })

  it('4. 초기 토큰 없음 → performRefresh 429 → rate limit 화면 (랜딩 redirect 안 함)', async () => {
    mockedPerformRefresh.mockRejectedValue({ response: { status: 429 } })
    renderApp('/dashboard')
    await waitFor(() =>
      expect(
        screen.getByText('많은 새로고침 요청에 잠시 제한되었습니다'),
      ).toBeTruthy(),
    )
    // 랜딩으로 안 튕김 — LANDING_PAGE 텍스트 부재
    expect(screen.queryByText('LANDING_PAGE')).toBeNull()
    expect(screen.queryByText('DASHBOARD_PAGE')).toBeNull()
  })

  it('5. rate limit 화면 — 안내 문구와 "다시 시도" 버튼 존재', async () => {
    mockedPerformRefresh.mockRejectedValue({ response: { status: 429 } })
    renderApp('/dashboard')
    await waitFor(() =>
      expect(screen.getByText(/60초 뒤에 다시 시도/)).toBeTruthy(),
    )
    expect(screen.getByText(/세션은 그대로 유지/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('6. rate limit "다시 시도" 클릭 → window.location.reload 호출', async () => {
    mockedPerformRefresh.mockRejectedValue({ response: { status: 429 } })
    renderApp('/dashboard')
    const retryBtn = await screen.findByRole('button', { name: '다시 시도' })
    await act(async () => {
      retryBtn.click()
    })
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('7. 토큰 있고 termsAgreedAt null + 보호 페이지 → /terms-agreement 강제 redirect', async () => {
    useAuthStore.setState({
      accessToken: 'existing',
      user: { ...sampleUser, termsAgreedAt: null },
    })
    renderApp('/dashboard')
    await waitFor(() => expect(screen.getByText('TERMS_PAGE_GUARDED')).toBeTruthy())
    expect(screen.queryByText('DASHBOARD_PAGE')).toBeNull()
  })

  it('7-1. 이미 /terms-agreement 경로면 추가 redirect 안 함 (루프 방지)', async () => {
    useAuthStore.setState({
      accessToken: 'existing',
      user: { ...sampleUser, termsAgreedAt: null },
    })
    renderApp('/terms-agreement')
    expect(screen.getByText('TERMS_PAGE_GUARDED')).toBeTruthy()
  })

  it('8. 토큰 있고 termsAgreedAt 정상 → 보호 페이지 그대로', async () => {
    useAuthStore.setState({ accessToken: 'existing', user: sampleUser })
    renderApp('/dashboard')
    expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy()
  })
})

/**
 * 🔴 콜드스타트 랜딩 flash 수리 (2026-08-12).
 *
 * iOS 콜드스타트 직후 네트워크가 준비되기 전 수백 ms 창에서 부팅 refresh 가 네트워크
 * 실패하면, 예전엔 토큰이 없다는 이유로 <Navigate to="/" /> 가 랜딩을 깜빡 띄웠다.
 * 세션이 죽었다는 증거가 없는 실패는 재시도 대상이지 로그아웃 근거가 아니다.
 */
describe('AuthGuard — 네트워크·5xx 자동 재시도', () => {
  const networkError = new Error('Network Error') // axios: response 없음

  beforeEach(() => {
    // 🔴 mockReset — clearAllMocks 는 호출 기록만 지우고 mockImplementationOnce 큐는
    // 남긴다. 소비되지 않은 once 구현이 다음 케이스로 새면 그 케이스가 엉뚱한 이유로
    // 통과한다 (뮤테이션 검증 중 실측).
    mockedPerformRefresh.mockReset()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** 대기 중인 timer + promise 체인을 함께 흘려보낸다 */
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })

  const succeedOnce = () =>
    mockedPerformRefresh.mockImplementationOnce(async () => {
      useAuthStore.setState({ accessToken: 'fresh', user: sampleUser })
      return { accessToken: 'fresh', user: sampleUser }
    })

  it('9·10. 네트워크 실패 → 자동 재시도 성공 → 앱 진입 (그 사이 랜딩 없음)', async () => {
    mockedPerformRefresh.mockRejectedValueOnce(networkError)
    succeedOnce()

    renderApp('/dashboard')
    await advance(0)

    // 재시도 대기 중 — 빈 화면(checking). 랜딩도 앱도 아직 아님
    expect(screen.queryByText('LANDING_PAGE')).toBeNull()
    expect(screen.queryByText('DASHBOARD_PAGE')).toBeNull()
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(1)

    await advance(700)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(2)
    expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy()
    expect(screen.queryByText('LANDING_PAGE')).toBeNull()
  })

  it('11. 첫 백오프는 700ms — 699ms 에선 아직 재시도 안 함', async () => {
    mockedPerformRefresh.mockRejectedValueOnce(networkError)
    succeedOnce()

    renderApp('/dashboard')
    await advance(0)
    await advance(699)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(1)

    await advance(1)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(2)
  })

  it('12. 재시도 2회(700→1500) 전부 실패 → 네트워크 카드 (랜딩 아님) + 이후 재호출 없음', async () => {
    mockedPerformRefresh.mockRejectedValue(networkError)

    renderApp('/dashboard')
    await advance(0)
    await advance(700)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(2)
    // 아직 재시도가 남아 있으므로 카드도 랜딩도 안 보인다
    expect(screen.queryByText('연결이 불안정해요')).toBeNull()
    expect(screen.queryByText('LANDING_PAGE')).toBeNull()

    await advance(1500)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(3)
    expect(screen.getByText('연결이 불안정해요')).toBeTruthy()
    expect(screen.getByText(/잠시 후 다시 시도해 주세요/)).toBeTruthy()
    expect(screen.queryByText('LANDING_PAGE')).toBeNull()

    // 무한 재시도 금지
    await advance(30_000)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(3)
  })

  it('13. 503(서버 순단)도 같은 재시도 경로 → 성공하면 앱 진입', async () => {
    mockedPerformRefresh.mockRejectedValueOnce({ response: { status: 503 } })
    succeedOnce()

    renderApp('/dashboard')
    await advance(0)
    expect(screen.queryByText('LANDING_PAGE')).toBeNull()

    await advance(700)
    expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy()
  })

  it('14. 네트워크 카드 "다시 시도" → window.location.reload', async () => {
    mockedPerformRefresh.mockRejectedValue(networkError)

    renderApp('/dashboard')
    await advance(0)
    await advance(700)
    await advance(1500)

    const retryBtn = screen.getByRole('button', { name: '다시 시도' })
    await act(async () => {
      retryBtn.click()
    })
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('15. 401 은 재시도 대상 아님 — 즉시 랜딩, 재호출 없음', async () => {
    mockedPerformRefresh.mockRejectedValue({ response: { status: 401 } })

    renderApp('/dashboard')
    await advance(0)
    expect(screen.getByText('LANDING_PAGE')).toBeTruthy()

    await advance(30_000)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(1)
  })

  it('16. 429 는 재시도 대상 아님 — 즉시 rate limit 카드 (문구 그대로)', async () => {
    mockedPerformRefresh.mockRejectedValue({ response: { status: 429 } })

    renderApp('/dashboard')
    await advance(0)
    expect(
      screen.getByText('많은 새로고침 요청에 잠시 제한되었습니다'),
    ).toBeTruthy()
    expect(screen.getByText(/60초 뒤에 다시 시도/)).toBeTruthy()

    await advance(30_000)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(1)
  })

  it('17. 언마운트 → 예약된 재시도 타이머 발사 안 됨', async () => {
    mockedPerformRefresh.mockRejectedValue(networkError)

    const { unmount } = renderApp('/dashboard')
    await advance(0)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(1)

    unmount()
    await advance(30_000)
    expect(mockedPerformRefresh).toHaveBeenCalledTimes(1)
  })
})

/**
 * 🔴 앱 웹뷰 로그아웃 랜딩 깜빡임 (2026-08-12).
 *
 * 로그아웃 핸들러에서 `navigate('/')` 를 지우는 것만으로는 **안 막힌다.**
 * `clearAuth()` 가 store 구독 재렌더를 일으키고, 그 재렌더가 `if (!accessToken)` 를
 * 통과해 `<Navigate to="/" />` 로 랜딩을 그린다. 앱 안에서 화면 전환은 네이티브 소유이므로
 * 웹뷰는 빈 화면으로 버틴다.
 */
describe('AuthGuard — 앱 웹뷰에서는 랜딩을 그리지 않는다', () => {
  interface RNWindowMock {
    ReactNativeWebView?: { postMessage: (data: string) => void }
  }
  const enterApp = () => {
    ;(window as unknown as RNWindowMock).ReactNativeWebView = {
      postMessage: vi.fn(),
    }
  }

  afterEach(() => {
    // 모드 누수 금지 — 앱 판정이 남으면 다른 케이스가 엉뚱한 이유로 통과한다
    delete (window as unknown as RNWindowMock).ReactNativeWebView
  })

  it('18. 앱 + 401 확정 → 랜딩 아님 · 빈 화면 (네이티브 전환 대기)', async () => {
    enterApp()
    mockedPerformRefresh.mockRejectedValue({ response: { status: 401 } })

    const { container } = renderApp('/dashboard')

    await waitFor(() => expect(mockedPerformRefresh).toHaveBeenCalledTimes(1))
    // reject → setChecking(false) 까지 흘려보낸 뒤에 본다 (검사가 이르면 빈 화면은 공짜다)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(container.textContent).toBe('')
    expect(screen.queryByText('LANDING_PAGE')).toBeNull()
    expect(screen.queryByText('DASHBOARD_PAGE')).toBeNull()
  })

  it('19. 앱 + 로그인 중 clearAuth (사용자 로그아웃) → 랜딩 안 그림', async () => {
    enterApp()
    useAuthStore.setState({ accessToken: 'existing', user: sampleUser })
    const { container } = renderApp('/dashboard')
    expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy()

    // 로그아웃 핸들러가 하는 일 = 이것. navigate 없이도 재렌더가 랜딩을 그리는지 본다
    await act(async () => {
      useAuthStore.getState().clearAuth()
    })

    expect(screen.queryByText('LANDING_PAGE')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('20. 브라우저 + 401 → 기존대로 랜딩 (웹 경로 무손상)', async () => {
    mockedPerformRefresh.mockRejectedValue({ response: { status: 401 } })
    renderApp('/dashboard')
    await waitFor(() => expect(screen.getByText('LANDING_PAGE')).toBeTruthy())
  })

  it('20-1. 브라우저 + 로그인 중 clearAuth → 기존대로 랜딩', async () => {
    useAuthStore.setState({ accessToken: 'existing', user: sampleUser })
    renderApp('/dashboard')
    await act(async () => {
      useAuthStore.getState().clearAuth()
    })
    expect(screen.getByText('LANDING_PAGE')).toBeTruthy()
  })
})
