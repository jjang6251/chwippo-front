/**
 * 자소서 화면 → 면접 버튼의 **배선** (2026-08-10).
 *
 * 🔴 **왜 따로 뒀나.** 버튼 자체는 `GoToInterviewButton.test.tsx` 가 촘촘히 지키는데,
 * **페이지가 그 버튼에 무엇을 넘기는지**는 아무도 안 봤다. 실제로 두 가드를 지우고
 * 전체 테스트를 돌려도 **1,892건이 전부 통과**했다:
 *
 *   ① `interviewAiEnabled &&` 를 지우면 → 면접 기능을 꺼도 **이 버튼만 남아**
 *      숨긴 기능으로 안내한다 (사이드바·카드 상세는 둘 다 flag 를 본다).
 *   ② `navigateOnly={aiBlocked}` 를 지우면 → 모바일에서 **생성 모달이 열리고**
 *      거기서 만들면 AI 질문 생성으로 **코인이 나간다.**
 *
 * 컴포넌트가 아무리 옳게 동작해도 **잘못 불리면 소용이 없다.** 그 층을 여기서 잠근다.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverletterDocPage } from './CoverletterDocPage'

const flags = vi.hoisted(() => ({ interviewAi: true, aiBlocked: false }))
const sess = vi.hoisted(() => ({
  list: [{ id: 's-1', round: '1차 실무 면접' }] as unknown[],
}))

vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => true,
  useInterviewAiEnabled: () => flags.interviewAi,
}))
vi.mock('@/hooks/useCoverletterAiBlocked', () => ({
  useCoverletterAiBlocked: () => flags.aiBlocked,
}))
vi.mock('@/hooks/useInterviewPrep', () => ({
  useInterviewPrepSessions: () => ({
    data: sess.list,
    isLoading: false,
    isError: false,
  }),
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({
    data: { id: 'app-1', companyName: '카카오', jobTitle: '백엔드' },
  }),
  useUpdateApplication: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useApplicationCoverletters', () => ({
  useCoverletters: () => ({
    data: [
      {
        id: 'cl-1',
        applicationId: 'app-1',
        category: '지원동기',
        question: '지원 동기를 작성해 주세요.',
        answer: '경품을 키우는 대신 참여 문턱을 낮췄습니다.',
        charLimit: 800,
        orderIndex: 0,
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateCoverletter: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveCoverletter: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCoverletter: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useCoverletterDoc', () => ({
  useCompanyResearchCache: () => ({ data: null, isLoading: false }),
}))
vi.mock('@/hooks/useAiFeedbackUnloadGuard', () => ({
  useAiFeedbackUnloadGuard: () => {},
}))
/* 화면 나머지는 이 spec 의 관심사가 아니다 — 배선만 본다 */
vi.mock('@/components/coverletter/CoverletterChatPanel', () => ({
  CoverletterChatPanel: () => null,
}))
vi.mock('@/components/coverletter/CompanyResearchBanner', () => ({
  CompanyResearchBanner: () => null,
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: () => null,
}))
vi.mock('@/components/common/JobTitleField', () => ({
  JobTitleField: () => null,
}))
vi.mock('@/components/card/NewInterviewSessionModal', () => ({
  NewInterviewSessionModal: () => <div>새 면접 준비 만들기 모달</div>,
}))
vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), error: vi.fn() },
}))
vi.mock('react-router-dom', async () => {
  const real =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useParams: () => ({ applicationId: 'app-1' }) }
})

function draw() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CoverletterDocPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const goBtn = () => screen.queryByRole('button', { name: /면접 준비/ })

describe('면접 버튼 배선', () => {
  beforeEach(() => {
    flags.interviewAi = true
    flags.aiBlocked = false
    sess.list = [{ id: 's-1', round: '1차 실무 면접' }]
  })

  it('기본(데스크탑·flag on) — 버튼이 보인다', () => {
    draw()
    expect(goBtn()).toBeTruthy()
  })

  /** 🔴 사이드바·카드 상세는 flag 를 보는데 이 버튼만 안 봤다 */
  it('🔴 면접 기능이 꺼져 있으면 버튼이 없다', () => {
    flags.interviewAi = false
    draw()
    expect(goBtn()).toBeNull()
  })

  /**
   * 🔴 모바일은 **이동 전용**이어야 한다. 배선이 빠지면 생성 모달이 열리고,
   * 거기서 만들면 AI 질문 생성으로 코인이 나간다.
   */
  it('🔴 모바일에서 세션이 없으면 버튼 자체가 없다 (생성으로 새지 않는다)', () => {
    flags.aiBlocked = true
    sess.list = []
    draw()
    expect(goBtn()).toBeNull()
    expect(screen.queryByText('새 면접 준비 만들기 모달')).toBeNull()
  })

  it('🔴 모바일에서도 세션이 있으면 건너갈 수 있다', () => {
    flags.aiBlocked = true
    draw()
    expect(goBtn()).toBeTruthy()
    expect(goBtn()!.textContent).not.toContain('만들기') // 이동 전용
  })

  /** 데스크탑은 반대로 — 세션이 없으면 만들 수 있어야 한다 */
  it('데스크탑에서 세션이 없으면 만들기로 안내한다', () => {
    sess.list = []
    draw()
    expect(goBtn()!.textContent).toContain('만들기')
  })
})
