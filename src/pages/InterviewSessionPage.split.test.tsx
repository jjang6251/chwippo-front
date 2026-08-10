/**
 * 면접 ↔ 자소서 나란히 보기 — **3단 접힘과 그 부작용.**
 *
 * 🔴 **왜 필요했나** (2026-08-10). 면접 질문은 자소서에서 나온 것인데(모델을 「자료 밀착도」로
 * 골랐다), 답을 쓸 때 그 자소서를 볼 수 없어 화면을 나갔다 돌아와야 했다.
 *
 * 이 spec 이 잠그는 것:
 *   ① 접힌 쪽이 **세로 탭으로 남는다** — 없애면 되돌리는 법을 기억에 맡기게 된다
 *   ② 반반일 땐 **자료 사이드바가 접힌다** — 504px 에 280px 을 두면 질문이 224px 밖에 안 남는다
 *   ③ 그런데 **저장값은 안 건드린다** — 사용자가 고른 설정이고 「면접만」으로 오면 복원돼야 한다
 *   ④ 좁은 화면엔 **전환 컨트롤이 없고** 대신 자소서로 건너가는 링크가 있다
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewSessionPage } from './InterviewSessionPage'

const mq = vi.hoisted(() => ({ narrow: false }))
const qs = vi.hoisted(() => ({ list: [] as unknown[] }))
/** 나란히 보기는 **컨테이너 폭**으로 판정한다 — 뷰포트가 아니다 (스크롤바가 경계를 넘겨서) */
const box = vi.hoisted(() => ({ width: 1200 }))

/**
 * 🔴 **jsdom 은 레이아웃을 안 해 `getBoundingClientRect()` 가 전부 0 이다.**
 * 그러면 드래그의 `track = width - 62` 가 음수라 비율이 **한 번도 갱신되지 않고**,
 * 「끝까지 밀면 접힌다」 분기는 실행조차 되지 않는다 — 테스트가 있어도 그 코드는
 * 검증된 적이 없다는 뜻이다. 폭·좌표를 주어 그 분기를 실제로 지나가게 한다.
 */
function stubRects(width: number) {
  Element.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 200, width, height: 800, top: 200, left: 0, right: width, bottom: 1000, toJSON: () => ({}) } as DOMRect
  }
}
/** 원하는 비율이 나오는 커서 x — 컴포넌트의 역산식과 같은 식 (chrome 62px 제외) */
const xForRatio = (r: number, width = box.width) => r * (width - 62) + 31
/** cold load 재현 — 첫 렌더는 반드시 스켈레톤이다 */
const sess = vi.hoisted(() => ({ loading: false }))
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => mq.narrow }))

/*
  jsdom 은 레이아웃이 없어 `contentRect.width` 가 항상 0 이다.
  폭을 주입해 판정식만 검증한다 — 실제 픽셀은 브라우저에서만 의미가 있다.
*/
const realRect = Element.prototype.getBoundingClientRect

beforeEach(() => {
  stubRects(box.width)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb
      }
      observe() {
        this.cb(
          [{ contentRect: { width: box.width } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        )
      }
      unobserve() {}
      disconnect() {}
    },
  )
})

const session = {
  id: 's-1',
  applicationId: 'app-1',
  round: '1차 실무 면접',
  interviewType: null,
  coverletterIds: ['cl-1'],
  extraLogIds: [],
  myMemo: null,
  jobDescription: null,
  emphasisPoints: null,
  userResearchNotes: null,
  generationStatus: 'completed',
  createdAt: '2026-08-10T00:00:00.000Z',
}

vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSession: () =>
    sess.loading
      ? { data: undefined, isLoading: true, isError: false }
      : { data: session, isLoading: false, isError: false },
  useInterviewPrepQuestions: () => ({ data: qs.list, isLoading: false, isError: false }),
  useInterviewPrepRefs: () => ({ data: undefined }),
  useGenerateInterviewSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteInterviewSession: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateInterviewPrepSession: () => ({ mutate: vi.fn(), isPending: false }),
  useRefetchQuestionsOnGenerationEnd: vi.fn(),
  questionsKey: (id: string) => ['interview-prep-questions', id],
  sessionKey: (id: string) => ['interview-prep-session', id],
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: { companyName: '아모레퍼시픽' } }),
  useUpdateApplication: () => ({ mutateAsync: vi.fn() }),
}))
/** 자소서 문항 — 바닥 마무리 줄이 문항 유무를 탄다 */
const cls = vi.hoisted(() => ({
  base: [] as unknown[],
  loading: false,
  error: false,
  enabledCalls: [] as boolean[],
  list: [
    {
      id: 'cl-1',
      applicationId: 'app-1',
      category: '지원동기',
      question: '지원하게 된 동기를 작성해 주세요.',
      answer: '경품을 키우는 대신 참여 문턱을 낮췄습니다.',
      charLimit: 800,
      orderIndex: 0,
    },
  ] as unknown[],
}))
cls.base = cls.list
vi.mock('@/hooks/useApplicationCoverletters', () => ({
  useCoverletters: (_id: string, enabled: boolean) => {
    cls.enabledCalls.push(enabled)
    return { data: cls.list, isLoading: cls.loading, isError: cls.error }
  },
  useUpdateCoverletter: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useMyAiQuotas', () => ({
  useAiQuotaBlocked: () => ({ blocked: false, reason: null }),
  useMyAiQuota: () => undefined,
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({ useRequireAiConsent: () => vi.fn() }))
vi.mock('@/hooks/useRequireJobTitle', () => ({
  useRequireJobTitle: () => vi.fn(),
  resolveJobText: () => '',
}))
vi.mock('@/hooks/useUnloadGuard', () => ({ useUnloadGuard: vi.fn() }))
/* 사이드바 자식들은 각자 훅을 또 끌고 온다 — 이 spec 이 보는 건 레이아웃이다 */
vi.mock('@/components/common/JobTitleField', () => ({ JobTitleField: () => null }))
vi.mock('@/components/card/CompanyResearchCard', () => ({ CompanyResearchCard: () => null }))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({ JobPostingBanner: () => null }))
vi.mock('@/components/card/EditInterviewSessionModal', () => ({
  EditInterviewSessionModal: () => null,
}))
vi.mock('@/components/card/InterviewQuestionCard', () => ({ InterviewQuestionCard: () => null }))
vi.mock('@/components/coverletter/CoverletterQuestionCard', () => ({
  CoverletterQuestionCard: () => null,
}))
vi.mock('@/components/common/AiQuotaChip', () => ({ AiQuotaChip: () => null }))

const draw = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/interviews/s-1']}>
        <InterviewSessionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/*
  🔴 **jsdom 은 CSS 를 적용하지 않는다.** 사이드바는 `hidden md:block` 으로 감춰지므로
  DOM 에는 늘 남아 있다 — 존재 여부로는 접힘을 못 잰다.
  대신 헤더의 **「자료 보기」(펼치기) 버튼**을 본다. 이건 `!sidebarOn` 일 때만 렌더된다.
*/
/**
 * 자료 사이드바가 접혔는가.
 *
 * 🔴 예전엔 「자료 보기」 버튼의 **존재 여부**로 쟀는데, 그 버튼이 반반에서 유령이라
 * 사라지면서 못 쓰게 됐다. jsdom 은 CSS 를 적용하지 않아 `hidden md:block` 요소가
 * DOM 에 그대로 남으므로 **존재 여부로는 잴 수 없다** — 클래스를 직접 본다.
 */
const collapsed = () =>
  (document.querySelector('aside') as HTMLElement).className.includes('md:hidden')

const handle = () => screen.getByRole('button', { name: /구분선/ })
/** 구분선 자체 — 더블클릭하면 반반 */
const divider = () => handle().parentElement as HTMLElement

/**
 * 손잡이를 잡고 목표 비율까지 끌었다 놓는다. rAF 로 묶여 있어 한 프레임을 기다려야 한다.
 * `0.85 이상` / `0.15 이하` 로 밀면 그쪽이 접힌다 — 이제 **한쪽만 보기로 가는 유일한 길**이다.
 */
async function dragToRatio(r: number) {
  fireEvent.pointerDown(divider(), { clientX: xForRatio(0.5), pointerId: 1 })
  fireEvent(window, new MouseEvent('pointermove', { clientX: xForRatio(r), bubbles: true }) as unknown as Event)
  await act(async () => {
    await new Promise((res) => requestAnimationFrame(() => res(null)))
  })
  fireEvent(window, new MouseEvent('pointerup', { bubbles: true }) as unknown as Event)
}

describe('3단 접힘 (넓은 화면)', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200 // 나란히가 되는 폭
    localStorage.clear()
    qs.list = []
  })

  it('기본은 면접만 — 자소서는 세로 탭으로 접혀 있다', () => {
    draw()
    expect(screen.getByRole('button', { name: '자소서 펼치기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '면접 펼치기' })).toBeNull()
  })

  /**
   * 🔴 **누르면 반반이다** (2026-08-10 점검에서 뒤집음).
   *
   * 전에는 클릭이 전면 스왑이고 반반은 더블클릭 전용이었는데, 브라우저 실측에서
   * **사람 속도의 더블클릭이 한 번도 반반에 도달하지 못했다** (0·120·250·400ms 전부).
   * 첫 클릭이 스왑하면서 구분선이 반대편으로 이동해 두 번째 클릭이 빗나가기 때문이다.
   * 나란히 보기가 이 화면의 존재 이유인데 **드래그 말고는 가는 길이 없었다.**
   */
  it('🔴 손잡이를 누르면 반반이 된다', () => {
    draw()
    fireEvent.click(handle())
    // 양쪽 다 열려 있다 — 접힌 세로 탭이 하나도 없다
    expect(screen.queryByRole('button', { name: '자소서 펼치기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '면접 펼치기' })).toBeNull()
    expect(screen.getByText('자기소개서')).toBeTruthy()
  })

  /**
   * 🔴 **세로 탭은 이름대로 「펼치기」다** (2026-08-10 CEO: "이거 분할이 아니라
   * 서로 펼치는 걸로 가는 게 나을 것 같아").
   *
   * 한때 탭도 반반으로 열었는데, 버튼에 **「자소서 펼치기」라고 쓰여 있으면서 반반이 되면**
   * 이름과 결과가 어긋난다. 반반은 손잡이가 맡는다.
   */
  it('🔴 세로 탭을 누르면 그쪽만 펼쳐진다', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: '자소서 펼치기' }))
    expect(screen.getByText('자기소개서')).toBeTruthy()
    expect(screen.getByRole('button', { name: '면접 펼치기' })).toBeTruthy() // 면접은 탭이 됐다
  })

  /**
   * 🔴 한쪽만 보기로 가는 **유일한 길**. jsdom 좌표를 주지 않으면 이 분기는
   * 실행조차 되지 않아, 있어도 검증된 적 없는 코드가 된다.
   */
  it('🔴 끝까지 밀면 그쪽이 접힌다', async () => {
    draw()
    fireEvent.click(handle())
    await dragToRatio(0.9) // 면접 쪽으로 끝까지 → 자소서가 접힘
    expect(screen.getByRole('button', { name: '자소서 펼치기' })).toBeTruthy()
  })

  it('🔴 반대로 끝까지 밀면 면접이 접힌다', async () => {
    draw()
    fireEvent.click(handle())
    await dragToRatio(0.1)
    expect(screen.getByRole('button', { name: '면접 펼치기' })).toBeTruthy()
  })

  /**
   * 🔴 열이 504px 인데 사이드바가 280px 을 먹으면 질문에 224px 밖에 안 남는다.
   */
  it('🔴 반반이면 자료 사이드바가 접힌다', () => {
    draw()
    expect(collapsed()).toBe(false) // 면접만 — 펼쳐져 있음
    fireEvent.click(handle())
    expect(collapsed()).toBe(true)
  })

  /**
   * 🔴 **저장값은 안 건드린다.** `sidebarExpanded` 는 사용자가 고른 설정이라,
   * 반반이 강제로 껐다고 해서 그 선택까지 지우면 안 된다.
   */
  it('🔴 「면접만」으로 돌아오면 사이드바가 복원된다', async () => {
    draw()
    fireEvent.click(handle())
    expect(collapsed()).toBe(true)
    await dragToRatio(0.9) // 끝까지 밀어 면접만으로
    expect(collapsed()).toBe(false)
  })
})

describe('좁은 화면 — 나란히 대신 건너간다', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 600 // 기준 미만 — 나란히 불가
    mq.narrow = true // 질문 목록 쪽(639px)은 그대로 mock
    localStorage.clear()
    /* 링크는 질문 목록 툴바 안에 있다 — 답을 쓰다 자소서를 찾는 자리이기 때문 */
    qs.list = [
      { id: 'q1', depth: 0, orderIndex: 0, category: 'self_intro', questionText: 'Q1', children: [], sourceLogIds: [], myMemo: null, suggestedAnswer: null, materialGap: null, mustPrepare: false, followupBasis: null },
    ]
  })

  /** 1024px 미만에서 2열은 열당 250px 도 안 나온다 */
  it('🔴 전환 컨트롤이 없다', () => {
    draw()
    expect(screen.queryByRole('button', { name: '자소서 펼치기' })).toBeNull()
    expect(screen.queryByRole('button', { name: /구분선/ })).toBeNull()
  })

  it('🔴 대신 자소서로 건너가는 링크가 있다', () => {
    draw()
    const link = screen.getByRole('link', { name: /자소서 보기/ })
    expect(link.getAttribute('href')).toBe('/board/app-1/coverletter')
  })
})

/**
 * 🔴 **첫 렌더가 스켈레톤이면 측정이 시작되나** (2026-08-10 실사고).
 *
 * 예전엔 `useRef` + `useLayoutEffect([])` 였다. 첫 렌더는 세션 로딩 스켈레톤이라
 * 그 시점 `ref.current` 가 `null` 인데 deps 가 `[]` 라 **다시 실행되지 않았다** —
 * ResizeObserver 가 영원히 안 붙고 `contentW` 가 0 에 머물렀다.
 *
 * 🔴 그런데 **0 이면 `narrow=false`(넓다고 가정)** 라 넓은 화면 테스트는 그대로 통과한다.
 * 좁은 화면에서만 드러난다 — 측정이 죽어 있으면 390px 에서도 2열이 그려진다.
 * 그래서 이 케이스는 **반드시 좁은 폭 + cold load** 조합이어야 한다.
 *
 * 기존 spec 은 마운트 즉시 데이터를 주는 mock 이라 **스켈레톤이 선행하는 상황 자체를
 * 재현하지 못했다.** 「내 픽스처로 내 전제를 검증할 수 없다」의 재발이었다.
 */
describe('cold load — 스켈레톤이 먼저 와도 폭을 잰다', () => {
  beforeEach(() => {
    box.width = 600 // 좁다 — 측정이 살아 있으면 2열이 안 나와야 한다
    localStorage.clear()
    qs.list = []
  })

  it('🔴 로딩 뒤에 붙은 컨테이너도 관찰된다 (좁으면 2열이 안 뜬다)', () => {
    sess.loading = true
    const { rerender } = draw()
    // 스켈레톤 단계 — 아직 컨테이너가 없다
    expect(screen.queryByRole('button', { name: /구분선/ })).toBeNull()

    sess.loading = false
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/interviews/s-1']}>
          <InterviewSessionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // 측정이 살아 있으면 600px 은 좁다고 판정돼 구분선이 없다
    expect(screen.queryByRole('button', { name: /구분선/ })).toBeNull()
    expect(screen.queryByRole('button', { name: '자소서 펼치기' })).toBeNull()
  })
})

/**
 * 🔴 **스크롤 잠금은 반드시 풀려야 한다.**
 *
 * 분할일 때 `body` 스크롤을 잠근다 — 열마다 스크롤이 있는데 바깥까지 움직이면
 * 어느 것을 조작하는지 알 수 없기 때문이다. 그런데 **푸는 걸 빠뜨리면 훨씬 나쁘다**:
 * 다른 화면으로 나가도 스크롤이 죽어 **앱 전체가 멈춘 것처럼** 보인다.
 * 되돌리는 경로(모드 전환·언마운트)를 둘 다 잠근다.
 */
const locked = () => document.body.classList.contains('split-locked')

describe('분할 중 스크롤 잠금', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    qs.list = []
    document.body.className = ''
  })

  it('한쪽만 볼 땐 잠그지 않는다 (기본 상태)', () => {
    draw()
    expect(locked()).toBe(false)
  })

  it('🔴 분할로 들어가면 잠그고, 나오면 푼다', async () => {
    draw()
    fireEvent.click(handle()) // 반반
    expect(locked()).toBe(true)
    await dragToRatio(0.9) // 끝까지 밀어 한쪽만 보기로
    expect(locked()).toBe(false)
  })

  it('🔴 분할인 채로 화면을 떠나도 풀린다', () => {
    const { unmount } = draw()
    fireEvent.click(handle())
    expect(locked()).toBe(true)
    unmount()
    expect(locked()).toBe(false)
  })
})

/**
 * 🔴 **모달이 잠금을 풀어버리면 안 된다.**
 *
 * 모달은 `document.body.style.overflow` 를 직접 만지고, 닫을 때 `''` 로 되돌린다.
 * 분할 잠금을 같은 인라인 자리에 걸면 **모달을 한 번 열었다 닫는 것만으로** 잠금이 사라진다 —
 * 사용자 입장에선 "세션 편집 좀 봤더니 다시 바깥 스크롤이 생겼다" 가 된다.
 * 그래서 잠금은 클래스로 두고, 모달의 인라인 값이 열려 있는 동안만 이기게 한다.
 */
describe('모달과의 공존', () => {
  it('🔴 모달이 인라인 overflow 를 되돌려도 분할 잠금은 남는다', () => {
    sess.loading = false
    box.width = 1200
    document.body.className = ''
    draw()
    fireEvent.click(handle())
    expect(locked()).toBe(true)

    // 모달이 하는 일 그대로 — 열 때 잠그고 닫을 때 인라인을 비운다
    document.body.style.overflow = 'hidden'
    document.body.style.overflow = ''

    expect(locked()).toBe(true) // 클래스는 그대로
  })
})

/**
 * 🔴 **자소서 열의 바닥 마무리 줄** (CEO: "분할되면 아래가 좀 비어보인다").
 *
 * 열을 뷰포트 높이에 고정하니 자소서 문항이 적을 때 아래가 통째로 빈 배경이 됐다
 * (1440×900 실측: 문항 2개 = 174px). 바닥에 붙는 한 줄로 **끝을 만든다.**
 *
 * 이 spec 이 잠그는 건 두 가지다:
 *   ① 문항이 있으면 마무리 줄이 있다 — 그리고 **자소서 열 안에** 있다 (면접 열이 아니라)
 *   ② 문항이 없으면 없다 — 빈 상태 카드가 이미 안내와 CTA 를 다 하고 있어 중복이다
 */
describe('자소서 열 바닥 마무리 줄', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    cls.loading = false
    cls.error = false
    cls.enabledCalls = []
    document.body.className = ''
  })

  const pane = () => screen.getByRole('region', { name: '자기소개서' })

  it('🔴 마무리 줄이 자소서 열 안에 있다', () => {
    draw()
    fireEvent.click(handle()) // 반반
    const note = screen.getByText('여기선 글자만 고쳐요')
    expect(pane().contains(note)).toBe(true)
  })

  /** 헤더 `title` 에만 있던 설명을 눈에 보이게 꺼낸 것 — 링크가 살아 있어야 의미가 있다 */
  it('감춰진 기능이 어디 있는지 가리킨다', () => {
    draw()
    fireEvent.click(handle())
    const link = screen.getByRole('link', { name: /문항 추가는 자소서 화면에서/ })
    expect(link.getAttribute('href')).toContain('/coverletter')
  })

  it('문항이 없으면 마무리 줄도 없다 (빈 상태 카드와 중복)', () => {
    cls.list = []
    draw()
    fireEvent.click(handle())
    expect(screen.queryByText('여기선 글자만 고쳐요')).toBeNull()
  })
})

/**
 * 🔴 **구분선 드래그** — CEO 실기 질문 "사이즈 조절할 때 버벅거리나?" 에서 나온 것들.
 *
 * 실측으로 세 가지가 드러났고, 셋 다 「버벅임」으로 뭉뚱그려 보였다:
 *
 *   ① **드래그가 아예 안 걸리는 구간** — 이동·종료를 구분선 엘리먼트(22px 폭)에서 받고
 *      4px 을 넘긴 뒤에야 포인터를 캡처했다. 빠르게 그으면 첫 이동이 이미 그 밖이라
 *      이벤트가 안 온다. 천천히 끌면 되살아나 「될 때도 있고 안 될 때도」로 보였다.
 *   ② **끄는 동안에도 240ms 전환이 켜져 있었다** — 손잡이가 커서에서 평균 79px 뒤처졌다.
 *   ③ **비율 계산이 간격·구분선 폭(62px)을 빼지 않았다** — 가장자리에서 최대 21px 어긋남.
 *
 * 고친 뒤 실측: 커서와의 거리 평균 0px · 최대 0px.
 *
 * jsdom 은 레이아웃을 안 하므로 px 은 못 잰다. 대신 **이벤트가 도달하는가**와
 * **전환이 꺼지는가**를 잠근다 — ①②의 원인이 정확히 그 둘이다.
 */
describe('구분선 드래그', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    cls.loading = false
    cls.error = false
    cls.enabledCalls = []
    document.body.className = ''
    document.body.style.userSelect = ''
  })

  /** 구분선 밖 좌표로 한 번에 이동 — 예전 구현은 여기서 아무 일도 일어나지 않았다 */
  const flick = (toX: number) => {
    fireEvent.pointerDown(divider(), { clientX: 600, pointerId: 1 })
    fireEvent(
      window,
      new MouseEvent('pointermove', { clientX: toX, bubbles: true }) as unknown as Event,
    )
  }

  it('🔴 첫 이동이 구분선 밖이어도 드래그가 시작된다 (빠르게 긋기)', () => {
    draw()
    fireEvent.click(handle()) // 반반
    flick(900) // 구분선(22px) 을 한 번에 벗어나는 거리
    expect(document.body.style.userSelect).toBe('none')
  })

  it('🔴 끄는 동안엔 전환 애니메이션이 꺼진다', () => {
    draw()
    fireEvent.click(handle())
    const grid = divider().parentElement as HTMLElement
    expect(grid.className).toContain('transition-[grid-template-columns]')

    flick(900)
    expect(grid.className).not.toContain('transition-[grid-template-columns]')

    fireEvent(window, new MouseEvent('pointerup', { bubbles: true }) as unknown as Event)
    expect(grid.className).toContain('transition-[grid-template-columns]') // 스냅은 다시 애니메이션
  })

  /** 4px 이하는 드래그가 아니라 클릭 — 한 번 눌러 펼치기가 그 버튼이다 */
  it('살짝 눌렀다 떼면 드래그로 보지 않는다', () => {
    draw()
    fireEvent.pointerDown(divider(), { clientX: 600, pointerId: 1 })
    fireEvent(window, new MouseEvent('pointermove', { clientX: 602, bubbles: true }) as unknown as Event)
    expect(document.body.style.userSelect).toBe('')
  })

  /**
   * 🔴 끄는 중에 화면을 떠나면 `user-select: none` 이 앱 전체에 남는다 —
   * 어느 화면에서도 **글자를 긁을 수 없게** 된다. 원인 화면은 이미 사라진 뒤라 못 찾는다.
   */
  it('🔴 끄는 중에 화면을 떠나도 선택 금지가 남지 않는다', () => {
    const { unmount } = draw()
    fireEvent.click(handle())
    flick(900)
    expect(document.body.style.userSelect).toBe('none')
    unmount()
    expect(document.body.style.userSelect).toBe('')
  })
})

/**
 * 🔴 **끌고 놓으면 클릭이 따라온다** (CEO: "고정될 때도 있고 갑자기 면접이 펼쳐진다").
 *
 * 손잡이가 커서를 정확히 따라가게 만든 순간 생긴 회귀다 — **놓는 지점이 거의 항상 버튼 위**라
 * 브라우저가 click 을 발행하고, 그 핸들러는 「한 번 누르면 펼치기」다. 방금 맞춘 비율이
 * 통째로 날아간다.
 *
 * 예전엔 `setPointerCapture` 가 우연히 막고 있었다 (캡처 중 click 은 캡처 대상으로 옮겨간다).
 * 캡처를 걷어내면서 그 방패가 사라졌으므로, 이제 **의도한 자리에서** 막는다.
 *
 * 두 방향을 다 잠근다 — 막는 것만 검증하면 **클릭을 영영 죽여도** 통과한다.
 */
describe('끌고 난 뒤의 클릭', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    cls.loading = false
    cls.error = false
    cls.enabledCalls = []
    document.body.className = ''
    document.body.style.userSelect = ''
  })

  const drag = (toX: number) => {
    fireEvent.pointerDown(divider(), { clientX: 600, pointerId: 1 })
    fireEvent(window, new MouseEvent('pointermove', { clientX: toX, bubbles: true }) as unknown as Event)
    fireEvent(window, new MouseEvent('pointerup', { bubbles: true }) as unknown as Event)
  }

  it('🔴 끈 직후의 클릭은 무시된다 (비율이 날아가지 않는다)', () => {
    draw()
    fireEvent.click(handle()) // 반반
    drag(760)
    fireEvent.click(handle()) // 브라우저가 자동으로 발행하는 그 클릭
    // 반반이 유지된다 — 접혔다면 세로 탭이 생겼을 것이다
    expect(screen.queryByRole('button', { name: '자소서 펼치기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '면접 펼치기' })).toBeNull()
  })

  /** 🔴 반대쪽 — 막는 게 영구적이면 손잡이를 눌러 반반으로 가는 길이 사라진다 */
  it('🔴 그냥 누르는 건 여전히 반반으로 간다', () => {
    draw()
    fireEvent.click(handle())
    expect(screen.getByText('자기소개서')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '자소서 펼치기' })).toBeNull()
  })

  it('🔴 끈 다음 번 클릭은 다시 살아난다 (한 번만 막는다)', async () => {
    draw()
    fireEvent.click(handle())
    await dragToRatio(0.9) // 끝까지 밀어 자소서를 접었다
    expect(screen.getByRole('button', { name: '자소서 펼치기' })).toBeTruthy()

    fireEvent.click(handle()) // 브라우저가 자동 발행하는 클릭 — 먹혀야 한다
    expect(screen.getByRole('button', { name: '자소서 펼치기' })).toBeTruthy() // 접힌 그대로

    await new Promise((r) => setTimeout(r, 0)) // 클릭이 다 흘러간 뒤
    fireEvent.click(handle()) // 사용자가 진짜로 누른 것
    expect(screen.queryByRole('button', { name: '자소서 펼치기' })).toBeNull() // 반반
  })
})

/**
 * 🔴 **모르는 상태를 「없음」으로 말하지 않는다** (2026-08-10 점검).
 *
 * 자소서 쿼리는 **나란히 열 때 처음** 켜진다. 로딩을 가르지 않으면 여는 순간마다
 * 「아직 작성된 자소서 문항이 없어요 · 자소서 쓰러 가기」가 번쩍이고, 조회가 실패하면
 * **그 거짓말이 영구 고정**된다 — 세션이 참조하는 자소서가 실제로 있는데도.
 * 프로젝트가 false-empty 를 버그로 규정하는 이유가 이것이다.
 */
describe('자소서 열 — 로딩·에러', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    cls.loading = false
    cls.error = false
    cls.enabledCalls = []
    document.body.className = ''
  })

  const EMPTY = /아직 작성된 자소서 문항이 없어요/

  it('🔴 불러오는 동안엔 「없어요」라고 하지 않는다', () => {
    cls.loading = true
    cls.list = []
    draw()
    fireEvent.click(handle()) // 반반
    expect(screen.queryByText(EMPTY)).toBeNull()
  })

  it('🔴 조회 실패는 빈 상태가 아니라 실패라고 말한다', () => {
    cls.error = true
    cls.list = []
    draw()
    fireEvent.click(handle())
    expect(screen.queryByText(EMPTY)).toBeNull()
    expect(screen.getByText(/자소서를 불러오지 못했어요/)).toBeTruthy()
  })

  it('진짜로 0개면 빈 상태를 보여준다 (기존 동작)', () => {
    cls.list = []
    draw()
    fireEvent.click(handle())
    expect(screen.getByText(EMPTY)).toBeTruthy()
  })
})

/**
 * 🔴 **반반에선 「자료 보기」가 유령이었다** (2026-08-10 점검).
 *
 * `sidebarOn` 은 반반이면 항상 false 라 버튼이 늘 보였는데, 누르면 화면은 그대로이고
 * **저장값만 뒤집혔다.** 「면접만」으로 돌아오면 사이드바가 사용자가 둔 것과 반대가 돼 있었다 —
 * 코드 자신의 주석("저장값을 바꾸지는 않는다")과 정면으로 어긋났다.
 */
describe('반반에서의 자료 보기 버튼', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    document.body.className = ''
  })

  it('🔴 반반이면 렌더하지 않는다', () => {
    draw()
    fireEvent.click(handle()) // 반반
    expect(screen.queryByRole('button', { name: '자료 사이드바 펼치기' })).toBeNull()
  })

  it('한쪽만 볼 때 접혀 있으면 여는 버튼이 있다 (기존 동작)', () => {
    localStorage.setItem('interview:sidebar-expanded:v1', 'false')
    draw()
    expect(screen.getByRole('button', { name: '자료 사이드바 펼치기' })).toBeTruthy()
  })
})

/**
 * 🔴 **손잡이는 세 상태를 순환한다** (2026-08-10 CEO: "한쪽만 펼치려면 꼭 드래그해야
 * 하는 것 같은데 이건 아닌 것 같아").
 *
 * 클릭을 전부 반반에 몰아준 탓에 한쪽만 보려면 드래그밖에 없었다. 이제 손잡이가
 * 세 상태를 다 돈다 — 순서는 **구분선이 한 칸씩 움직이는 방향**이다:
 *
 *     면접만 ──▶ 반반 ──▶ 자소서만 ──▶ 반반 ──▶ 면접만
 *
 * 반반에서 어느 쪽으로 갈지는 **직전에 보던 한쪽의 반대**다. 이게 없으면
 * 「반반 → 면접만 → 자소서만」 로 돌면서 **면접만에서 반반을 건너뛴다.**
 */
describe('손잡이 3단 순환', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    document.body.className = ''
  })

  const state = () => {
    if (screen.queryByRole('button', { name: '자소서 펼치기' })) return 'iv'
    if (screen.queryByRole('button', { name: '면접 펼치기' })) return 'cl'
    return 'both'
  }

  it('🔴 면접만 → 반반 → 자소서만 → 반반 → 면접만', () => {
    draw()
    expect(state()).toBe('iv')
    fireEvent.click(handle())
    expect(state()).toBe('both')
    fireEvent.click(handle())
    expect(state()).toBe('cl') // 클릭만으로 한쪽만 보기에 닿는다
    fireEvent.click(handle())
    expect(state()).toBe('both')
    fireEvent.click(handle())
    expect(state()).toBe('iv') // 되돌아온다
  })

  /** 🔴 반반에서 어느 쪽으로 갈지는 직전에 보던 쪽이 정한다 */
  it('🔴 자소서만에서 들어온 반반은 다음이 면접만이다', async () => {
    draw()
    fireEvent.click(handle()) // 반반
    await dragToRatio(0.1) // 끝까지 밀어 자소서만
    expect(state()).toBe('cl')
    await new Promise((r) => setTimeout(r, 0)) // 끈 직후 클릭 억제가 풀리길 기다린다
    fireEvent.click(handle())
    expect(state()).toBe('both')
    fireEvent.click(handle())
    expect(state()).toBe('iv') // 자소서만에서 왔으니 반대편으로
  })

  it('다음에 무엇이 되는지를 이름이 말한다', () => {
    draw()
    expect(handle().getAttribute('aria-label')).toContain('반반')
    fireEvent.click(handle())
    expect(handle().getAttribute('aria-label')).toContain('자소서만')
  })

  /** 세로 탭은 순환이 아니라 **그쪽만 펼치기** — 반반은 손잡이가 맡는다 */
  it('세로 탭은 순환에 끼어들지 않는다', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: '자소서 펼치기' }))
    expect(state()).toBe('cl')
    // 자소서만에서 손잡이를 누르면 반반 — 순환은 그대로 이어진다
    fireEvent.click(handle())
    expect(state()).toBe('both')
    fireEvent.click(handle())
    expect(state()).toBe('iv') // 자소서만에서 왔으니 반대편으로
  })
})

/**
 * 🔴 **되돌아가도 아무도 안 울던 것들** (2026-08-10 뮤테이션 감사).
 *
 * 바뀐 동작을 하나씩 실제로 깨뜨려 보니, 방금 고친 것들이 되돌아가도 전체 1,892건이
 * **전부 통과**했다. 컴포넌트 안쪽엔 spec 을 촘촘히 달았는데 **그 사이를 잇는 동작**
 * (비율 리셋 · 스크롤 이관 · 조회 조건)엔 하나도 없었다.
 */
describe('되돌아감 방어', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    cls.loading = false
    cls.error = false
    cls.enabledCalls = []
    document.body.className = ''
  })

  const cols = () => (divider().parentElement as HTMLElement).style.gridTemplateColumns

  /**
   * 🔴 「반반」이라고 쓰여 있으면 반반이어야 한다. 리셋이 빠지면 0.7 로 끌어놓고
   * 순환을 돌았을 때 **0.7 인 채로 「반반」이라고 부른다.**
   */
  it('🔴 순환으로 돌아온 반반은 다시 50:50 이다', async () => {
    draw()
    fireEvent.click(handle()) // 반반
    await dragToRatio(0.7)
    expect(cols()).toContain('0.7')

    await new Promise((r) => setTimeout(r, 0)) // 끈 직후 클릭 억제가 풀리길
    fireEvent.click(handle()) // 자소서만
    fireEvent.click(handle()) // 다시 반반 — 여기서 50:50 이어야 한다
    expect(cols()).toContain('0.5fr')
  })

  /**
   * 🔴 자소서 조회는 **나란히 열 때만** 켠다. 조건이 빠지면 자소서를 볼 일 없는
   * 「면접만」 화면에서도 매번 조회한다.
   */
  it('🔴 면접만 볼 땐 자소서를 조회하지 않는다', () => {
    draw()
    expect(cls.enabledCalls.at(-1)).toBe(false)
    fireEvent.click(handle()) // 반반
    expect(cls.enabledCalls.at(-1)).toBe(true)
  })

  it('🔴 좁은 화면에선 조회하지 않는다 (나란히가 불가능하다)', () => {
    box.width = 600
    draw()
    expect(cls.enabledCalls.at(-1)).toBe(false)
  })
})

/**
 * 🔴 **분할을 드나들 때 스크롤 위치** (2026-08-10).
 *
 * 분할이 되면 페이지 스크롤을 잠근다. 잠그기만 하고 위치를 안 되돌리면 내용이 화면 위로
 * 밀려나 **빈 배경만 남고 빠져나갈 수도 없었다** (CEO 실기 지적). 나갈 때 되돌리지 않으면
 * 이번엔 맨 위로 튄다. 그리고 **언마운트 중에 스크롤을 건드리면** 이미 그려지고 있는
 * 다음 화면이 튄다 — 원인 화면은 사라진 뒤라 나중에 못 찾는다.
 */
describe('분할 드나들 때 스크롤', () => {
  let scrolls: Array<[number, number]>
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    document.body.className = ''
    scrolls = []
    window.scrollTo = ((x: number, y: number) => {
      scrolls.push([x, y])
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
    }) as typeof window.scrollTo
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })

  it('🔴 분할로 들어가면 스크롤을 0 으로 되돌린다', () => {
    draw()
    Object.defineProperty(window, 'scrollY', { value: 1200, configurable: true })
    fireEvent.click(handle())
    expect(scrolls).toContainEqual([0, 0])
  })

  it('🔴 분할에서 나오면 페이지 스크롤로 돌려준다', async () => {
    draw()
    fireEvent.click(handle()) // 반반
    scrolls.length = 0
    await dragToRatio(0.9) // 끝까지 밀어 면접만
    expect(scrolls.length).toBeGreaterThan(0)
  })

  /** 🔴 이미 다음 화면이 그려지고 있다 — 여기서 스크롤을 건드리면 그 화면이 튄다 */
  it('🔴 분할인 채로 화면을 떠날 땐 스크롤을 건드리지 않는다', () => {
    const { unmount } = draw()
    fireEvent.click(handle())
    scrolls.length = 0
    unmount()
    expect(scrolls).toEqual([])
  })
})

/**
 * 🔴 **터치 화면에서도 끌 수 있어야 한다** (2026-08-10 점검).
 *
 * 브라우저는 터치 제스처를 기본적으로 **스크롤로 가져간다**. `touch-action: none` 이 없으면
 * 손잡이를 잡고 그어도 몇 px 만에 `pointercancel` 이 날아와 끊긴다 — 마우스로만 보면
 * 멀쩡해서 안 드러난다. 분할이 뜨는 폭(1024+)에 터치 노트북·아이패드 가로가 들어온다.
 *
 * jsdom 도 헤드리스 브라우저도 **진짜 터치 제스처를 만들지 못한다** — 실기기에서만 확인된다.
 * 여기서는 선언이 붙어 있는지만 잠근다.
 */
describe('터치 드래그', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    document.body.className = ''
  })

  it('🔴 구분선이 터치 제스처를 브라우저에 넘기지 않는다', () => {
    draw()
    expect(divider().className).toContain('touch-none')
  })
})

/**
 * 🔴 **키보드로도 비율을 조정할 수 있어야 한다** (2026-08-10 점검).
 *
 * `aria-label` 이 「끌면 비율 조정」이라고 **말해 놓고 실행 수단이 없었다.** 마우스가 없으면
 * 반반과 한쪽만 보기 사이만 오갈 수 있었다 — 화면 낭독기 사용자에겐 거짓말이다.
 */
describe('키보드로 비율 조정', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    document.body.className = ''
  })

  const cols = () => (divider().parentElement as HTMLElement).style.gridTemplateColumns

  it('🔴 화살표 키로 비율이 움직인다', () => {
    draw()
    fireEvent.click(handle()) // 반반
    expect(cols()).toContain('0.5fr')
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(cols()).toContain('0.55')
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
    expect(cols()).toContain('0.45')
  })

  /** 한쪽만 보는 중이면 먼저 반반으로 — 조정할 비율이 있어야 조정한다 */
  it('한쪽만 볼 때 화살표를 누르면 반반이 된다', () => {
    draw()
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(cols()).toContain('0.5fr')
  })

  /** 🔴 드래그를 끝까지 미는 것과 같은 규칙 — 배울 게 하나뿐이어야 한다 */
  it('🔴 계속 밀면 그쪽이 접힌다', () => {
    draw()
    fireEvent.click(handle()) // 반반
    // 0.5 에서 5%씩 → 7번째에 0.85 로 한계를 넘긴다 (8번을 누르면 다시 반반이 열린다)
    for (let i = 0; i < 7; i++) fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: '자소서 펼치기' })).toBeTruthy()
  })

  /**
   * 🔴 `aria-valuenow` 류는 **`role="button"` 에서 무시된다** (2026-08-10 `/uiux`).
   * `role="separator"` 로 바꾸면 값은 읽히지만 **주 동작인 클릭이 안 읽힌다** —
   * 여기선 누르는 게 먼저라, 무효 속성 대신 **이름에 값을 담는다.**
   */
  it('🔴 현재 비율을 이름으로 알린다 (무효 ARIA 대신)', () => {
    draw()
    expect(handle().getAttribute('aria-valuenow')).toBeNull()
    fireEvent.click(handle()) // 반반
    expect(handle().getAttribute('aria-label')).toContain('현재 50%')
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(handle().getAttribute('aria-label')).toContain('현재 55%')
  })

  it('한쪽만 볼 땐 비율을 말하지 않는다 (조정할 게 없다)', () => {
    draw()
    expect(handle().getAttribute('aria-label')).not.toContain('현재')
  })
})

/**
 * 🔴 **손가락·마우스가 겹쳐 들어와도 망가지지 않는다** (2026-08-10 점검).
 *
 * 드래그 중에 두 번째 `pointerdown` 이 들어오면 창 리스너가 한 벌 더 붙는다. 첫 벌이
 * 남아 있으면 `pointerup` 이후에도 계속 듣고 있게 되고, 그러면 **손을 뗀 뒤에도 열이 따라온다.**
 */
describe('겹쳐 들어오는 포인터', () => {
  beforeEach(() => {
    sess.loading = false
    box.width = 1200
    localStorage.clear()
    cls.list = cls.base
    document.body.className = ''
    document.body.style.userSelect = ''
  })

  const cols = () => (divider().parentElement as HTMLElement).style.gridTemplateColumns

  it('🔴 손을 뗀 뒤에는 움직여도 따라오지 않는다', async () => {
    draw()
    fireEvent.click(handle()) // 반반
    // 두 번 눌렀다가 한 번 뗀다
    fireEvent.pointerDown(divider(), { clientX: xForRatio(0.5), pointerId: 1 })
    fireEvent.pointerDown(divider(), { clientX: xForRatio(0.5), pointerId: 2 })
    fireEvent(window, new MouseEvent('pointermove', { clientX: xForRatio(0.65), bubbles: true }) as unknown as Event)
    await act(async () => {
      await new Promise((res) => requestAnimationFrame(() => res(null)))
    })
    fireEvent(window, new MouseEvent('pointerup', { bubbles: true }) as unknown as Event)
    const settled = cols()

    // 뗀 뒤의 움직임은 무시돼야 한다
    fireEvent(window, new MouseEvent('pointermove', { clientX: xForRatio(0.3), bubbles: true }) as unknown as Event)
    await act(async () => {
      await new Promise((res) => requestAnimationFrame(() => res(null)))
    })
    expect(cols()).toBe(settled)
  })

  /**
   * 🔴 **동작이 아니라 누수다.** 리스너를 안 떼도 `d.down` 가드가 움직임은 막으므로
   * 화면상으로는 멀쩡하다 — 대신 **누를 때마다 창 리스너가 한 벌씩 쌓인다.**
   * 한 세션에서 수십 번 끄는 화면이라 조용히 늘어난다. 붙인 만큼 떼는지를 직접 센다.
   */
  it('🔴 창 리스너가 붙은 만큼 떨어진다 (누수 없음)', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    draw()
    fireEvent.click(handle())
    const count = (spy: typeof add) =>
      spy.mock.calls.filter(([t]) => t === 'pointermove').length

    for (let i = 0; i < 3; i++) {
      fireEvent.pointerDown(divider(), { clientX: xForRatio(0.5), pointerId: i })
      fireEvent(window, new MouseEvent('pointermove', { clientX: xForRatio(0.6), bubbles: true }) as unknown as Event)
      await act(async () => {
        await new Promise((res) => requestAnimationFrame(() => res(null)))
      })
      fireEvent(window, new MouseEvent('pointerup', { bubbles: true }) as unknown as Event)
    }
    expect(count(remove)).toBe(count(add))
    add.mockRestore()
    remove.mockRestore()
  })

  it('선택 금지도 남지 않는다', async () => {
    draw()
    fireEvent.click(handle())
    fireEvent.pointerDown(divider(), { clientX: xForRatio(0.5), pointerId: 1 })
    fireEvent.pointerDown(divider(), { clientX: xForRatio(0.5), pointerId: 2 })
    fireEvent(window, new MouseEvent('pointermove', { clientX: xForRatio(0.65), bubbles: true }) as unknown as Event)
    fireEvent(window, new MouseEvent('pointerup', { bubbles: true }) as unknown as Event)
    expect(document.body.style.userSelect).toBe('')
  })
})

/* 레이아웃 스텁은 이 파일 밖으로 새면 안 된다 */
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect
})
