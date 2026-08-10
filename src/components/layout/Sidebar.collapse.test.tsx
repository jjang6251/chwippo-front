/**
 * 전역 메뉴 접기 (2026-08-10).
 *
 * 🔴 **왜 만들었나.** 면접 ↔ 자소서 나란히 보기는 콘텐츠 폭 862px 을 요구하는데,
 * 사이드바가 `lg`(1024) 에서 나타나며 **224px 을 한꺼번에 가져간다.** 그래서 창을 넓힐수록
 * 「1열 → 2열 → 1열 → 2열」 로 움직이는 구간(1024~1157)이 생겼다. 접힌 레일(56px)이
 * 그 구간을 메운다.
 *
 * 이 spec 이 잠그는 계약:
 *   ① 접어도 **갈 수 있는 곳이 줄지 않는다** — 라벨만 사라지고 이름은 계속 읽힌다
 *   ② 접힘은 **저장된다** — 페이지를 옮길 때마다 다시 접게 만들지 않는다
 *   ③ **데모에서는 접히지 않는다** — 거기서 접히면 전환 CTA 가 화살표 한 개가 되고,
 *      저장된 값이 접힘이면 **펼 방법조차 없이** 접힌 채 보게 된다
 *
 * 접근성이 핵심이다. 아이콘만 남기면서 `aria-label` 을 안 주면 스크린리더에는
 * **이름 없는 링크 8개**가 된다 — 눈으로는 멀쩡해 보이므로 사람 눈으로는 안 잡힌다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'
import { useDemoMode } from '@/contexts/demoMode'
import { useNavCollapsedStore } from '@/stores/navCollapsedStore'

vi.mock('@/contexts/demoMode', () => ({ useDemoMode: vi.fn(() => false) }))
vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => true,
  useInterviewAiEnabled: () => true,
}))
vi.mock('@/hooks/useDashboardStreak', () => ({
  useDashboardStreak: () => ({ data: { streak: { current: 5 } } }),
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

/** 접어도 사라지면 안 되는 이동 경로 전부 */
const DESTINATIONS = [
  '캘린더',
  '지원 현황 보드',
  '회고',
  '활동 일지',
  '자소서',
  '면접 준비',
  '내 정보 창고',
  '설정',
  '도움말',
  '로그아웃',
  '문의하기',
]

function draw() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const rail = () => document.querySelector('aside[data-nav]') as HTMLElement
const toggle = () => screen.getByRole('button', { name: /메뉴 (접기|펼치기)/ })

describe('전역 메뉴 접기', () => {
  beforeEach(() => {
    demoMock.mockReturnValue(false)
    localStorage.clear()
    useNavCollapsedStore.setState({ collapsed: false })
  })

  it('기본은 펼침 — 라벨이 보인다', () => {
    draw()
    expect(rail().className).toContain('w-56')
    expect(screen.getByText('지원 현황 보드')).toBeTruthy()
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
  })

  it('누르면 접히고 폭이 레일이 된다', () => {
    draw()
    fireEvent.click(toggle())
    expect(rail().className).toContain('w-14')
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  /**
   * 🔴 **눈으로는 안 잡히는 회귀.** 라벨을 지우면서 접근성 이름을 안 남기면
   * 화면은 멀쩡한데 스크린리더에는 이름 없는 링크만 남는다.
   */
  it('🔴 접혀도 모든 이동 경로의 이름이 읽힌다', () => {
    draw()
    fireEvent.click(toggle())
    for (const name of DESTINATIONS) {
      // 연속 기록이 있는 항목은 이름 뒤에 그게 붙는다 (아래 spec 이 따로 잠근다)
      expect(
        screen.getByRole(name === '로그아웃' ? 'button' : 'link', {
          name: new RegExp(`^${name}`),
        }),
      ).toBeTruthy()
    }
  })

  it('접히면 글자 라벨은 사라진다 (아이콘만)', () => {
    draw()
    fireEvent.click(toggle())
    expect(screen.queryByText('지원 현황 보드')).toBeNull()
  })

  /** 연속 기록은 되돌아올 이유다 — 접혔다고 통째로 지우지 않는다 */
  it('펼쳤을 땐 숫자로 보인다', () => {
    draw()
    expect(screen.getByLabelText('활동 5일 연속')).toBeTruthy()
  })

  /**
   * 🔴 **눈에는 보이는데 귀에는 없던 자리** (2026-08-10 `/uiux`).
   *
   * 접히면 점 하나로 줄이면서 그 점에 `aria-label` 을 달았는데, **링크 자신의 이름이
   * 안쪽 라벨을 덮어** 연속 기록이 화면 낭독기에 아예 안 들렸다. 화면상으로는 멀쩡해서
   * 사람 눈으로는 안 잡히는 종류다 — 이름에 합쳐 넣는다.
   */
  it('🔴 접히면 연속 기록이 링크 이름에 담긴다', () => {
    draw()
    fireEvent.click(toggle())
    expect(
      screen.getByRole('link', { name: '회고 — 활동 5일 연속' }),
    ).toBeTruthy()
  })

  /**
   * 🔴 **이 spec 은 한때 헛돌았다** (2026-08-10 뮤테이션 감사에서 발견).
   *
   * 전에는 언마운트 후 다시 그리는 것으로 「페이지 이동」을 흉내 냈는데, zustand store 는
   * **모듈 스코프**라 값이 메모리에 그대로 남는다. 그래서 **저장값을 아예 안 읽게 만들어도**
   * (= 새로고침하면 항상 펼침) 8건이 전부 통과했다. 쓰기만 보고 **읽기는 한 번도** 안 봤다.
   *
   * 새로고침은 **모듈이 다시 적재되는 것**이다. `resetModules` + 재import 로 그걸 만든다.
   */
  it('🔴 접으면 localStorage 에 남는다', () => {
    draw()
    fireEvent.click(toggle())
    expect(localStorage.getItem('chwippo-nav-collapsed')).toBe('1')
  })

  it('🔴 새로고침해도 접힌 채로 뜬다 (저장값을 실제로 읽는다)', async () => {
    localStorage.setItem('chwippo-nav-collapsed', '1')
    vi.resetModules()
    const { useNavCollapsedStore: fresh } = await import(
      '@/stores/navCollapsedStore'
    )
    expect(fresh.getState().collapsed).toBe(true)
  })

  it('저장된 적이 없으면 펼친 채로 뜬다', async () => {
    localStorage.clear()
    vi.resetModules()
    const { useNavCollapsedStore: fresh } = await import(
      '@/stores/navCollapsedStore'
    )
    expect(fresh.getState().collapsed).toBe(false)
  })
})

describe('데모 모드', () => {
  beforeEach(() => {
    demoMock.mockReturnValue(true)
    localStorage.clear()
    useNavCollapsedStore.setState({ collapsed: false })
  })

  it('접기 버튼이 없다 (거짓 어포던스 방지)', () => {
    draw()
    expect(screen.queryByRole('button', { name: /메뉴 (접기|펼치기)/ })).toBeNull()
  })

  /**
   * 🔴 로그인 상태에서 접어둔 사람이 데모에 들어오는 경로. 저장값을 그대로 따르면
   * 접기 버튼도 없는 화면이 접힌 채 뜨고, **펼 방법이 없다.**
   */
  it('🔴 저장된 값이 접힘이어도 펼친 채로 뜬다', () => {
    useNavCollapsedStore.setState({ collapsed: true })
    draw()
    expect(rail().className).toContain('w-56')
    expect(screen.getByText('가입하고 시작하기 →')).toBeTruthy()
  })
})

/**
 * 🔴 **키보드로 어디에 있는지 보여야 한다** (2026-08-10 `/uiux`).
 *
 * 레일 안에서 접기 버튼에만 포커스 링이 있고 이동 항목엔 없어서, 탭으로 훑으면
 * **보이는 칸과 안 보이는 칸이 섞였다.** 마우스로는 절대 안 드러난다.
 */
describe('키보드 포커스', () => {
  beforeEach(() => {
    demoMock.mockReturnValue(false)
    localStorage.clear()
    useNavCollapsedStore.setState({ collapsed: false })
  })

  it('🔴 이동 항목에도 포커스 링이 있다', () => {
    draw()
    for (const name of ['캘린더', '지원 현황 보드', '설정', '도움말']) {
      const el = screen.getByRole('link', { name: new RegExp(`^${name}`) })
      expect(el.className, `${name} 에 포커스 링 없음`).toContain(
        'focus-visible:ring-2',
      )
    }
    expect(
      screen.getByRole('button', { name: '로그아웃' }).className,
    ).toContain('focus-visible:ring-2')
  })

  it('접힌 레일에서도 마찬가지다', () => {
    draw()
    fireEvent.click(toggle())
    expect(
      screen.getByRole('link', { name: /^캘린더/ }).className,
    ).toContain('focus-visible:ring-2')
  })
})
