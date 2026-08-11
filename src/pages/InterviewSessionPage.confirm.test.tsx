/**
 * 질문 은행 D2b — **세션 삭제 확인 문구.**
 *
 * 🔴 이 spec 은 원래 `↻ 다시 생성` 의 `window.confirm`(잔여 횟수 표기)을 지켰다. 그 확인창은
 * **사라졌다** — 생성이 기존 질문·답변을 지우지 않는 additive 동작이 되면서(ADR-074 뒤집기)
 * 막을 위험 자체가 없어졌기 때문이다. 확인창을 아껴 쓰지 않으면 사용자는 확인창을 안 읽는
 * 습관을 배우고, 정작 **진짜 지워지는 자리**에서도 안 읽는다.
 *
 * 그 "진짜 지워지는 자리" 중 하나가 세션 삭제다. 여기서 잠그는 것:
 *   ① 직접 적은 질문이 있으면 **몇 개인지** 말한다 — AI 질문은 다시 만들면 되지만
 *      내가 모은 기출은 어디에도 없다 (면접 다녀와 복기한 것들이다)
 *   ② 없으면 그 줄을 넣지 않는다 (0개라고 말하는 건 소음이다)
 *   ③ 꼬리 자리에 직접 적은 질문도 센다 (`bulkCreate` 가 `parentQuestionId` 를 받는다)
 *   ④ 취소하면 삭제 API 가 나가지 않는다
 *
 * 🔴 **문구 빌더를 테스트 안에 복사하지 않는다.** 예전 spec 은 같은 문자열 조립을 테스트
 * 파일에 한 벌 더 두고 그걸 검증했다 — 화면이 바뀌어도 통과하는 테스트였다. 페이지를
 * 실제로 그리고 진짜 `window.confirm` 인자를 본다.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewSessionPage } from './InterviewSessionPage'

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
const { deleteSessionMock } = vi.hoisted(() => ({ deleteSessionMock: vi.fn() }))

vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSession: () => sessionQuery,
  useInterviewPrepQuestions: () => questionsQuery,
  useInterviewPrepRefs: () => ({ data: undefined }),
  useGenerateInterviewSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteInterviewSession: () => ({
    mutate: deleteSessionMock,
    isPending: false,
  }),
  useUpdateInterviewPrepSession: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkCreateQuestions: () => ({ mutate: vi.fn(), isPending: false }),
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
  useMyAiCosts: () => ({ data: undefined }),
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({ useRequireAiConsent: () => vi.fn() }))
vi.mock('@/hooks/useRequireJobTitle', () => ({
  useRequireJobTitle: () => vi.fn(),
  resolveJobText: () => '',
}))
vi.mock('@/hooks/useUnloadGuard', () => ({ useUnloadGuard: vi.fn() }))
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }))

/* 사이드바·카드 자식들은 각자 훅을 끌고 온다 — 이 spec 이 보는 건 삭제 확인 문구다 */
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
vi.mock('@/components/card/InterviewQuestionCard', () => ({
  InterviewQuestionCard: () => null,
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

const makeQuestion = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
})

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

const clickDelete = () =>
  fireEvent.click(screen.getByRole('button', { name: /🗑️ 삭제/ }))

describe('세션 삭제 확인 — 직접 적은 질문을 따로 센다', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(sessionQuery, { data: session, isLoading: false, isError: false })
    confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(false) as unknown as ReturnType<typeof vi.spyOn>
  })

  it('1) 직접 적은 질문이 있으면 개수를 말한다', () => {
    Object.assign(questionsQuery, {
      data: [
        makeQuestion({ id: 'q-1', source: 'ai' }),
        makeQuestion({ id: 'q-2', source: 'user' }),
        makeQuestion({ id: 'q-3', source: 'user' }),
      ],
    })
    draw()
    clickDelete()
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('직접 추가한 질문 2개도 함께 삭제돼요.'),
    )
  })

  it('2) 직접 적은 질문이 없으면 그 줄이 없다 (0개라고 말하지 않는다)', () => {
    Object.assign(questionsQuery, {
      data: [makeQuestion({ id: 'q-1', source: 'ai' })],
    })
    draw()
    clickDelete()
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.not.stringContaining('직접 추가한 질문'),
    )
    // 기존 경고는 그대로 남는다
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('생성된 질문과 메모가 모두 삭제됩니다'),
    )
  })

  /** 🔴 꼬리 자리에 직접 적은 질문도 함께 사라진다 — 트리 전체를 센다 */
  it('3) 🔴 꼬리질문으로 적은 내 질문도 센다', () => {
    Object.assign(questionsQuery, {
      data: [
        makeQuestion({
          id: 'q-1',
          source: 'ai',
          children: [
            makeQuestion({ id: 'q-2', depth: 1, source: 'user' }),
            makeQuestion({
              id: 'q-3',
              depth: 1,
              source: 'ai',
              children: [makeQuestion({ id: 'q-4', depth: 2, source: 'user' })],
            }),
          ],
        }),
      ],
    })
    draw()
    clickDelete()
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('직접 추가한 질문 2개도 함께 삭제돼요.'),
    )
  })

  it('4) 취소하면 삭제 API 가 나가지 않는다', () => {
    Object.assign(questionsQuery, {
      data: [makeQuestion({ id: 'q-1', source: 'user' })],
    })
    draw()
    clickDelete()
    expect(deleteSessionMock).not.toHaveBeenCalled()
  })
})
