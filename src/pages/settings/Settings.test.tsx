/**
 * Settings.tsx — 모바일 진입점 로그아웃 확인 모달 (Sidebar·ProfileSettings와 동일 패턴)
 *
 * 시나리오:
 * - 초기 상태에서 모달 미노출
 * - 로그아웃 버튼 클릭 → 모달 노출, logout API 미호출
 * - 모달의 "취소" → 모달 닫힘, logout API 미호출, 인증 유지
 * - 모달의 "로그아웃" → /auth/logout 호출 + clearAuth + / 로 navigate
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Settings } from './Settings'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { DemoModeContextProvider } from '@/contexts/demoMode'
import { useDemoSignupStore } from '@/stores/demoSignupStore'

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

function renderDemoSettings() {
  return render(
    <DemoModeContextProvider value={true}>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </DemoModeContextProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useDemoSignupStore.setState({ open: false })
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

/**
 * 🔴 앱 웹뷰 로그아웃 랜딩 깜빡임 (2026-08-12).
 *
 * 앱 안에서 화면 전환은 네이티브 소유다. 네이티브가 푸시 기기 해제를 마치고 로그인
 * 화면으로 바꾸는 동안 웹뷰는 계속 보이므로, 웹이 랜딩으로 이동해두면 그게 그대로 보인다.
 * 서버 로그아웃·clearAuth·브리지 발신은 **그대로 유지**하고 이동만 생략한다.
 */
describe('Settings — 앱 웹뷰 로그아웃', () => {
  interface RNWindowMock {
    ReactNativeWebView?: { postMessage: (data: string) => void }
  }

  afterEach(() => {
    // 모드 누수 금지 — 앱 판정이 남으면 다른 케이스가 엉뚱한 이유로 통과한다
    delete (window as unknown as RNWindowMock).ReactNativeWebView
  })

  it('앱: navigate 미호출 · /auth/logout + clearAuth + 브리지는 유지', async () => {
    const postMessage = vi.fn()
    ;(window as unknown as RNWindowMock).ReactNativeWebView = { postMessage }
    vi.mocked(apiClient.post).mockResolvedValueOnce({} as never)
    renderSettings()

    fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }))
    const buttons = screen.getAllByRole('button', { name: '로그아웃' })
    fireEvent.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBeNull()
    })
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout')
    expect(postMessage).toHaveBeenCalledWith('{"type":"logout"}')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

/**
 * 🔴 **내 정보 창고 이사** (2026-08-18 · CEO 결정 3). 하단 탭 자리를 공부 노트에 내주고
 * 설정 **맨 위**로 왔다. 늘 있던 자리에서 사라진 항목은 찾을 수 있는 자리에 있어야 하고,
 * 「이사왔어요」 뱃지가 "없어진 게 아니라 옮겼다" 를 한 번에 말한다. 라우트는 그대로다.
 */
describe('Settings — 내 정보 창고 이사', () => {
  it('메뉴 맨 위에 「내 정보 창고」 + /myinfo 링크', () => {
    renderSettings()
    const link = screen.getByRole('link', { name: /내 정보 창고/ })
    expect(link.getAttribute('href')).toBe('/myinfo')

    const menuLinks = screen.getAllByRole('link')
    expect(menuLinks[0].textContent).toContain('내 정보 창고')
  })

  it('「이사왔어요」 뱃지가 그 행에 붙는다', () => {
    renderSettings()
    const link = screen.getByRole('link', { name: /내 정보 창고/ })
    expect(link.textContent).toContain('이사왔어요')
    // 다른 행에는 안 붙는다 — 뱃지가 흔하면 신호가 죽는다
    expect(screen.getAllByText('이사왔어요')).toHaveLength(1)
  })

  it('데모에는 안 뜬다 (데모 하단 탭에 「내정보」가 그대로 있다)', () => {
    renderDemoSettings()
    expect(screen.queryByText('내 정보 창고')).toBeNull()
  })
})

describe('Settings — 관리자 페이지 진입 링크', () => {
  it('admin role: "관리자 페이지" 링크 노출 + /ops 링크', () => {
    useAuthStore.setState((s) => ({ user: { ...s.user!, role: 'admin' } }))
    renderSettings()

    const link = screen.getByRole('link', { name: /관리자 페이지/ })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/ops')
  })

  it('일반 user role: "관리자 페이지" 링크 미노출', () => {
    renderSettings()
    expect(screen.queryByRole('link', { name: /관리자 페이지/ })).toBeNull()
  })
})

describe('Settings — 데모 모드 (비로그인 미러)', () => {
  it('메뉴 항목이 링크 대신 버튼 + 탭 시 가입 모달 오픈 (실서비스 라우트 이탈 방지)', () => {
    renderDemoSettings()
    // 실서비스에선 링크지만 데모에선 버튼 (AuthGuard 라우트로 안 나가게)
    expect(screen.queryByRole('link', { name: /프로필 설정/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /프로필 설정/ }))
    expect(useDemoSignupStore.getState().open).toBe(true)
  })

  it('로그아웃 탭 → 로그아웃 확인 모달 대신 가입 모달 (API 미호출)', () => {
    renderDemoSettings()
    fireEvent.click(screen.getByRole('button', { name: /로그아웃/ }))
    expect(screen.queryByRole('dialog', { name: '로그아웃 확인' })).toBeNull()
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(useDemoSignupStore.getState().open).toBe(true)
  })
})
