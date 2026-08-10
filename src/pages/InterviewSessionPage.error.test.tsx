/**
 * 면접 세션 화면 — **조회 실패**를 어떻게 보여주는가.
 *
 * 🔴 **왜 이 파일이 필요했나** (2026-08-09). 화면은 `isLoading` 만 보고 `isError` 는 안 봤다.
 * 조회가 실패하면 `isLoading=false` · `data=undefined` 가 되는데, 원래 조건이
 * `if (sessionLoading || !session)` 이라 **로딩이 끝났는데도 로딩 화면**으로 돌아갔다.
 * 상태가 더 안 바뀌니 영원히 회색 네모다 — 새로고침해도 같고 나갈 문도 없었다.
 *
 * 🔴 **질문 쪽은 데이터 손실 경로였다.** 훅이 `data = []` 로 떨어져서 질문 20개짜리 세션이
 * "아직 질문이 없어요 + [✨ AI 질문 생성]" 으로 보였다. 그 버튼은 `handleGenerate(false)` —
 * **재생성이 아니라 최초 생성으로 취급**돼 `기존 질문과 메모가 모두 삭제됩니다` 확인창도
 * 안 떴고, 서버는 `em.delete(InterviewPrepQuestion, { sessionId })` 로 전부 지웠다.
 * **조회 실패 1회 + 클릭 1회 = 사용자가 쓴 답변 전량 소실 + 코인 차감.**
 *
 * 그래서 이 spec 이 잠그는 건 두 가지다:
 *   ① 실패가 **로딩으로 위장하지 않는다** (나갈 문이 있다)
 *   ② 실패가 **빈 상태로 위장하지 않는다** (지우는 버튼이 화면에 없다)
 *
 * 서버 쪽 짝은 `interview-prep-ai.service.spec.ts` 의 「파괴적 재생성 가드」 —
 * 프론트를 우회해도 서버가 거절한다.
 */
import { render, screen } from '@testing-library/react'
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

vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSession: () => sessionQuery,
  useInterviewPrepQuestions: () => questionsQuery,
  useInterviewPrepRefs: () => ({ data: undefined }),
  useGenerateInterviewSession: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteInterviewSession: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateInterviewPrepSession: () => ({ mutate: vi.fn(), isPending: false }),
  useRefetchQuestionsOnGenerationEnd: vi.fn(),
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({}),
  useUpdateApplication: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

/*
  사이드바의 자식들은 각자 훅을 또 끌고 온다. 이 spec 이 보는 건 **에러 분기**지
  사이드바가 아니므로 통째로 막는다 — 안 그러면 화면 전체의 의존성을 테스트가 떠안고,
  관계없는 컴포넌트가 훅 하나 추가할 때마다 이 파일이 깨진다.
*/
vi.mock('@/components/common/JobTitleField', () => ({ JobTitleField: () => null }))
vi.mock('@/components/card/CompanyResearchCard', () => ({
  CompanyResearchCard: () => null,
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: () => null,
}))
vi.mock('@/components/card/EditInterviewSessionModal', () => ({
  EditInterviewSessionModal: () => null,
}))
vi.mock('@/components/card/InterviewQuestionCard', () => ({
  InterviewQuestionCard: () => null,
}))
vi.mock('@/components/common/AiQuotaChip', () => ({ AiQuotaChip: () => null }))

/* 페이지가 `useQueryClient` 를 직접 쓴다 (REGENERATE_REQUIRED 시 자가 재조회) */
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

/** 로딩 스켈레톤은 텍스트가 없다 — `animate-pulse` 로만 식별된다 */
const skeletons = (c: HTMLElement) => c.querySelectorAll('.animate-pulse')

describe('세션 조회 실패', () => {
  beforeEach(() => {
    Object.assign(sessionQuery, { data: undefined, isLoading: false, isError: false })
    Object.assign(questionsQuery, { data: [], isLoading: false, isError: false })
  })

  it('로딩 중에는 스켈레톤을 보여준다 (기존 동작 무변경)', () => {
    Object.assign(sessionQuery, { isLoading: true })
    const { container } = draw()
    expect(skeletons(container).length).toBeGreaterThan(0)
  })

  /**
   * 🔴 이 케이스가 예전에 **영원히 갇히던** 자리다. 스켈레톤이 남아 있으면 회귀다.
   */
  it('🔴 실패하면 스켈레톤이 아니라 에러 화면을 보여준다', () => {
    Object.assign(sessionQuery, { isError: true })
    const { container } = draw()
    expect(skeletons(container)).toHaveLength(0)
    expect(screen.getByText('면접 준비를 불러오지 못했어요')).toBeTruthy()
  })

  /** 막다른 길을 만들지 않는다 — 되돌아가지 않고 나갈 문이 화면에 있어야 한다 */
  it('🔴 에러 화면에 나갈 문(목록으로)과 다시 시도가 있다', () => {
    Object.assign(sessionQuery, { isError: true })
    draw()
    expect(screen.getByRole('button', { name: '면접 준비 목록으로' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })
})

describe('질문 조회 실패 — 데이터 손실 방지', () => {
  /** 세션은 정상, 질문만 실패한 상황을 만든다 */
  const withSession = () =>
    Object.assign(sessionQuery, {
      data: {
        id: 's-1',
        applicationId: 'app-1',
        title: '1차 면접',
        interviewType: 'first',
        generationStatus: 'idle',
        userNotes: null,
        jobDescription: null,
        coverletterIds: [],
        extraLogIds: [],
        focusPoints: null,
        createdAt: '2026-08-09T00:00:00.000Z',
      },
      isLoading: false,
      isError: false,
    })

  beforeEach(() => {
    Object.assign(sessionQuery, { data: undefined, isLoading: false, isError: false })
    Object.assign(questionsQuery, { data: [], isLoading: false, isError: false })
  })

  it('진짜로 질문이 0개면 빈 상태와 생성 버튼을 보여준다 (기존 동작 무변경)', () => {
    withSession()
    draw()
    expect(screen.getByText('아직 질문이 없어요')).toBeTruthy()
    expect(screen.getByRole('button', { name: /AI 질문 생성/ })).toBeTruthy()
  })

  /**
   * 🔴 **핵심.** 실패했는데 "없어요" 라고 말하면 사용자가 생성 버튼을 누른다.
   * 그 버튼은 확인창 없이 서버의 전량 삭제를 부른다.
   */
  it('🔴 실패하면 "없어요" 가 아니라 "불러오지 못했어요" 라고 말한다', () => {
    withSession()
    Object.assign(questionsQuery, { isError: true })
    draw()
    expect(screen.getByText('질문을 불러오지 못했어요')).toBeTruthy()
    expect(screen.queryByText('아직 질문이 없어요')).toBeNull()
  })

  it('🔴 실패 화면에는 전부 지우는 생성 버튼이 없다', () => {
    withSession()
    Object.assign(questionsQuery, { isError: true })
    draw()
    expect(screen.queryByRole('button', { name: /AI 질문 생성/ })).toBeNull()
  })
})
