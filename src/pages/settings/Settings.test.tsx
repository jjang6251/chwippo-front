/**
 * Settings.tsx — 모바일 진입점 로그아웃 확인 모달 (Sidebar·ProfileSettings와 동일 패턴)
 *
 * 시나리오:
 * - 초기 상태에서 모달 미노출
 * - 로그아웃 버튼 클릭 → 모달 노출, logout API 미호출
 * - 모달의 "취소" → 모달 닫힘, logout API 미호출, 인증 유지
 * - 모달의 "로그아웃" → /auth/logout 호출 + clearAuth + / 로 navigate
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Settings } from './Settings'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    accessToken: 'test-token',
    user: {
      id: 'u1',
      nickname: '테스트',
      email: null,
      role: 'user',
      onboardedAt: null,
      termsAgreedAt: null,
      aiConsentAt: null,
      aiConsentVersion: null, onboardedCoinAt: null,
      signupJobCategories: null, signupOtherText: null, sampleCardsDismissedAt: null,
    calendarHomeIntroDismissedAt: null,
    alarmPromptedAt: null,
    },
  })
})

describe('Settings — 로그아웃 확인 모달', () => {
  it('초기 상태: 로그아웃 모달 미노출', () => {
    renderSettings()
    expect(screen.queryByRole('dialog', { name: '로그아웃 확인' })).toBeNull()
  })

  it('로그아웃 버튼 클릭 → 모달 노출 + logout API 미호출', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }))

    expect(screen.getByRole('dialog', { name: '로그아웃 확인' })).toBeTruthy()
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(useAuthStore.getState().accessToken).toBe('test-token')
  })

  it('모달의 "취소" 클릭 → 모달 닫힘 + 인증 유지', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('dialog', { name: '로그아웃 확인' })).toBeNull()
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(useAuthStore.getState().accessToken).toBe('test-token')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('모달의 "로그아웃" 클릭 → /auth/logout + clearAuth + / navigate', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({} as never)
    renderSettings()

    fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }))
    // 모달 안의 "로그아웃" 버튼 — 첫 버튼은 페이지 메뉴, 두 번째는 모달의 확정 버튼
    const buttons = screen.getAllByRole('button', { name: '로그아웃' })
    fireEvent.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/logout')
    })
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('logout API 실패해도 클라이언트 정리 (clearAuth + navigate)', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network'))
    renderSettings()

    fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }))
    const buttons = screen.getAllByRole('button', { name: '로그아웃' })
    fireEvent.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBeNull()
    })
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
