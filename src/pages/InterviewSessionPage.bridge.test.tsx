/**
 * 다리 (a) 받는 쪽 — **준비 노트가 붙여넣기 칸으로 들어온다** (2026-08-11).
 *
 * 스텝 페이지가 노트를 plain text 로 실어 보내면(`state.bridgeText`), 이 화면은
 * 폼을 **붙여넣기로 열고 채우기만** 한다. 쪼개기·번호 떼기·중복 제외·50개 상한은
 * 기존 파서 몫이고, 미리보기가 관문이라 확인 없이 서버로 나가지 않는다.
 *
 * 이 spec 이 잠그는 것:
 *   ① 넘어오면 폼이 **자동으로 열리고** 붙여넣기 세그먼트가 선택된다 (직접 적기가 아니다)
 *   ② textarea 에 노트가 차 있고 미리보기가 이미 떠 있다
 *   ③ 🔴 **state 는 한 번만 먹는다** — 안 지우면 새로고침마다 같은 노트가 되살아나
 *     사용자가 방금 끈 줄이 다시 켜진 채로 나타난다
 *   ④ 🔴 폼을 닫았다 다시 열면 **빈 폼**이다 (같은 이유)
 *   ⑤ 그냥 들어오면 예전처럼 닫힌 채다 (회귀)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  useBulkCreateQuestions: () => ({ mutate: vi.fn(), isPending: false }),
  useRefetchQuestionsOnGenerationEnd: vi.fn(),
  questionsKey: (id: string) => ['interview-prep-questions', id],
  sessionKey: (id: string) => ['interview-prep-session', id],
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: { companyName: '카카오', steps: [] } }),
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
vi.mock('@/hooks/useRequireAiConsent', () => ({
  useRequireAiConsent: () => vi.fn(),
}))
vi.mock('@/hooks/useRequireJobTitle', () => ({
  useRequireJobTitle: () => vi.fn(),
  resolveJobText: () => '',
}))
vi.mock('@/hooks/useUnloadGuard', () => ({ useUnloadGuard: vi.fn() }))
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }))
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

const NOTE = '1분 자기소개 해주세요\n가장 어려웠던 협업 경험은?'

const draw = (state?: unknown) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter
        initialEntries={[{ pathname: '/interviews/s-1', state }]}
      >
        <InterviewSessionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const pasteBox = () =>
  screen.queryByRole('textbox', { name: /붙여넣을 질문 목록/ }) as
    | HTMLTextAreaElement
    | null
const formOpen = () =>
  screen.queryByRole('button', { name: /직접 적기/ }) !== null
const addButton = () => screen.getByRole('button', { name: /＋ 질문 추가/ })

let replaceSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  Object.assign(sessionQuery, { data: session, isLoading: false, isError: false })
  Object.assign(questionsQuery, { data: [], isLoading: false, isError: false })
  replaceSpy = vi.spyOn(window.history, 'replaceState')
})
afterEach(() => {
  replaceSpy.mockRestore()
  window.history.replaceState({}, '')
})

describe('준비 노트가 넘어오면', () => {
  it('폼이 자동으로 열린다', () => {
    draw({ bridgeText: NOTE })
    expect(formOpen()).toBe(true)
  })

  it('🔴 붙여넣기 세그먼트가 골라져 있다 (직접 적기가 아니다)', () => {
    draw({ bridgeText: NOTE })
    expect(
      screen
        .getByRole('button', { name: /여러 개 붙여넣기/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen.getByRole('button', { name: /직접 적기/ }).getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('노트가 칸에 차 있고 미리보기가 이미 떠 있다', () => {
    draw({ bridgeText: NOTE })
    expect(pasteBox()?.value).toBe(NOTE)
    // 파서가 돌아 줄마다 후보로 잡힌다 — 사용자는 지울 줄만 끄면 된다
    expect(screen.getByText('1분 자기소개 해주세요')).toBeTruthy()
    expect(screen.getByText('가장 어려웠던 협업 경험은?')).toBeTruthy()
    expect(screen.getByRole('button', { name: /2개 추가/ })).toBeTruthy()
  })

  it('질문이 이미 있는 세션에서도 같다 (빈 상태 전용이 아니다)', () => {
    Object.assign(questionsQuery, {
      data: [
        {
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
        },
      ],
      isLoading: false,
      isError: false,
    })
    draw({ bridgeText: NOTE })
    expect(pasteBox()?.value).toBe(NOTE)
  })

  /**
   * 🔴 지우지 않으면 새로고침마다 노트가 되살아난다 — 사용자가 방금 끈 줄이
   * 다시 켜진 채로 나타나고, 모르고 누르면 지웠던 질문이 그대로 들어간다.
   */
  it('🔴 라우터 state 를 1회 소비한다 (history 에서 bridgeText 를 지운다)', () => {
    // 실서비스(BrowserRouter)가 히스토리에 넣어두는 모양 그대로 깔아 둔다
    window.history.replaceState(
      { usr: { bridgeText: NOTE }, key: 'k1', idx: 3 },
      '',
    )
    draw({ bridgeText: NOTE })

    const after = window.history.state as {
      usr?: Record<string, unknown>
      key?: string
      idx?: number
    }
    expect(after.usr?.bridgeText).toBeUndefined()
    // 🔴 라우터가 쓰는 칸까지 날리면 뒤로가기 위치가 어긋난다
    expect(after.key).toBe('k1')
    expect(after.idx).toBe(3)
  })

  it('넘어온 게 없으면 히스토리를 건드리지 않는다', () => {
    replaceSpy.mockClear()
    draw()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('🔴 닫았다 다시 열면 빈 폼이다 (처리한 노트가 되살아나지 않는다)', () => {
    draw({ bridgeText: NOTE })
    expect(pasteBox()?.value).toBe(NOTE)

    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(formOpen()).toBe(false)

    fireEvent.click(addButton())
    expect(formOpen()).toBe(true)
    // 붙여넣기가 아니라 기본(직접 적기)으로 열리고, 칸도 비어 있다
    expect(pasteBox()).toBeNull()
    expect(
      screen.getByRole('button', { name: /직접 적기/ }).getAttribute('aria-pressed'),
    ).toBe('true')
  })
})

describe('그냥 들어오면 예전 그대로', () => {
  it('state 가 없으면 폼은 닫힌 채다', () => {
    draw()
    expect(formOpen()).toBe(false)
  })

  it('공백만 넘어오면 열지 않는다 (빈 폼을 띄울 이유가 없다)', () => {
    draw({ bridgeText: '   \n  ' })
    expect(formOpen()).toBe(false)
  })

  it('다른 state 가 실려 있어도 열지 않는다', () => {
    draw({ from: 'somewhere' })
    expect(formOpen()).toBe(false)
  })
})
