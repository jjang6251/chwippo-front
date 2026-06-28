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
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
