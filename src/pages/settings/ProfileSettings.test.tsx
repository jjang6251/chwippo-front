/**
 * 🔴 앱 웹뷰 랜딩 깜빡임 — 프로필 설정의 로그아웃·계정 탈퇴 (2026-08-12).
 *
 * 앱 안에서 화면 전환은 **네이티브 소유**다. 로그아웃/탈퇴 브리지를 받은 네이티브가
 * clearAll 후 로그인 화면으로 바꾸는 동안 웹뷰는 계속 보이므로, 웹이 랜딩으로
 * 이동해두면 그 랜딩이 그대로 보인다. 이동만 생략하고 나머지는 전부 유지한다.
 *
 * 시나리오:
 * 1. 브라우저 로그아웃 → /auth/logout + clearAuth + navigate('/')   ← 기존 계약
 * 2. 앱 로그아웃 → navigate 미호출 · 서버·clearAuth·logout 브리지는 유지
 * 3. 브라우저 탈퇴 성공 → clearAuth + account-deleted 브리지 + navigate('/')
 * 4. 앱 탈퇴 성공 → navigate 미호출 · clearAuth · account-deleted 브리지는 유지
 * 5. 탈퇴 실패 → clearAuth·브리지·이동 전부 없음 (앱/브라우저 공통)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileSettings } from './ProfileSettings'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'
import { deleteAccount } from '@/api/users'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), get: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/api/users', () => ({ deleteAccount: vi.fn() }))
vi.mock('@/stores/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

interface RNWindowMock {
  ReactNativeWebView?: { postMessage: (data: string) => void }
}

function renderProfile() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function enterApp() {
  const postMessage = vi.fn()
  ;(window as unknown as RNWindowMock).ReactNativeWebView = { postMessage }
  return postMessage
}

/**
 * 로그아웃 섹션 → 확인 모달의 확정 버튼까지.
 *
 * 섹션 버튼의 접근 이름은 chevron 이 붙어 "로그아웃 ›" 이고 모달 확정 버튼만 "로그아웃" 이다.
 */
function confirmLogout() {
  fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }))
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
}

/** 탈퇴하기 → 확인 모달의 확정 버튼까지 */
function confirmDelete() {
  fireEvent.click(screen.getByRole('button', { name: '탈퇴하기' }))
  const buttons = screen.getAllByRole('button', { name: '탈퇴하기' })
  fireEvent.click(buttons[buttons.length - 1])
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ accessToken: 'test-token', user: null })
})

afterEach(() => {
  // 모드 누수 금지 — 앱 판정이 남으면 다른 케이스가 엉뚱한 이유로 통과한다
  delete (window as unknown as RNWindowMock).ReactNativeWebView
})

describe('ProfileSettings — 로그아웃 (앱/브라우저 분기)', () => {
  it('1. 브라우저: /auth/logout + clearAuth + navigate("/")', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({} as never)
    renderProfile()

    confirmLogout()

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/logout'))
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('2. 앱: navigate 미호출 · 서버·clearAuth·브리지는 유지', async () => {
    const postMessage = enterApp()
    vi.mocked(apiClient.post).mockResolvedValueOnce({} as never)
    renderProfile()

    confirmLogout()

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull())
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout')
    expect(postMessage).toHaveBeenCalledWith('{"type":"logout"}')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('ProfileSettings — 계정 탈퇴 (앱/브라우저 분기)', () => {
  it('3. 브라우저: clearAuth + account-deleted 브리지 + navigate("/")', async () => {
    vi.mocked(deleteAccount).mockResolvedValueOnce(undefined as never)
    renderProfile()

    confirmDelete()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('4. 앱: navigate 미호출 · clearAuth · account-deleted 브리지는 유지', async () => {
    const postMessage = enterApp()
    vi.mocked(deleteAccount).mockResolvedValueOnce(undefined as never)
    renderProfile()

    confirmDelete()

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith('{"type":"account-deleted"}'),
    )
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('5. 앱 + 탈퇴 실패: 세션 유지 · 브리지·이동 모두 없음', async () => {
    const postMessage = enterApp()
    vi.mocked(deleteAccount).mockRejectedValueOnce(new Error('boom'))
    renderProfile()

    confirmDelete()

    await waitFor(() =>
      expect(vi.mocked(deleteAccount)).toHaveBeenCalledTimes(1),
    )
    expect(useAuthStore.getState().accessToken).toBe('test-token')
    expect(postMessage).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
