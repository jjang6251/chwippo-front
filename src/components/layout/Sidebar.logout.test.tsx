/**
 * 🔴 앱 웹뷰 로그아웃 랜딩 깜빡임 — 데스크탑 사이드바 경로 (2026-08-12).
 *
 * 앱 안에서 화면 전환은 **네이티브 소유**다. 네이티브는 logout 브리지를 받고 푸시 기기
 * 해제를 먼저 시도한 뒤(오프라인 대비 1.5s 상한) 로그인 화면으로 바꾼다. 그동안 웹뷰는
 * 계속 보이므로, 웹이 랜딩으로 이동해두면 랜딩이 그대로 보였다가 전환된다.
 *
 * 시나리오 (구현 보기 전에 케이스 먼저):
 * 1. 브라우저: 확정 클릭 → /auth/logout + clearAuth + 브리지 + navigate('/')  ← 기존 계약
 * 2. 앱: 확정 클릭 → navigate 미호출, 나머지(서버·clearAuth·브리지)는 전부 유지
 * 3. 앱: 서버 로그아웃이 실패해도 클라이언트 정리는 그대로 (이동만 생략)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), get: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => true,
  useInterviewAiEnabled: () => true,
}))
vi.mock('@/hooks/useDashboardStreak', () => ({
  useDashboardStreak: () => ({ data: undefined }),
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

function renderSidebar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** 사이드바 로그아웃 → 확인 모달의 확정 버튼까지 */
function confirmLogout() {
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  const buttons = screen.getAllByRole('button', { name: '로그아웃' })
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

describe('Sidebar — 로그아웃 (앱/브라우저 분기)', () => {
  it('1. 브라우저: /auth/logout + clearAuth + navigate("/")', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({} as never)
    renderSidebar()

    confirmLogout()

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/logout'))
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('2. 앱: navigate 미호출 · 서버 로그아웃·clearAuth·브리지는 유지', async () => {
    const postMessage = vi.fn()
    ;(window as unknown as RNWindowMock).ReactNativeWebView = { postMessage }
    vi.mocked(apiClient.post).mockResolvedValueOnce({} as never)
    renderSidebar()

    confirmLogout()

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull())
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout')
    expect(postMessage).toHaveBeenCalledWith('{"type":"logout"}')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('3. 앱 + 서버 로그아웃 실패: 클라이언트 정리는 그대로, 이동만 생략', async () => {
    const postMessage = vi.fn()
    ;(window as unknown as RNWindowMock).ReactNativeWebView = { postMessage }
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network'))
    renderSidebar()

    confirmLogout()

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull())
    expect(postMessage).toHaveBeenCalledWith('{"type":"logout"}')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
