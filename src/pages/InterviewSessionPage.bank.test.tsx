/**
 * 질문 은행 D2 — **빈 상태의 주인공이 바뀌었다.**
 *
 * 🔴 예전 빈 상태의 유일한 버튼은 AI 생성이었다. 세션을 막 만든 사람에게 남은 선택지가
 * 「코인을 쓰거나 나가거나」뿐이라, **자소서가 없거나 코인이 없으면 그대로 막다른 길**이었다.
 * 실사용자 피드백은 "내가 받은 기출을 모아두고 싶다" 였고 그건 지금 당장 할 수 있는 일이다.
 *
 * 이 spec 이 잠그는 것:
 *   ① 빈 상태에서 [＋ 질문 추가] 가 **주 버튼**이고 AI 생성은 옆에 선다 (뒤집히면 회귀)
 *   ② 읽기 모드에는 추가 버튼이 없다 — 면접 직전에 훑는 화면이라 편집 표면을 두지 않는다
 *   ③ 툴바 버튼을 누르면 **인라인 폼**이 그 자리에 열린다 (모달이 아니다 — 나란히 보기 때문)
 *   ④ 추가 직후 **어디로 갔는지**를 알린다 — 목록이 면접 진행 순서라 새 질문은 맨 끝이
 *     아니라 카테고리의 자리로 들어간다 (미분류=중간). 안 알리면 "방금 넣은 게 어디 갔지"
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewSessionPage } from './InterviewSessionPage'
import { toast } from '@/stores/toastStore'

const sessionQuery = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
}))
const questionsQuery = vi.hoisted(() => ({
  data: [] as unknown[],
  isLoading: false,
  isError: false,
}))
/** 폼이 실제로 부르는 mutate — 테스트가 "서버가 이렇게 돌려줬다" 를 직접 연기한다 */
const bulk = vi.hoisted(() => ({ mutate: vi.fn() }))

vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSession: () => sessionQuery,
  useInterviewPrepQuestions: () => questionsQuery,
  useInterviewPrepRefs: () => ({ data: undefined }),
  useGenerateInterviewSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteInterviewSession: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateInterviewPrepSession: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkCreateQuestions: () => ({ mutate: bulk.mutate, isPending: false }),
  useRefetchQuestionsOnGenerationEnd: vi.fn(),
  questionsKey: (id: string) => ['interview-prep-questions', id],
  sessionKey: (id: string) => ['interview-prep-session', id],
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: { companyName: '카카오' } }),
  useUpdateApplication: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useApplicationCoverletters', () => ({
  useCoverletters: () => ({ data: [], isLoading: false, isError: false }),
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
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }))

/* 사이드바·카드 자식들은 각자 훅을 끌고 온다 — 이 spec 이 보는 건 추가 동선이다 */
vi.mock('@/components/common/JobTitleField', () => ({ JobTitleField: () => null }))
vi.mock('@/components/card/CompanyResearchCard', () => ({
  CompanyResearchCard: () => null,
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: () => null,
}))
vi.mock('@/components/coverletter/CoverletterQuestionCard', () => ({
  CoverletterQuestionCard: () => null,
}))
vi.mock('@/components/card/EditInterviewSessionModal', () => ({
  EditInterviewSessionModal: () => null,
}))
/**
 * 카드 본체는 이 spec 의 관심사가 아니지만 **몇 개가 남았는지**는 관심사다
 * (필터 칩이 실제로 거르는지를 다른 방법으로 볼 수가 없다) — 표식만 남긴다.
 */
vi.mock('@/components/card/InterviewQuestionCard', () => ({
  InterviewQuestionCard: ({ question }: { question: { id: string } }) => (
    <div data-testid={`card-${question.id}`} />
  ),
}))
vi.mock('@/components/common/AiQuotaChip', () => ({ AiQuotaChip: () => null }))

const session = {
  id: 's-1',
  applicationId: 'app-1',
  round: '1차 실무 면접',
  interviewType: null,
  coverletterIds: [],
  extraLogIds: [],
  myMemo: null,
  jobDescription: null,
  emphasisPoints: null,
  userResearchNotes: null,
  generationStatus: 'idle',
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
}

const question = {
  id: 'q-1',
  sessionId: 's-1',
  parentQuestionId: null,
  depth: 0,
  orderIndex: 0,
  category: 'self_intro',
  mustPrepare: false,
  followupBasis: null,
  questionText: '자기소개를 해주세요.',
  suggestedAnswer: null,
  materialGap: null,
  sourceLogIds: [],
  myMemo: null,
  source: 'ai',
  lastPracticedAt: null,
  lastPracticeResult: null,
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
  children: [],
}

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

const addButton = () => screen.getByRole('button', { name: /＋ 질문 추가/ })
/** 폼이 열렸는가 — 세그먼트 두 개가 폼의 정체다 */
const formOpen = () =>
  screen.queryByRole('button', { name: /직접 적기/ }) !== null

describe('빈 상태 — 직접 추가가 주 동선이다', () => {
  beforeEach(() => {
    Object.assign(sessionQuery, { data: session, isLoading: false, isError: false })
    Object.assign(questionsQuery, { data: [], isLoading: false, isError: false })
  })

  it('🔴 [＋ 질문 추가] 가 주 버튼(bg-brand)이고 AI 생성은 보조로 남는다', () => {
    draw()
    expect(screen.getByText('아직 질문이 없어요')).toBeTruthy()

    const add = addButton()
    const ai = screen.getByRole('button', { name: /AI 질문 생성/ })
    expect(add.className).toContain('bg-brand')
    expect(ai.className).not.toContain('bg-brand')
  })

  it('빈 상태에서 눌러도 추가 폼이 열린다 (막다른 길이 없다)', () => {
    draw()
    expect(formOpen()).toBe(false)
    fireEvent.click(addButton())
    expect(formOpen()).toBe(true)
  })
})

describe('목록 툴바 — 추가 버튼', () => {
  beforeEach(() => {
    Object.assign(sessionQuery, { data: session, isLoading: false, isError: false })
    Object.assign(questionsQuery, {
      data: [question],
      isLoading: false,
      isError: false,
    })
  })

  it('🔴 툴바 버튼을 누르면 인라인 폼이 열린다 (모달이 아니다)', () => {
    draw()
    expect(formOpen()).toBe(false)
    fireEvent.click(addButton())
    expect(formOpen()).toBe(true)
  })

  it('다시 누르면 닫힌다 (열고 닫는 길이 같은 버튼에 있다)', () => {
    draw()
    fireEvent.click(addButton())
    fireEvent.click(addButton())
    expect(formOpen()).toBe(false)
  })

  it('🔴 읽기 모드에는 [＋ 질문 추가] 가 없다', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: '📖 읽기 모드' }))
    expect(screen.queryByRole('button', { name: /＋ 질문 추가/ })).toBeNull()
  })

  /** 열어 둔 채 읽기 모드로 넘어가도 편집 표면이 남으면 안 된다 */
  it('🔴 폼을 연 채 읽기 모드로 가면 폼도 사라진다', () => {
    draw()
    fireEvent.click(addButton())
    expect(formOpen()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '📖 읽기 모드' }))
    expect(formOpen()).toBe(false)
  })
})

/**
 * 🔴 **추가한 질문은 맨 끝에 붙지 않는다.**
 *
 * 목록은 `orderIndex` 가 아니라 **면접 진행 순서**(`CATEGORY_FLOW_ORDER`)로 정렬된다 —
 * 미분류는 40(중간)이라 self_intro(10)와 closing_remark(99) 사이로 들어간다.
 * 화면 아래쪽엔 아무 변화가 없어서, 안내가 없으면 "방금 넣은 게 어디 갔지" 가 된다.
 *
 * 픽스처가 일부러 **뒤집혀 있다** — 새 질문의 `orderIndex` 가 제일 크므로, 정렬이
 * `orderIndex` 로 회귀하면 번호가 3번이 되어 이 spec 이 깨진다.
 */
describe('추가 직후 — 어디로 들어갔는지 알려준다', () => {
  const closing = {
    ...question,
    id: 'q-closing',
    category: 'closing_remark',
    orderIndex: 1,
    questionText: '마지막으로 하고 싶은 말이 있나요?',
  }
  const fresh = {
    ...question,
    id: 'q-new',
    category: null,
    orderIndex: 2,
    source: 'user',
    questionText: '가장 어려웠던 기술적 결정은 무엇이었나요?',
  }
  const fresh2 = {
    ...fresh,
    id: 'q-new-2',
    orderIndex: 3,
    questionText: '협업에서 갈등을 푼 경험은?',
  }

  /** 이 spec 이 지켜보는 스크롤 — jsdom 에 없어서 채워 넣고, 표적이 누구였는지까지 본다 */
  const scrolled: { id: string | null; arg?: boolean | ScrollIntoViewOptions }[] =
    []

  beforeEach(() => {
    vi.clearAllMocks()
    scrolled.length = 0
    Element.prototype.scrollIntoView = function (
      this: Element,
      arg?: boolean | ScrollIntoViewOptions,
    ) {
      scrolled.push({ id: this.getAttribute('data-question-id'), arg })
    }
    Object.assign(sessionQuery, { data: session, isLoading: false, isError: false })
    Object.assign(questionsQuery, {
      data: [question, closing],
      isLoading: false,
      isError: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  /** 서버가 created 를 돌려주고 **다음 렌더에 목록에도 나타난다** (refetch 를 연기한다) */
  type BulkOpts = { onSuccess: (created: unknown[]) => void }
  const respondWith = (list: unknown[]) =>
    bulk.mutate.mockImplementation((_dto: unknown, opts: BulkOpts) => {
      questionsQuery.data = [...questionsQuery.data, ...list]
      opts.onSuccess(list)
    })

  const addSingle = (text: string) => {
    fireEvent.click(addButton())
    fireEvent.change(screen.getByLabelText('질문 내용'), {
      target: { value: text },
    })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
  }

  it('🔴 단건 → 흐름 순서 기준 번호를 알려준다 (미분류는 중간이라 2번)', () => {
    respondWith([fresh])
    draw()
    addSingle(fresh.questionText)

    expect(toast.show).toHaveBeenCalledWith(
      '「가장 어려웠던 기술적…」 2번으로 들어갔어요',
    )
  })

  /** 연달아 적는 흐름이라 화면이 움직이면 입력칸을 뺏긴다 — 알리기만 한다 */
  it('🔴 단건은 스크롤하지 않는다 (입력 자리를 지킨다)', () => {
    respondWith([fresh])
    draw()
    addSingle(fresh.questionText)

    expect(scrolled.some((s) => s.id === 'q-new')).toBe(false)
  })

  it('🔴 새 질문 래퍼에 강조가 붙고 2.5초 뒤 사라진다', () => {
    vi.useFakeTimers()
    respondWith([fresh])
    draw()
    addSingle(fresh.questionText)

    const wrap = () => document.querySelector('[data-question-id="q-new"]')
    expect(wrap()?.className).toContain('ring-brand')

    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(wrap()?.className).not.toContain('ring-brand')
  })

  it('🔴 붙여넣기(복수) → 첫 질문으로 데려가고 개수를 알린다', () => {
    respondWith([fresh, fresh2])
    draw()
    fireEvent.click(addButton())
    fireEvent.click(screen.getByRole('button', { name: /여러 개 붙여넣기/ }))
    fireEvent.change(screen.getByLabelText('붙여넣을 질문 목록'), {
      target: { value: `${fresh.questionText}\n${fresh2.questionText}` },
    })
    fireEvent.click(screen.getByRole('button', { name: '2개 추가' }))

    expect(scrolled).toContainEqual({
      id: 'q-new',
      arg: { block: 'center', behavior: 'smooth' },
    })
    expect(toast.show).toHaveBeenCalledWith(
      '질문 2개를 추가했어요 (면접 흐름 순서로 배치돼요)',
    )
  })
})

/**
 * 「면접 보기」 진입 (D3).
 *
 * 🔴 **질문이 없으면 숨긴다** — 빈 시험은 설정 화면까지 갔다가 "조건에 맞는 질문이 없어요"
 * 로 끝나는 막다른 길이다. 반대로 **읽기 모드에서는 남는다**: 코인을 쓰지 않고, 이 버튼이
 * 가는 곳이 바로 "면접 직전에 훑어보는" 자리다.
 */
describe('면접 보기 — 세션 헤더 진입', () => {
  const micButton = () => screen.queryByRole('button', { name: /면접 보기/ })

  beforeEach(() => {
    Object.assign(sessionQuery, { data: session, isLoading: false, isError: false })
  })

  it('질문이 있으면 헤더에 [면접 보기] 가 뜨고, 읽기 모드에서도 남는다', () => {
    Object.assign(questionsQuery, {
      data: [question],
      isLoading: false,
      isError: false,
    })
    draw()
    expect(micButton()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '📖 읽기 모드' }))
    expect(micButton()).not.toBeNull()
  })

  it('🔴 질문이 0개면 숨는다 (빈 시험으로 데려가지 않는다)', () => {
    Object.assign(questionsQuery, { data: [], isLoading: false, isError: false })
    draw()
    expect(micButton()).toBeNull()
  })
})

/**
 * 🔁 **「다시 볼 것」 필터** (질문 은행 D3).
 *
 * 🔴 연습에서 「다시」로 찍은 결과가 **여기로 이어져야** 한다. 연습 화면은 답을 고쳐 쓸 수
 * 없으니, 찍고 나서 할 일은 결국 세션으로 돌아와 그 문항들만 다시 보는 것이다.
 *
 * 🔴 **0개면 칩 자체가 없다.** 연습 전 세션은 전부 `null` 이라, 안 그러면 모든 세션의
 * 필터 줄 맨 앞에 영원히 눌러도 아무 일 없는 칩이 하나 붙는다 (⭐ 와 같은 규칙).
 */
describe('🔁 다시 볼 것 필터', () => {
  const againChip = () => screen.queryByRole('button', { name: /다시 볼 것/ })
  const cards = () => screen.queryAllByTestId(/^card-/)

  const practiced = (
    id: string,
    lastPracticeResult: 'good' | 'soso' | 'again' | null,
    over: Record<string, unknown> = {},
  ) => ({ ...question, id, lastPracticeResult, ...over })

  beforeEach(() => {
    Object.assign(sessionQuery, { data: session, isLoading: false, isError: false })
  })

  it('🔴 「다시」가 0개면 칩이 아예 없다 (연습 전 세션의 소음 방지)', () => {
    Object.assign(questionsQuery, {
      data: [practiced('q-a', null), practiced('q-b', 'good')],
      isLoading: false,
      isError: false,
    })
    draw()
    expect(againChip()).toBeNull()
  })

  it('개수를 세어 보여주고, 누르면 「다시」만 남는다', () => {
    Object.assign(questionsQuery, {
      data: [
        practiced('q-a', 'again'),
        practiced('q-b', 'good'),
        practiced('q-c', 'again', { orderIndex: 2 }),
        practiced('q-d', null),
      ],
      isLoading: false,
      isError: false,
    })
    draw()

    const chip = againChip()!
    expect(chip.textContent).toContain('다시 볼 것 (2)')
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(cards()).toHaveLength(4)

    fireEvent.click(chip)
    expect(againChip()).toHaveAttribute('aria-pressed', 'true')
    expect(cards().map((c) => c.getAttribute('data-testid'))).toEqual([
      'card-q-a',
      'card-q-c',
    ])
  })

  it('다시 누르면 풀린다 (⭐ 와 같은 토글 문법)', () => {
    Object.assign(questionsQuery, {
      data: [practiced('q-a', 'again'), practiced('q-b', 'soso')],
      isLoading: false,
      isError: false,
    })
    draw()
    fireEvent.click(againChip()!)
    expect(cards()).toHaveLength(1)
    fireEvent.click(againChip()!)
    expect(cards()).toHaveLength(2)
  })

  /** ⭐ 와 AND 로 겹친다 — 둘 다 켜면 "먼저 할 것 중 아직 안 되는 것" 이 남는다 */
  it('⭐ 우선과 AND 로 겹쳐 걸린다', () => {
    Object.assign(questionsQuery, {
      data: [
        practiced('q-a', 'again', { mustPrepare: true }),
        practiced('q-b', 'again'),
        practiced('q-c', 'good', { mustPrepare: true }),
      ],
      isLoading: false,
      isError: false,
    })
    draw()
    fireEvent.click(againChip()!)
    fireEvent.click(screen.getByRole('button', { name: /우선 \(/ }))
    expect(cards().map((c) => c.getAttribute('data-testid'))).toEqual(['card-q-a'])
  })
})
