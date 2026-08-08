/**
 * 데모 모드 메뉴 노출 (2026-08-09).
 *
 * 🔴 **경위** — 면접 AI flag 를 켜자 데모 사이드바에도 「면접 준비」가 떴는데
 * `/demo/interviews` 라우트가 **없어서** 캘린더로 튕겼다. 운영 데모에 그 상태로 배포돼 있었다.
 * 원인은 스위치 하나가 두 곳(실서비스·데모)을 동시에 켠 것이었고, **"데모에 준비됐는가"**
 * 라는 질문이 코드에 없었다. 그래서 `demoReady` 축을 뒀다.
 *
 * 지금은 데모에 면접 세션·라우트·adapter 엔드포인트가 모두 갖춰져 **`demoReady: false` 인
 * 항목이 없다.** 그래도 축은 남긴다 — **데모는 구조적으로 기능보다 늦는다.** 다음에 새 화면을
 * 공개할 때 한 단어로 막을 수 있고, 없으면 같은 사고를 다시 겪는다.
 *
 * 이 spec 이 지키는 것: **데모에서 메뉴가 과잉 차단되지 않는다.** 필터를 잘못 건드리면
 * 둘러보기가 통째로 망가지는데, 그건 아무 테스트도 안 잡는 자리였다.
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

const ALL_MENUS = [
  '캘린더',
  '지원 현황 보드',
  '회고',
  '활동 일지',
  '자소서',
  '면접 준비',
  '내 정보 창고',
]

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

  /**
   * 🔴 **과잉 차단 방지가 이 파일의 핵심이다.** `demoReady` 필터를 잘못 건드리면
   * 데모에서 메뉴가 통째로 사라져 둘러보기가 망가진다. 눈에 안 띄게 망가지는 종류다.
   */
  it('🔴 데모에서 모든 메뉴가 보인다 (필터 과잉 차단 방지)', () => {
    demoMock.mockReturnValue(true)
    renderSidebar()
    for (const label of ALL_MENUS) {
      expect(screen.queryByText(label)).not.toBeNull()
    }
  })

  it('실서비스에서도 동일하다 (데모 전용 차단 항목이 지금은 없다)', () => {
    demoMock.mockReturnValue(false)
    renderSidebar()
    for (const label of ALL_MENUS) {
      expect(screen.queryByText(label)).not.toBeNull()
    }
  })

  /**
   * 🔴 **면접이 데모에 실제로 노출되는지**는 별도로 못박는다.
   * 2026-08-09 에 샘플 세션·라우트·adapter 를 갖추고 `demoReady: false` 를 뗐다.
   * 다시 붙으면(= 데모가 또 뒤처지면) 여기서 걸린다.
   */
  it('🔴 데모에 「면접 준비」가 노출된다 (샘플 세션이 갖춰짐)', () => {
    demoMock.mockReturnValue(true)
    renderSidebar()
    expect(screen.queryByText('면접 준비')).not.toBeNull()
  })
})
