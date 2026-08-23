/**
 * 🔴 **IAP 방어선 — 자소서 화면에서 AI 진입점이 모바일·RN 에 새지 않는가.**
 *
 * ## 지우지 말 것
 *
 * 치뽀 앱은 `https://chwippo.com` 을 띄우는 **WebView 셸**이다. 웹을 배포하면
 * **앱 심사 없이 앱 안 동작이 바뀐다** — 코인을 쓰는 AI 가 앱에 노출되면 Apple IAP
 * 강제 대상이 되는데, 실수로 열려도 **아무도 안 막고 우리도 모른다.**
 * 그래서 사람이 눈으로 보는 대신 이 spec 이 게이트를 잠근다.
 *
 * ## 이 spec 이 잠그는 계약
 *
 *  ① 모바일 뷰포트 → AI 진입점 **0개** (AI 에게 묻기·자소서 검사·FAB·채팅 패널)
 *  ② RN 네이티브 → **뷰포트가 데스크탑 폭이어도** 0개 (태블릿 앱 구멍)
 *  ③ 그런데 **문항·답변은 고칠 수 있다** (2026-08-23 CEO — 모바일 편집 개방).
 *     ①②만 있으면 "전부 막아라" 로 후퇴해도 통과한다 — 그건 이미 한 번 되돌린 상태다.
 *  ④ 삭제·유형·글자수 제한·답변 가져오기는 계속 안 보인다 (되돌리기 어려운 조작).
 *
 * ## 왜 페이지째 렌더하나
 *
 * 게이트는 **훅 하나 + 페이지 배선**으로 이뤄져 있다. 카드만 단위로 보면
 * "페이지가 그 카드에 무엇을 넘기는지" 가 빠져, 배선을 지워도 아무도 안 운다
 * (`CoverletterDocPage.wiring.test.tsx` 가 같은 이유로 만들어졌다).
 * 여기서는 `useMediaQuery`·`useNativeMode` 만 바꿔 끼우고 **게이트 훅은 실물**을 돌린다.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverletterDocPage } from './CoverletterDocPage'

/** 환경 — 뷰포트 폭(lg 미만) · RN 네이티브 여부. 게이트 훅의 두 입력이다 */
const env = vi.hoisted(() => ({ belowLg: false, native: false }))

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: (query: string) =>
    query.includes('1023') ? env.belowLg : false,
  useIsMobile: () => env.belowLg,
}))
vi.mock('@/hooks/useNativeMode', () => ({
  useNativeMode: () => env.native,
}))

vi.mock('@/hooks/useAiEnabled', () => ({
  // AI 기능 자체는 **켜져 있는** 상태로 본다 — flag 로 꺼서 통과하면 게이트를 안 잰 것이다
  useAiEnabled: () => true,
  useInterviewAiEnabled: () => false,
}))
vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({
    data: { id: 'app-1', companyName: '카카오', jobTitle: '백엔드' },
    isLoading: false,
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
        question: '지원하게 된 동기를 작성해 주세요.',
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
vi.mock('@/hooks/useCoverletterSourceRefs', () => ({
  useCoverletterSourceRefs: () => ({ data: [] }),
}))
vi.mock('@/hooks/useAiFeedbackUnloadGuard', () => ({
  useAiFeedbackUnloadGuard: () => {},
}))
/**
 * 채팅 패널은 **표식으로** 바꿔 끼운다 — null 로 죽이면 "안 보인다" 가
 * 게이트 덕인지 mock 덕인지 구분되지 않는다. 데스크탑에서 이 표식이 보여야 대조가 성립한다.
 */
vi.mock('@/components/coverletter/CoverletterChatPanel', () => ({
  CoverletterChatPanel: () => <div data-testid="ai-chat-panel" />,
}))
/* 게이트와 무관한 주변 UI — 이 spec 의 관심사가 아니다 */
vi.mock('@/components/coverletter/CompanyResearchBanner', () => ({
  CompanyResearchBanner: () => null,
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: () => null,
}))
vi.mock('@/components/common/JobTitleField', () => ({
  JobTitleField: () => null,
}))
vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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

/** 코인을 쓰는 진입점 전부 — 하나라도 잡히면 IAP 방어선이 뚫린 것이다 */
function aiEntryPoints(): Element[] {
  return [
    ...screen.queryAllByText(/AI 에게 묻기/),
    ...screen.queryAllByText(/자소서 검사/),
    ...screen.queryAllByLabelText(/AI 채팅 패널/), // 데스크탑 aside 는 아니고 FAB·바텀시트
    ...screen.queryAllByTestId('ai-chat-panel'),
  ]
}

const answerBox = () => screen.queryByPlaceholderText(/여기에 답변을 작성하세요/)

beforeEach(() => {
  env.belowLg = false
  env.native = false
})

describe('🔴 IAP 방어선 — AI 진입점', () => {
  /**
   * 🔴 **대조군이 없으면 이 파일은 아무것도 증명하지 못한다.**
   * "0개" 는 렌더가 실패해도, 문구가 바뀌어도 통과한다. 데스크탑에서 실제로 잡히는지 먼저 본다.
   */
  it('데스크탑 웹 — AI 진입점이 실제로 잡힌다 (대조군)', () => {
    draw()
    expect(screen.getByTestId('ai-chat-panel')).toBeInTheDocument()
    expect(screen.getByText(/AI 에게 묻기/)).toBeInTheDocument()
    expect(screen.getByText(/자소서 검사/)).toBeInTheDocument()
  })

  it('🔴 모바일 뷰포트 — AI 진입점 0개', () => {
    env.belowLg = true
    draw()
    expect(aiEntryPoints()).toHaveLength(0)
  })

  /** 🔴 태블릿 RN 앱 — 뷰포트가 lg 이상이라 폭만 보면 통째로 새어 나간다 */
  it('🔴 RN 네이티브 — 뷰포트가 데스크탑 폭이어도 AI 진입점 0개', () => {
    env.native = true
    env.belowLg = false
    draw()
    expect(aiEntryPoints()).toHaveLength(0)
  })

  it('🔴 모바일 + RN 네이티브 — 당연히 0개', () => {
    env.belowLg = true
    env.native = true
    draw()
    expect(aiEntryPoints()).toHaveLength(0)
  })
})

/**
 * 🔴 **막는 건 AI 뿐이다** (2026-08-23 CEO). 위 세 케이스만 있으면 "전부 다시 막아라" 로
 * 후퇴해도 전부 통과한다 — 그건 이미 한 번 되돌린 상태이므로 반대편도 같이 잠근다.
 */
describe('🔴 모바일에서 문항·답변은 고칠 수 있다', () => {
  beforeEach(() => {
    env.belowLg = true
  })

  it('답변 textarea 가 있다', () => {
    draw()
    expect(answerBox()).toBeInTheDocument()
  })

  it('문항을 눌러 편집 textarea 로 들어간다', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: '문항 편집' }))
    expect(
      screen.getByPlaceholderText(/우리 회사에 지원한 동기/),
    ).toBeInTheDocument()
  })

  it('문항을 추가할 수 있다 (쓸 수는 있는데 만들 수 없으면 막다른 길이다)', () => {
    draw()
    expect(screen.getByRole('button', { name: /문항 추가/ })).toBeInTheDocument()
  })

  it('RN 네이티브에서도 같다', () => {
    env.belowLg = false
    env.native = true
    draw()
    expect(answerBox()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '문항 편집' })).toBeInTheDocument()
  })

  /**
   * 🔴 되돌리기 어렵거나 구조를 바꾸는 조작은 작은 화면에서 오조작 위험이 크다 —
   * CEO 가 지시한 범위(문항·답변)를 넘어 열리지 않는지 본다.
   */
  it('🔴 삭제·유형·글자수 제한·답변 가져오기는 없다', () => {
    const { container } = draw()
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull()
    expect(container.querySelector('select')).toBeNull() // 유형
    expect(screen.queryByPlaceholderText('없음')).toBeNull() // 글자수 제한
    expect(screen.queryByText(/답변 가져오기/)).toBeNull()
  })

  /** 없는 것을 가리키지 않는다 — 모바일엔 AI 채팅이 없다 */
  it('답변 placeholder 가 AI 채팅을 가리키지 않는다', () => {
    draw()
    expect(answerBox()!.getAttribute('placeholder')).not.toContain('AI 채팅')
  })
})
