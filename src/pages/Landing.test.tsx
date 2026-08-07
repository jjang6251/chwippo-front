/**
 * 랜딩 — **제품 상태와 어긋나면 안 된다.**
 *
 * 🔴 이 spec 의 목적은 "렌더되는가" 가 아니라 **랜딩이 하는 약속이 실제와 맞는가** 다.
 *
 * 2026-08-05 에 실제로 세 군데가 어긋나 있었다:
 *  - **AI 자소서 초안·점검이 이미 출시됐는데 "곧 출시" 배지**가 한 달 넘게 붙어 있었다.
 *    방문자는 없는 기능으로 알았다.
 *  - **"대시보드"** 로 안내했으나 그 메뉴는 "회고" 로 바뀐 지 오래였고, 회고 화면엔 D-day 가 없다.
 *  - **자소서가 PC 전용**(`useCoverletterReadOnly`: lg 미만·네이티브는 보기 전용)인데
 *    "관리하고 · 실시간 확인하세요" 로 안내해, 모바일 방문자에게 막다른 길을 약속했다.
 *
 * 셋 다 **아무 테스트도 울지 않아서** 오래 남았다. `Privacy.test` 가 "코드가 부르는 서드파티가
 * 방침 표에 있는가" 를 지키는 것과 같은 이유로, 여기서는 **랜딩 문구 ↔ 기능 플래그**를 묶는다.
 *
 * 시나리오: 출시 상태 배지 · 없어진 메뉴명 · PC 전용 고지 · 데모 진입
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Landing } from './Landing'
import { useInterviewAiEnabled } from '@/hooks/useAiEnabled'

// 랜딩은 마운트 시 자동 로그인(refresh)을 1회 시도한다 — 네트워크 차단
vi.mock('axios', () => ({
  default: { post: vi.fn(() => Promise.reject(new Error('no session'))) },
}))

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Landing — 출시 상태 고지', () => {
  /**
   * 🔴 **출시된 기능에 "곧 출시" 가 붙으면 안 된다.** 실제로 그래서 아무도 안 썼을 수 있다.
   * 2026-08-07 면접 AI 가 열리면서 **AI 카드 3장이 전부 출시 상태**가 됐다.
   */
  it('출시된 AI 카드에 "곧 출시" 가 없다', () => {
    renderLanding()
    for (const title of ['AI 자소서 초안', 'AI 자소서 점검', 'AI 면접 질문 뽑기']) {
      // 제목(h3)의 부모 = 카드 한 장. 조상까지 올라가면 섹션 전체가 잡혀 다른 카드의 배지가 섞인다
      const card = screen.getByText(title).closest('div')
      expect(card, `${title} 카드를 찾지 못함`).not.toBeNull()
      expect(card?.textContent).not.toContain('곧 출시')
      expect(card?.textContent).toContain('PC에서 사용 가능')
    }
  })

  /**
   * 🔴 **flag 와 랜딩 배지가 어긋나면 깨진다** — 양방향 가드다.
   *
   * flag 를 끄면(비공개 복귀) 랜딩은 다시 "곧 출시" 를 달아야 하고, 켜면 떼야 한다.
   * 이 테스트가 없으면 flag 만 토글하고 랜딩을 안 고쳐 **있는 기능을 없다고**
   * (또는 그 반대로) 안내하게 된다. 자소서 AI 가 실제로 한 달 넘게 그 상태였다.
   */
  it('면접 AI 배지가 useInterviewAiEnabled 상태와 일치한다', () => {
    renderLanding()
    const card = screen.getByText('AI 면접 질문 뽑기').closest('div')
    expect(card).not.toBeNull()
    if (useInterviewAiEnabled()) {
      expect(card?.textContent).toContain('PC에서 사용 가능')
      expect(screen.queryAllByText('곧 출시')).toHaveLength(0)
    } else {
      expect(card?.textContent).toContain('곧 출시')
    }
  })
})

describe('Landing — 제품과 이름이 맞는가', () => {
  /**
   * "대시보드" 는 캘린더 UX 재구성에서 사라진 이름이다(홈=/calendar, /dashboard 는 "회고").
   * 랜딩이 없는 메뉴로 안내하면 사용자는 앱에서 그걸 찾아 헤맨다.
   */
  it('사라진 메뉴명 "대시보드" 로 안내하지 않는다', () => {
    const { container } = renderLanding()
    expect(container.textContent).not.toContain('대시보드')
  })
})

describe('Landing — 모바일 방문자에게 못 하는 걸 약속하지 않는다', () => {
  /**
   * 🔴 자소서 작성·AI 는 데스크탑 웹 전용이다 (`useCoverletterReadOnly`).
   * 유입 대부분이 모바일이므로, PC 전용이라는 고지가 빠지면 그대로 막다른 길이 된다.
   */
  it('자소서 섹션이 PC 전용임을 알린다', () => {
    const { container } = renderLanding()
    const text = container.textContent ?? ''
    expect(text).toMatch(/PC/)
    expect(text).toMatch(/모바일/)
  })
})

describe('Landing — 진입 경로', () => {
  it('로그인 없이 둘러보기 링크가 /demo 를 가리킨다', () => {
    renderLanding()
    const demo = screen.getByRole('link', { name: /로그인 없이 둘러보기/ })
    expect(demo).toHaveAttribute('href', '/demo')
  })

  /**
   * 🔴 이전엔 `/inquiry` 를 걸었는데 그 라우트는 `AuthGuard` 안이라
   * **비로그인 방문자가 로그인으로 튕겼다** — 피드백을 달라면서 못 보내게 하고 있었다.
   */
  it('의견 보내기는 로그인이 필요 없는 경로여야 한다', () => {
    const { container } = renderLanding()
    const feedback = within(container).getByText(/의견 보내기/).closest('a')
    expect(feedback).not.toBeNull()
    expect(feedback?.getAttribute('href')).toMatch(/^mailto:/)
  })
})
