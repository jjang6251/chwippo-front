/**
 * 읽기 모드 회귀 (2026-08-07).
 *
 * 🔴 **면접 직전에 꺼내 보는 화면**이다. 준비하는 화면과 성격이 다르다 — 대기실에서
 * 스크롤하다 `AI 도움`·`꼬리질문 추가`·`다시 생성` 을 잘못 누르면 **코인이 나간다.**
 * 그래서 "안 보인다" 를 계약으로 박는다.
 *
 * 🔴 **꼬리질문까지 전파돼야 한다.** 자식 카드에 안 내려가면 메인만 조용하고
 * 꼬리질문에는 코인 버튼이 그대로 남는다 — 가장 놓치기 쉬운 자리다.
 */
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewQuestionCard } from './InterviewQuestionCard'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), error: vi.fn() },
}))
vi.mock('@/hooks/useMyAiQuotas', () => ({
  useAiQuotaBlocked: vi.fn(() => ({ blocked: false, reason: null })),
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({
  useRequireAiConsent: () => vi.fn().mockResolvedValue(true),
}))
vi.mock('@/hooks/useRequireJobTitle', () => ({
  useRequireJobTitle: () => vi.fn().mockResolvedValue(true),
}))

const blockedMock = vi.mocked(useAiQuotaBlocked)

const makeQuestion = (
  overrides: Partial<InterviewPrepQuestion> = {},
): InterviewPrepQuestion =>
  ({
    id: 'q-1',
    sessionId: 'sess-1',
    parentQuestionId: null,
    depth: 0,
    orderIndex: 0,
    category: 'self_intro',
    questionText: '자기소개를 해주세요.',
    suggestedAnswer: null,
    materialGap: null,
    sourceLogIds: [],
    myMemo: null,
    mustPrepare: false,
    followupBasis: null,
    children: [],
    ...overrides,
  }) as unknown as InterviewPrepQuestion

function renderCard(
  question: InterviewPrepQuestion,
  readOnly: boolean,
  opts: { forceAnswerOpen?: boolean } = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <InterviewQuestionCard
        applicationId="app-1"
        question={question}
        sessionId="sess-1"
        readOnly={readOnly}
        forceAnswerOpen={opts.forceAnswerOpen}
      />
    </QueryClientProvider>,
  )
}

describe('InterviewQuestionCard — 읽기 모드', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    blockedMock.mockReturnValue({ blocked: false, reason: null })
  })

  it('🔴 코인 쓰는 버튼이 전부 사라진다 (대기실 오탭 방지)', () => {
    renderCard(makeQuestion(), true)
    expect(screen.queryByText('AI 도움')).toBeNull()
    expect(screen.queryByText(/꼬리질문 추가/)).toBeNull()
  })

  it('편집 모드에선 그대로 보인다 (읽기 모드만의 동작임을 고정)', () => {
    renderCard(makeQuestion(), false)
    expect(screen.queryByText('AI 도움')).not.toBeNull()
  })

  it('🔴 답변이 있어도 "다시 생성" 은 감춘다 (재생성도 코인이다)', () => {
    renderCard(
      makeQuestion({ suggestedAnswer: '저는 백엔드 개발자입니다.' }),
      true,
    )
    expect(screen.queryByText('↻ 다시 생성')).toBeNull()
    // 답변 자체는 볼 수 있어야 한다
    expect(screen.queryByText('AI 예상 답변')).not.toBeNull()
  })

  it('🔴 메모가 입력칸이 아니라 글로 나온다 (키보드가 화면을 안 먹게)', () => {
    const { container } = renderCard(
      makeQuestion({ myMemo: '물류 정산 배치를 개선했습니다.' }),
      true,
    )
    expect(container.querySelector('textarea')).toBeNull()
    expect(screen.queryByText('물류 정산 배치를 개선했습니다.')).not.toBeNull()
  })

  it('🔴 메모가 비면 조용히 넘기지 않고 말해 준다 (준비가 덜 된 지점)', () => {
    renderCard(makeQuestion({ myMemo: null }), true)
    expect(screen.queryByText(/아직 안 썼어요/)).not.toBeNull()
  })

  it('편집 모드에선 입력칸이다', () => {
    const { container } = renderCard(makeQuestion({ myMemo: '메모' }), false)
    expect(container.querySelector('textarea')).not.toBeNull()
  })

  /**
   * 🔴 여기가 가장 놓치기 쉽다 — 자식 카드는 부모가 재귀 렌더하므로
   * prop 을 안 내려주면 **꼬리질문에만 코인 버튼이 남는다.**
   */
  it('🔴 꼬리질문에도 전파된다 (자식만 편집 표면이 남으면 안 된다)', () => {
    renderCard(
      makeQuestion({
        children: [
          makeQuestion({
            id: 'q-2',
            depth: 1,
            parentQuestionId: 'q-1',
            questionText: '그때 왜 그렇게 판단하셨나요?',
            followupBasis: 'my_memo',
          }),
        ],
      }),
      true,
    )
    expect(screen.queryByText('그때 왜 그렇게 판단하셨나요?')).not.toBeNull()
    // 부모·자식 통틀어 코인 버튼이 하나도 없어야 한다
    expect(screen.queryAllByText('AI 도움')).toHaveLength(0)
    expect(screen.queryAllByText(/꼬리질문 추가/)).toHaveLength(0)
  })

  it('🔴 꼬리질문이 기본으로 펼쳐진다 (하나씩 눌러 열지 않게)', () => {
    renderCard(
      makeQuestion({
        children: [
          makeQuestion({
            id: 'q-2',
            depth: 1,
            parentQuestionId: 'q-1',
            questionText: '꼬리 질문 본문',
            myMemo: '꼬리 답변 메모',
          }),
        ],
      }),
      true,
    )
    // 접혀 있으면 자식의 메모 본문이 DOM 에 없다
    expect(screen.queryByText('꼬리 답변 메모')).not.toBeNull()
  })

  it('편집 모드에선 꼬리질문이 접혀 있다 (메인부터 보게 유도 — 기존 동작)', () => {
    renderCard(
      makeQuestion({
        children: [
          makeQuestion({
            id: 'q-2',
            depth: 1,
            parentQuestionId: 'q-1',
            questionText: '꼬리 질문 본문',
            myMemo: '꼬리 답변 메모',
          }),
        ],
      }),
      false,
    )
    expect(screen.queryByText('꼬리 답변 메모')).toBeNull()
  })
})

/**
 * 🔴 **읽기 모드 타이포 위계** (2026-08-07 CEO 실기 지적).
 *
 * 예전엔 질문 15px / AI 답변 13px / 내 메모 13px — **질문 대 본문이 1.15배**였고
 * AI 답변과 내 메모는 **1.0배(동일)** 였다. 라벨을 안 읽으면 뭐가 뭔지 구분이 안 됐다.
 *
 * 🔴 **1.2배 미만은 사용자가 레벨을 구분하지 못한다** (모듈러 스케일 통설). 처음 고칠 때
 * 17/15 로 2px 씩 올렸는데 **비율로는 1.13배라 더 나빠졌다** — 크기는 절대값이 아니라
 * 비율로 인지된다. 본문을 웹 표준 16px 에 두고 위아래로 **1.25배**씩 잡는다.
 *
 * 읽기 모드는 목록이 아니라 문서다 — 질문이 소제목, 내 답변이 본문, AI 답변이 참고.
 * 크기와 색이 **함께** 벌어져야 한다 (하나만으로는 여전히 애매하다).
 */
describe('InterviewQuestionCard — 읽기 모드 타이포 위계', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    blockedMock.mockReturnValue({ blocked: false, reason: null })
  })

  const withAll = () =>
    makeQuestion({
      questionText: '자기소개를 해주세요.',
      suggestedAnswer: 'AI 가 쓴 예상 답변입니다.',
      myMemo: '제가 직접 쓴 답변입니다.',
    })

  /** 메모가 있으면 AI 답변은 접힌다(주인공이 내 메모라서) — 그래서 둘을 나눠 본다 */
  const noMemo = () =>
    makeQuestion({
      questionText: '자기소개를 해주세요.',
      suggestedAnswer: 'AI 가 쓴 예상 답변입니다.',
      myMemo: null,
    })

  it('🔴 질문 > 내 답변 순으로 크기가 벌어진다 (2px 차이였다)', () => {
    renderCard(withAll(), true)
    expect(screen.getByText('자기소개를 해주세요.').className).toContain(
      'text-[20px]',
    )
    expect(screen.getByText('제가 직접 쓴 답변입니다.').className).toContain(
      'text-[16px]',
    )
  })

  it('🔴 비율이 임계(1.2배)를 넘는다 — 절대값이 아니라 비율로 인지된다', () => {
    renderCard(withAll(), true)
    const px = (el: HTMLElement) =>
      Number(/text-\[(\d+)px\]/.exec(el.className)?.[1])
    const q = px(screen.getByText('자기소개를 해주세요.'))
    const mine = px(screen.getByText('제가 직접 쓴 답변입니다.'))
    expect(q / mine).toBeGreaterThanOrEqual(1.2)
  })

  it('🔴 AI 답변은 13px 로 물러난다 (내 메모와 같은 크기였다)', () => {
    renderCard(noMemo(), true)
    const ai = screen.getByText('AI 가 쓴 예상 답변입니다.')
    expect(ai.className).toContain('text-[13px]')
    expect(ai.className).toContain('text-text-tertiary')
  })

  it('🔴 색도 함께 벌어진다 — 크기만으로는 위계가 약하다', () => {
    renderCard(withAll(), true)
    expect(screen.getByText('자기소개를 해주세요.').className).toContain(
      'text-text-primary',
    )
    expect(screen.getByText('제가 직접 쓴 답변입니다.').className).toContain(
      'text-text-primary',
    )
  })

  it('🔴 질문이 굵어진다 (소제목 역할)', () => {
    renderCard(withAll(), true)
    expect(screen.getByText('자기소개를 해주세요.').className).toContain(
      'font-semibold',
    )
  })

  /**
   * 🔴 편집 모드도 **같은 임계를 지킨다** — 다만 값이 다르다. 20문항을 훑는 목록이라
   * 읽기 모드(20px)만큼 키우면 한 화면에 들어오는 문항이 준다. 본문 13px 대비
   * 1.23배인 `text-base`(16px) 로 임계만 넘긴다.
   */
  it('편집 모드는 목록에 맞춘 스케일이되 임계는 넘는다', () => {
    renderCard(withAll(), false)
    const q = screen.getByText('자기소개를 해주세요.')
    expect(q.className).toContain('text-base') // 16px — 본문 13px 대비 1.23배
    expect(q.className).toContain('font-semibold')
    expect(q.className).toContain('leading-normal') // 한글 150%
    expect(q.className).not.toContain('text-[20px]')
    // 편집 모드는 AI 답변이 기본 펼침이라 여기서 바로 보인다
    expect(screen.getByText('AI 가 쓴 예상 답변입니다.').className).toContain(
      'text-text-secondary',
    )
  })

  it('읽기 모드 라벨은 조용해진다 (본문이 주인공)', () => {
    renderCard(withAll(), true)
    const label = screen.getByText('내 답변')
    expect(label.className).toContain('text-[11px]')
    expect(screen.queryByText('내 답변 (자동 저장)')).toBeNull()
  })
})

/**
 * 🔴 **`forceAnswerOpen` — 읽기 모드의 접힘 규칙을 예외적으로 연다** (2026-08-09).
 *
 * 읽기 모드는 **내 답변이 있으면 AI 답변을 접는다** — 면접 직전에 외울 건 내가 쓴 답이라는
 * 제품 판단이다. 그런데 **랜딩은 AI 가 무엇을 써주는지 보여줘야** 한다.
 * 제품 규칙을 바꾸지 않고 예외만 명시적으로 여는 게 이 prop 의 존재 이유라,
 * **기본값에서 기존 동작이 그대로인지**가 절반이다.
 */
describe('InterviewQuestionCard — forceAnswerOpen', () => {
  beforeEach(() => blockedMock.mockReturnValue({ blocked: false, reason: null }))

  const withBoth = () =>
    makeQuestion({
      suggestedAnswer: '측정으로 병목을 좁히는 백엔드 개발자입니다.',
      myMemo: '내 말로 줄인 답변',
    })

  /**
   * 접혀도 **한 줄 미리보기**는 남는다 — AI 답변이 있다는 사실 자체는 보여야 하기 때문이다.
   * 그래서 "텍스트가 없다" 가 아니라 **`aria-expanded`** 로 판정한다.
   */
  const answerToggle = () =>
    screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('AI 예상 답변'))

  it('🔴 읽기 모드 + 내 답변 있음 → AI 답변은 접힌 채 시작한다 (기본 동작 유지)', () => {
    renderCard(withBoth(), true)
    expect(answerToggle()?.getAttribute('aria-expanded')).toBe('false')
  })

  it('🔴 forceAnswerOpen → 내 답변이 있어도 AI 답변이 펼쳐진다', () => {
    renderCard(withBoth(), true, { forceAnswerOpen: true })
    expect(answerToggle()?.getAttribute('aria-expanded')).toBe('true')
  })

  it('내 답변이 없으면 원래도 펼쳐진다 (규칙 자체는 그대로)', () => {
    renderCard(makeQuestion({ suggestedAnswer: '측정으로 병목을 좁히는 백엔드 개발자입니다.' }), true)
    expect(screen.getByText(/측정으로 병목을 좁히는/)).toBeTruthy()
  })
})

/**
 * 🔴 **읽기 모드에서는 쿼터를 조회하지 않는다** (2026-08-09).
 *
 * 읽기 모드엔 코인 쓰는 버튼이 없어 쿼터 값이 **쓰이지 않는데도** 요청이 나갔다
 * (`refetchOnMount: 'always'`). 랜딩에서는 비로그인 401 → refresh 재시도까지 연쇄돼
 * 요청 30건이 됐고, 제품에서도 면접 직전 화면에서 낭비였다.
 */
describe('InterviewQuestionCard — 읽기 모드 쿼터 조회 차단', () => {
  beforeEach(() => {
    blockedMock.mockClear()
    blockedMock.mockReturnValue({ blocked: false, reason: null })
  })

  it('🔴 readOnly → enabled: false 로 부른다', () => {
    renderCard(makeQuestion(), true)
    for (const call of blockedMock.mock.calls) {
      expect(call[1], `${call[0]} 에 enabled 옵션 없음`).toEqual({ enabled: false })
    }
    expect(blockedMock.mock.calls.length).toBeGreaterThan(0)
  })

  it('편집 모드 → 조회한다', () => {
    renderCard(makeQuestion(), false)
    for (const call of blockedMock.mock.calls) {
      expect(call[1]).toEqual({ enabled: true })
    }
  })
})
