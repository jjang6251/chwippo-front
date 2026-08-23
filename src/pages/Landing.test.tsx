/**
 * 랜딩 — **제품 상태와 어긋나면 안 된다.**
 *
 * 🔴 이 spec 의 목적은 "렌더되는가" 가 아니라 **랜딩이 하는 약속이 실제와 맞는가** 다.
 *
 * 2026-08-05 에 실제로 세 군데가 어긋나 있었다:
 *  - **AI 자소서 초안·점검이 이미 출시됐는데 "곧 출시" 배지**가 한 달 넘게 붙어 있었다.
 *    방문자는 없는 기능으로 알았다.
 *  - **"대시보드"** 로 안내했으나 그 메뉴는 "회고" 로 바뀐 지 오래였고, 회고 화면엔 D-day 가 없다.
 *  - **자소서 AI 가 PC 전용**(`useCoverletterAiBlocked`: lg 미만·네이티브는 AI 차단)인데
 *    "관리하고 · 실시간 확인하세요" 로 안내해, 모바일 방문자에게 막다른 길을 약속했다.
 *
 * 셋 다 **아무 테스트도 울지 않아서** 오래 남았다. `Privacy.test` 가 "코드가 부르는 서드파티가
 * 방침 표에 있는가" 를 지키는 것과 같은 이유로, 여기서는 **랜딩 문구 ↔ 기능 플래그**를 묶는다.
 *
 * 시나리오: 출시 상태 배지 · 없어진 메뉴명 · PC 전용 고지 · 데모 진입
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { toast } from '@/stores/toastStore'
import { REFRESH_HTTP_TIMEOUT_MS } from '@/api/client'
import { Landing } from './Landing'
import { useInterviewAiEnabled } from '@/hooks/useAiEnabled'

// 랜딩은 마운트 시 자동 로그인(refresh)을 1회 시도한다 — 네트워크 차단
/**
 * 🔴 `create` 도 mock 한다 — 히어로가 **실제 `CompanyCard`** 를 렌더하면서
 * `@/api/client`(axios.create) 가 랜딩 모듈 그래프에 들어왔다 (2026-08-09).
 * `post` 만 있으면 `default.create is not a function` 으로 모듈 로드가 통째로 죽는다.
 */
vi.mock('axios', () => {
  const instance = {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    post: vi.fn(() => Promise.reject(new Error('no session'))),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: {
      create: vi.fn(() => instance),
      post: vi.fn(() => Promise.reject(new Error('no session'))),
    },
  }
})

/**
 * 🔴 `QueryClientProvider` 가 필요하다 — 히어로가 **실제 `CompanyCard`** 를 렌더하고,
 * 그 컴포넌트가 mutation 훅(`useUpdateCurrentStep` 등)을 부르기 때문이다 (2026-08-09).
 * 앱에서는 `main.tsx` 가 전체를 감싸므로 문제가 없고, **테스트만 빠져 있었다.**
 * 훅은 객체만 만들 뿐 `.mutate()` 전에는 요청을 보내지 않는다.
 */
function renderLanding() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Landing — 출시 상태 고지', () => {
  /**
   * 🔴 **출시된 기능에 "곧 출시" 가 붙으면 안 된다.** 자소서 AI 가 실제로 한 달 넘게
   * 그 상태였고, 방문자는 없는 기능으로 알았다.
   *
   * 예전엔 AI 카드 3장의 배지를 검사했는데, 섹션 축을 「대상」으로 통일하며(2026-08-09)
   * 카드가 각 섹션의 불릿으로 흡수돼 사라졌다. **배지가 아니라 문구 전체**를 본다 —
   * 지금은 전부 출시돼 있어 이 말이 랜딩 어디에도 있으면 안 된다.
   */
  it('🔴 랜딩 어디에도 "곧 출시" 가 없다', () => {
    const { container } = renderLanding()
    expect(container.textContent).not.toContain('곧 출시')
  })

  /**
   * 🔴 **flag 와 랜딩이 어긋나면 깨진다** — 양방향 가드다.
   *
   * flag 를 끄면(비공개 복귀) 랜딩도 면접을 광고하면 안 되고, 켜면 보여야 한다.
   * 이 테스트가 없으면 flag 만 토글하고 랜딩을 안 고쳐 **있는 기능을 없다고**
   * (또는 그 반대로) 안내하게 된다.
   */
  it('🔴 면접 섹션이 useInterviewAiEnabled 상태와 일치한다', () => {
    const { container } = renderLanding()
    const t = container.textContent ?? ''
    if (useInterviewAiEnabled()) {
      expect(t, 'flag 켜짐 — 면접 섹션이 보여야 한다').toContain('면접 질문을 뽑아줍니다')
      expect(t, '면접 PC 전용 고지').toContain('면접 준비는 PC에서')
    } else {
      expect(t, 'flag 꺼짐 — 면접을 광고하면 안 된다').not.toContain('면접 질문을 뽑아줍니다')
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
   * 🔴 자소서 AI(초안 채팅·검사)는 데스크탑 웹 전용이다 (`useCoverletterAiBlocked`).
   * (문항·답변 편집은 2026-08-23 부터 모바일에서도 된다 — 랜딩 문구는 아직 「작성은 PC」라
   *  적혀 있어 **실제보다 좁게 약속**한다. 거짓 약속은 아니라 이 spec 은 그대로 두되,
   *  문구 갱신은 후속 과제다.)
   * 유입 대부분이 모바일이므로, PC 전용이라는 고지가 빠지면 그대로 막다른 길이 된다.
   */
  it('자소서 섹션이 PC 전용임을 알린다', () => {
    const { container } = renderLanding()
    const text = container.textContent ?? ''
    expect(text).toMatch(/PC/)
    expect(text).toMatch(/모바일/)
  })
})

/**
 * 🔴 **랜딩이 파는 것이 사람들이 쓰는 것과 어긋나 있었다** (2026-08-09).
 *
 * 예전 HERO 는 `"취업 준비의 모든 것을 한 곳에서"` 로 **관리**를 팔았는데, 관측에서 제일 많이
 * 열리는 화면은 전형 단계 상세(`/board/:id/steps/:stepId`)였고 거기서 하는 일은
 * **「준비 체크리스트」를 적고 지우는 것**이었다. 그래서 약속을 준비로 옮겼다.
 *
 * 그 순간 **새 거짓말 위험이 생긴다** — 랜딩이 제품에 없는 이름을 부르거나, 모바일에서
 * 못 하는 걸 약속하는 것. 위 세 사고가 전부 그 유형이었으므로 같은 방식으로 묶는다.
 */
describe('Landing — 약속한 기능이 제품에 실제로 있는가', () => {
  /**
   * 🔴 **히어로는 스크린샷이 아니라 실제 `CompanyCard` 를 렌더한다** (2026-08-09).
   *
   * 스크린샷을 깔면 **카드 디자인이 바뀌는 순간 랜딩이 조용히 낡는다** — 이 파일에 적힌 사고
   * 세 건이 전부 그 유형이었다. 실물을 쓰면 그 어긋남이 원리적으로 안 생긴다.
   * 누가 다시 `<img>` 로 되돌리면 여기서 걸린다.
   */
  it('🔴 히어로가 실제 카드 컴포넌트를 렌더한다 (스크린샷 아님)', () => {
    const { container } = renderLanding()
    // 스텝바 단계명은 카드 컴포넌트만 그릴 수 있다 — 이미지였다면 텍스트로 안 잡힌다
    expect(container.textContent).toContain('1차 기술면접')
    expect(container.textContent).toContain('코딩테스트·과제')
    // 히어로 자리에 제품 스크린샷을 다시 깔지 않았는지
    const heroImgs = Array.from(container.querySelectorAll('img')).filter((i) =>
      (i.getAttribute('src') ?? '').includes('hero'),
    )
    expect(heroImgs).toHaveLength(0)
  })

  /**
   * 🔴 **랜딩의 카드는 눌리지도 포커스되지도 않아야 한다.**
   * `CompanyCard` 는 삭제·단계변경 mutation 을 들고 있다.
   *
   * 처음엔 `pointer-events-none` + `aria-hidden` 이었는데 **키보드가 안 막혔다** —
   * `aria-hidden` 안에 포커스 가능한 요소가 75개였고 Tab→Enter 로 mutation 이 실제로 발동됐다.
   * `inert` 는 클릭·포커스·보조기기 노출을 한 번에 막는다. (Tab 동선은 e2e 가 따로 지킨다)
   */
  it('🔴 히어로 카드가 inert 로 잠겨 있다 (mutation·포커스 차단)', () => {
    const { container } = renderLanding()
    const step = Array.from(container.querySelectorAll('*')).find((el) =>
      el.textContent?.trim() === '코딩테스트·과제',
    )
    expect(step).toBeTruthy()
    expect(step!.closest('[inert]'), 'inert 래퍼 없음').toBeTruthy()
  })

  it('🔴 히어로에서 무엇을 할 수 있는지 바로 보인다', () => {
    const { container } = renderLanding()
    const chips = container.querySelectorAll('h1 ~ ul li, ul li')
    const texts = Array.from(chips).map((c) => c.textContent ?? '')
    for (const label of ['지원 현황 · 일정 관리', 'AI 자소서', 'AI 면접 준비']) {
      expect(texts.some((t) => t.includes(label)), `${label} 칩 없음`).toBe(true)
    }
  })

  it('🔴 AI 칩 두 개에 PC 전용 표시가 붙어 있다', () => {
    const { container } = renderLanding()
    const chips = Array.from(container.querySelectorAll('li'))
    for (const label of ['AI 자소서', 'AI 면접 준비']) {
      const chip = chips.find((c) => c.textContent?.startsWith(label))
      expect(chip, `${label} 칩 없음`).toBeTruthy()
      expect(chip?.textContent, `${label} 에 PC 표시 없음`).toContain('PC')
    }
    // 전 기기에서 되는 것에는 안 붙는다 (과잉 표시 방지)
    const free = chips.find((c) => c.textContent?.startsWith('지원 현황'))
    expect(free?.textContent).not.toContain('PC')
  })

  /**
   * 🔴 **h1 은 바로 아래 화면이 증명할 수 있는 것만 말해야 한다** (2026-08-09).
   *
   * 초안 `"다음 전형까지 / 뭘 준비하지?"` 는 **묻는 것과 화면이 답하는 것이 달랐다** —
   * 질문은 "준비" 인데 히어로 보드는 "어디까지 왔는지"(단계·D-day·진행률)를 보여준다.
   * 「준비 체크리스트」를 보여주던 섹션을 뺀 뒤라 그 약속을 받아주는 자리도 없었다.
   *
   * 그래서 **h1 이 말하는 것 ↔ 히어로가 그리는 것**을 묶는다. 카드가 사라지면 h1 도
   * 근거를 잃으므로 여기서 같이 걸린다.
   */
  it('🔴 h1 의 약속을 히어로 화면이 증명한다', () => {
    const { container } = renderLanding()
    const h1 = container.querySelector('h1')?.textContent ?? ''
    expect(h1).toContain('회사')

    // 변별력 없는 옛 문구로 되돌아가지 않게 — 모든 취업 서비스가 하는 말이다
    expect(h1).not.toContain('한 곳에서')
    expect(h1).not.toContain('모든 것')

    // 여러 회사가 각각 다른 단계에 놓인 화면이 그 근거다
    const t = container.textContent ?? ''
    for (const co of ['카카오', '삼성전자', '네이버']) expect(t).toContain(co)
    expect(t, '진행 중 단계').toContain('1차 기술면접')
    expect(t, '끝까지 간 카드').toContain('최종 합격')
  })

})

/**
 * 🔴 **랜딩에 제품 스크린샷을 다시 들이지 않는다** (2026-08-09).
 *
 * 이미지는 UI 가 바뀌는 순간 **조용히 낡고**, 다크 모드에 박제된다 — 라이트 모드에서
 * 실물 컴포넌트들 사이에 이미지 하나만 어두운 채로 남아 있는 게 눈에 보였다.
 * 이 파일에 적힌 사고 세 건이 전부 "랜딩이 제품과 어긋남" 이었고, 실물을 쓰면
 * 그 어긋남이 원리적으로 안 생긴다.
 *
 * `og-image` 는 공유 카드용이라 예외 — 화면에 안 그려진다.
 */
describe('Landing — 스크린샷으로 되돌아가지 않는다', () => {
  it('🔴 제품 화면을 이미지로 넣지 않는다', () => {
    const { container } = renderLanding()
    const imgs = Array.from(container.querySelectorAll('img, source'))
      .map((el) => el.getAttribute('src') ?? el.getAttribute('srcSet') ?? '')
      .filter((u) => /\.(webp|png|jpe?g)$/.test(u) && !u.includes('og-image'))
    expect(imgs, `제품 스크린샷 발견: ${imgs.join(', ')}`).toEqual([])
  })

  /** 실물을 쓴다는 증거 — 컴포넌트만 그릴 수 있는 텍스트가 나와야 한다 */
  it('🔴 각 섹션이 실제 컴포넌트로 그려진다', () => {
    const { container } = renderLanding()
    const t = container.textContent ?? ''
    expect(t, '히어로 카드(StepBar)').toContain('코딩테스트·과제')
    expect(t, '캘린더 D-day 카드').toContain('KB국민은행')
    // 🔴 **문구 자체가 아니라 "그 섹션이 실물로 그려졌는가"** 를 본다.
    //    심층 샘플의 인물(직군)은 바뀔 수 있다 — 실제로 백엔드 → 브랜드 마케팅으로 한 번 바꿨다.
    expect(t, '자소서 문항 카드').toContain('지원하게 된 동기를 작성해 주세요')
    expect(t, '자소서 AI 대화').toMatch(/줄여|다듬|당기고/)
    expect(t, '면접 읽기 모드').toContain('1분 자기소개')
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

/**
 * 🔴 랜딩의 자동 로그인은 **공용 통로(performRefresh)를 일부러 쓰지 않는다** —
 * 그 경로는 실패 시 handleAuthFailure(토스트 + clearAuth + '/' 이동)를 타는데,
 * 랜딩에서의 401 은 비로그인 방문자의 **정상 상태**다. 갈아끼우면 첫 방문자가
 * "로그인이 만료되었습니다" 토스트와 '/' 재이동(무한 새로고침)을 겪는다.
 *
 * 대신 시간 상한만 doRefresh 와 맞춘다 — 없으면 회전이 무한정 매달린다.
 * 이 두 계약(직접 호출 유지 · 상한 부착)이 함께 성립해야 한다.
 */
describe('Landing — 자동 로그인 회전 계약', () => {
  it('refresh 요청에 시간 상한이 붙는다', async () => {
    renderLanding()
    await waitFor(() => expect(axios.post).toHaveBeenCalled())
    const [, , config] = vi.mocked(axios.post).mock.calls[0] ?? []
    expect((config as { timeout?: number } | undefined)?.timeout).toBe(
      REFRESH_HTTP_TIMEOUT_MS,
    )
    expect((config as { withCredentials?: boolean } | undefined)?.withCredentials).toBe(true)
  })

  it('회전 실패(401)에도 토스트·이동 없이 랜딩을 유지한다', async () => {
    const errorSpy = vi.spyOn(toast, 'error')
    const href = window.location.href
    renderLanding()
    await waitFor(() => expect(axios.post).toHaveBeenCalled())
    expect(errorSpy).not.toHaveBeenCalled()
    expect(window.location.href).toBe(href)
    errorSpy.mockRestore()
  })
})
