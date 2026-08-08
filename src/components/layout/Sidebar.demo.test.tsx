/**
 * 데모 모드에서 준비 안 된 메뉴를 숨긴다 (2026-08-09).
 *
 * 🔴 **메뉴가 광고하는 곳에 갈 수 없으면 안 된다.** 면접 AI flag 를 `return true` 로 켜자
 * 데모 사이드바에도 「면접 준비」가 떴는데 `/demo/interviews` 라우트가 **없어서**
 * `<Route path="*">` 에 걸려 **캘린더로 튕겼다.** 운영 데모에서 그 상태로 배포돼 있었다.
 *
 * 🔴 **데모는 두 가지가 다 있어야 동작한다** — `/demo/*` 라우트와 `demoAdapter` 의 엔드포인트.
 * 면접은 둘 다 없다(adapter 에 `interview-prep-*` 0건). 그래서 라우트만 급히 만들어도
 * 빈 화면이 뜬다 — 샘플 데이터까지 갖춰지면 그때 `demoReady` 를 지운다.
 *
 * 이 spec 은 **데모에서만** 숨기는 것을 고정한다. 실서비스에서 사라지면 기능이 죽는다.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'
import { useDemoMode } from '@/contexts/demoMode'

vi.mock('@/contexts/demoMode', () => ({ useDemoMode: vi.fn(() => false) }))
vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => true,
  useInterviewAiEnabled: () => true,
}))
vi.mock('@/hooks/useDashboardStreak', () => ({
  useDashboardStreak: () => ({ data: undefined }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ clearAuth: vi.fn(), user: { nickname: '테스터' } }),
}))
vi.mock('@/stores/loginModalStore', () => ({
  useLoginModalStore: (sel: (s: unknown) => unknown) => sel({ show: vi.fn() }),
}))
vi.mock('@/api/client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }))

const demoMock = vi.mocked(useDemoMode)

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

describe('Sidebar — 데모 모드 메뉴 노출', () => {
  beforeEach(() => vi.clearAllMocks())

  it('🔴 데모에서는 「면접 준비」가 안 보인다 (갈 수 있는 곳이 없다)', () => {
    demoMock.mockReturnValue(true)
    renderSidebar()
    expect(screen.queryByText('면접 준비')).toBeNull()
  })

  it('🔴 실서비스에서는 보인다 — 데모에서만 숨기는 것이다', () => {
    demoMock.mockReturnValue(false)
    renderSidebar()
    expect(screen.queryByText('면접 준비')).not.toBeNull()
  })

  /**
   * 🔴 데모에서 **다른 메뉴까지 사라지면** 둘러보기가 통째로 망가진다.
   * `demoReady` 는 기본 노출이고 `false` 인 것만 숨긴다 — 그 계약을 고정한다.
   */
  it('🔴 데모에서 나머지 메뉴는 그대로 보인다 (과잉 차단 방지)', () => {
    demoMock.mockReturnValue(true)
    renderSidebar()
    for (const label of [
      '캘린더',
      '지원 현황 보드',
      '회고',
      '활동 일지',
      '자소서',
      '내 정보 창고',
    ]) {
      expect(screen.queryByText(label)).not.toBeNull()
    }
  })
})
