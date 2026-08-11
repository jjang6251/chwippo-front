/**
 * 🔴 앱 웹뷰 랜딩 깜빡임 — 약관 동의 화면의 이탈 경로 2개 (2026-08-12).
 *
 * 「동의하지 않고 나가기」와 뒤로가기(popstate) 둘 다 로그아웃이다. 앱 안에서 화면 전환은
 * **네이티브 소유**이므로 웹은 랜딩으로 이동하지 않는다 — 네이티브가 logout 브리지를 받고
 * 로그인 화면으로 바꾸는 동안 웹뷰는 계속 보이기 때문이다.
 *
 * 시나리오:
 * 1. 브라우저 + 나가기 버튼 → /auth/logout + clearAuth + navigate('/', replace)  ← 기존 계약
 * 2. 앱 + 나가기 버튼 → navigate 미호출 · 서버·clearAuth·브리지는 유지
 * 3. 브라우저 + 뒤로가기(popstate) → 동일하게 랜딩 이동
 * 4. 앱 + 뒤로가기(popstate) → navigate 미호출 · 나머지 유지
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TermsAgreement } from './TermsAgreement'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), get: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/api/users', () => ({ agreeTerms: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

interface RNWindowMock {
  ReactNativeWebView?: { postMessage: (data: string) => void }
}

function renderTerms() {
  return render(
    <MemoryRouter>
      <TermsAgreement />
    </MemoryRouter>,
  )
}

function enterApp() {
  const postMessage = vi.fn()
  ;(window as unknown as RNWindowMock).ReactNativeWebView = { postMessage }
  return postMessage
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiClient.post).mockResolvedValue({} as never)
  useAuthStore.setState({ accessToken: 'test-token', user: null })
})

afterEach(() => {
  // 모드 누수 금지 — 앱 판정이 남으면 다른 케이스가 엉뚱한 이유로 통과한다
  delete (window as unknown as RNWindowMock).ReactNativeWebView
})

describe('TermsAgreement — "동의하지 않고 나가기" (앱/브라우저 분기)', () => {
  it('1. 브라우저: /auth/logout + clearAuth + navigate("/", replace)', async () => {
    renderTerms()

    fireEvent.click(screen.getByRole('button', { name: '동의하지 않고 나가기' }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }),
    )
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout')
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('2. 앱: navigate 미호출 · 서버·clearAuth·브리지는 유지', async () => {
    const postMessage = enterApp()
    renderTerms()

    fireEvent.click(screen.getByRole('button', { name: '동의하지 않고 나가기' }))

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull())
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout')
    expect(postMessage).toHaveBeenCalledWith('{"type":"logout"}')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('TermsAgreement — 뒤로가기(popstate) 이탈 (앱/브라우저 분기)', () => {
  const goBack = async () => {
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  it('3. 브라우저: 로그아웃 후 랜딩 이동', async () => {
    renderTerms()

    await goBack()

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }),
    )
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('4. 앱: navigate 미호출 · clearAuth·브리지는 유지', async () => {
    const postMessage = enterApp()
    renderTerms()

    await goBack()

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull())
    expect(postMessage).toHaveBeenCalledWith('{"type":"logout"}')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
