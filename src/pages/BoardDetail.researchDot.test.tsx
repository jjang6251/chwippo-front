/**
 * BoardDetail — 「회사 알아보기」 **미열람 점**과 **탭 열림 계측**.
 *
 * 점 시나리오:
 *  1. 미열람이면 탭 라벨 옆에 점 (🔴 별표가 아니다 — 별은 카드 즐겨찾기다)
 *  2. 탭을 한 번 열면 사라진다 (다른 탭으로 돌아와도 다시 안 뜬다)
 *  3. 🔴 **다른 카드는 여전히 점** — 기억 단위가 카드라는 게 이 신호의 전부다
 *  4. 🔴 사용자가 다르면 독립 (계정 전환 시 남의 기록 승계 금지)
 *  5. 조사 없으면 탭도 점도 없다 (점이 거짓말할 여지 자체가 없다)
 *  6. 새로고침(재마운트) 후에도 사라진 상태가 유지된다
 *  7. 점은 스크린리더가 읽을 수 있다 (`aria-label` 이 버튼 이름에 붙는다)
 *
 * 계측 시나리오 (`trackClarityEvent` 실제 구현 + `window.clarity` 스파이):
 *  8. 탭 줄 클릭 → `research_tab_open_tab` **1회** (= 점의 성과)
 *  9. 탭 왕복·리렌더에도 중복 없음
 * 10. 스트립에서 온 진입(router state) → `research_tab_open_strip`
 * 11. 표식 없는 URL 진입 → `research_tab_open_url` (복사·공유 주소가 스트립 성과로 안 잡힌다)
 * 12. 🔴 데모에서는 0회
 * 13. 🔴 계측이 던져도 화면이 안 죽는다 (방어는 `lib/clarity` 의 try/catch)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DemoModeContextProvider } from '@/contexts/demoMode'
import { useAuthStore } from '@/stores/authStore'
import type { Application } from '@/types/application'
import type { CompanyResearchResult } from '@/types/interviewPrep'

const h = vi.hoisted(() => ({
  makeApp: (id: string): Application => ({
    id,
    userId: 'u',
    companyName: '네이버',
    jobTitle: '백엔드 개발자',
    jobCategory: null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [
      {
        id: 's0', applicationId: id, orderIndex: 0, name: '서류 제출',
        scheduledDate: null, location: null, notes: null, pinnedContent: null,
      },
    ],
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  }),
}))

vi.mock('@/hooks/useApplications', () => ({
  // 🔴 라우트 id 를 그대로 돌려준다 — 「카드별 독립」 케이스가 성립하려면 카드가 실제로 달라야 한다
  useApplication: (id: string) => ({ data: h.makeApp(id), isLoading: false }),
  useUpdateApplication: () => ({ mutate: vi.fn() }),
  useUpdateCurrentStep: () => ({ mutate: vi.fn() }),
  useUpdateSteps: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useStepDetail', () => ({
  useChecklist: () => ({ data: [] }),
  // 현재 스텝 카드가 날짜를 인라인 저장한다 (useStepScheduleSave → useUpdateStep)
  useUpdateStep: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/hooks/useDemoNavigate', () => ({ useDemoNavigate: () => vi.fn() }))
vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => true,
  useInterviewAiEnabled: () => true,
}))
vi.mock('@/components/card/CoverLetterTab', () => ({ CoverLetterTab: () => <div /> }))
vi.mock('@/components/card/InterviewPrepTab', () => ({ InterviewPrepTab: () => <div /> }))
vi.mock('@/components/board/CompanyInfoSection', () => ({ CompanyInfoSection: () => <div /> }))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({ JobPostingBanner: () => <div /> }))
vi.mock('@/components/board/CompanyMemoCard', () => ({
  CompanyMemoCard: () => <div data-testid="memo-card" />,
}))
vi.mock('@/api/coverletterDoc', () => ({
  coverletterDocApi: { getResearch: vi.fn() },
}))

import { coverletterDocApi } from '@/api/coverletterDoc'
import { BoardDetail } from './BoardDetail'

const mockedGet = vi.mocked(coverletterDocApi.getResearch)

const RESEARCH: CompanyResearchResult = {
  status: 'ok',
  cachedAt: '2026-08-19T15:30:00Z',
  research: { businessSummary: '국내 최대 검색 포털이다.' },
}

const USER_ID = 'user-1'

/** `window.clarity` 로 실제 나간 이벤트 이름들 (trackClarityEvent 는 실제 구현을 쓴다) */
function firedEvents(): string[] {
  const spy = (window as unknown as { clarity?: { mock?: { calls: unknown[][] } } }).clarity
  return (spy?.mock?.calls ?? [])
    .filter((c) => c[0] === 'event')
    .map((c) => String(c[1]))
}

function renderDetail(opts: {
  id?: string
  search?: string
  state?: unknown
  demo?: boolean
} = {}) {
  const { id = 'app-1', search = '', state, demo = false } = opts
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/board/${id}`, search, state }]}>
      <DemoModeContextProvider value={demo}>
        <QueryClientProvider client={qc}>
          <Routes>
            <Route path="/board/:id" element={<BoardDetail />} />
          </Routes>
        </QueryClientProvider>
      </DemoModeContextProvider>
    </MemoryRouter>,
  )
}

/**
 * 점이 붙으면 접근 이름 뒤에 라벨이 이어 붙는다 — 사이 공백은 accname 구현마다 달라
 * 정규식으로 본다. 점이 없으면 이름은 라벨 그대로(정확히 일치)다.
 */
const DOTTED = /^회사 알아보기\s*아직 안 봤어요$/
const dottedTab = () => screen.queryByRole('button', { name: DOTTED })
const plainTab = () => screen.queryByRole('button', { name: '회사 알아보기' })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockedGet.mockResolvedValue(RESEARCH)
  useAuthStore.setState({ user: { id: USER_ID } as never })
  vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'test-clarity')
  ;(window as unknown as { clarity?: unknown }).clarity = vi.fn()
})

afterEach(() => {
  vi.unstubAllEnvs()
  useAuthStore.setState({ user: null })
  delete (window as unknown as { clarity?: unknown }).clarity
})

describe('BoardDetail — 미열람 점', () => {
  it('1·7) 미열람이면 탭 라벨 옆 점 — 스크린리더도 읽는다', async () => {
    renderDetail()
    const tab = await screen.findByRole('button', { name: DOTTED })

    // 🔴 별표가 아니라 점 — 라벨 텍스트는 그대로고 별(★) 문자는 새어나오지 않는다
    expect(tab.textContent).toBe('회사 알아보기')
    expect(tab.textContent).not.toContain('★')
    const dot = tab.querySelector('span.rounded-full')!
    expect(dot).toBeInTheDocument()
    expect(dot.className).toContain('bg-brand') // 의미 토큰 · danger 계열 금지
    expect(dot.className).toContain('w-1.5')
  })

  it('2) 탭을 한 번 열면 사라진다 — 다른 탭으로 돌아와도 안 뜬다', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: DOTTED }))
    await waitFor(() => expect(dottedTab()).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: '전형 단계' }))
    expect(screen.getByTestId('memo-card')).toBeInTheDocument()
    expect(dottedTab()).toBeNull()
    expect(plainTab()).toBeInTheDocument()
  })

  it('3) 🔴 다른 카드는 여전히 점 (카드별 독립)', async () => {
    const first = renderDetail({ id: 'app-1' })
    fireEvent.click(await screen.findByRole('button', { name: DOTTED }))
    await waitFor(() => expect(dottedTab()).toBeNull())
    first.unmount()

    renderDetail({ id: 'app-2' })
    expect(await screen.findByRole('button', { name: DOTTED })).toBeInTheDocument()
  })

  it('4) 🔴 사용자가 다르면 독립 (계정 전환)', async () => {
    const first = renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: DOTTED }))
    await waitFor(() => expect(dottedTab()).toBeNull())
    first.unmount()

    useAuthStore.setState({ user: { id: 'user-2' } as never })
    renderDetail()
    expect(await screen.findByRole('button', { name: DOTTED })).toBeInTheDocument()
  })

  it('5) 조사 없으면 탭도 점도 없다', async () => {
    mockedGet.mockResolvedValue(null)
    renderDetail()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(dottedTab()).toBeNull()
    expect(plainTab()).toBeNull()
    expect(screen.getByRole('button', { name: '전형 단계' })).toBeInTheDocument()
  })

  it('6) 새로고침(재마운트) 후에도 사라진 상태 유지', async () => {
    const first = renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: DOTTED }))
    await waitFor(() => expect(dottedTab()).toBeNull())
    first.unmount()

    renderDetail()
    expect(await screen.findByRole('button', { name: '회사 알아보기' })).toBeInTheDocument()
    expect(dottedTab()).toBeNull()
  })

  it('6-b) URL 로 바로 탭에 들어가도 「봤음」으로 기록된다', async () => {
    const first = renderDetail({ search: '?tab=company' })
    await screen.findByRole('heading', { name: '어떤 회사인가요' })
    first.unmount()

    renderDetail()
    expect(await screen.findByRole('button', { name: '회사 알아보기' })).toBeInTheDocument()
    expect(dottedTab()).toBeNull()
  })
})

describe('BoardDetail — 탭 열림 계측', () => {
  it('8·9) 탭 줄 클릭 → research_tab_open_tab 1회 · 탭 왕복에도 중복 없음', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: DOTTED }))
    await waitFor(() => expect(firedEvents()).toEqual(['research_tab_open_tab']))

    // 탭을 오갔다 돌아와도 한 번 그대로
    fireEvent.click(screen.getByRole('button', { name: '전형 단계' }))
    fireEvent.click(screen.getByRole('button', { name: '회사 알아보기' }))
    fireEvent.click(screen.getByRole('button', { name: '자소서' }))
    fireEvent.click(screen.getByRole('button', { name: '회사 알아보기' }))
    await waitFor(() =>
      expect(firedEvents().filter((e) => e.startsWith('research_tab_open'))).toHaveLength(1),
    )
  })

  it('10) 스트립에서 온 진입 → research_tab_open_strip', async () => {
    renderDetail({ search: '?tab=company', state: { from: 'strip' } })
    await screen.findByRole('heading', { name: '어떤 회사인가요' })
    await waitFor(() => expect(firedEvents()).toEqual(['research_tab_open_strip']))
  })

  it('11) 표식 없는 URL 진입 → research_tab_open_url (공유된 주소가 스트립 성과로 안 잡힌다)', async () => {
    renderDetail({ search: '?tab=company' })
    await screen.findByRole('heading', { name: '어떤 회사인가요' })
    await waitFor(() => expect(firedEvents()).toEqual(['research_tab_open_url']))
  })

  it('12) 🔴 데모에서는 0회', async () => {
    renderDetail({ demo: true })
    fireEvent.click(await screen.findByRole('button', { name: DOTTED }))
    await screen.findByRole('heading', { name: '어떤 회사인가요' })
    expect(firedEvents()).toEqual([])
  })

  it('13) 🔴 계측이 던져도 화면이 안 죽는다', async () => {
    // 광고 차단기가 clarity 스크립트를 갈아치운 상황 — 방어는 lib/clarity 의 try/catch 다
    ;(window as unknown as { clarity: () => void }).clarity = () => {
      throw new Error('blocked by extension')
    }
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: DOTTED }))
    // 탭 본문이 정상 렌더되고 점도 정상적으로 사라진다
    expect(await screen.findByRole('heading', { name: '어떤 회사인가요' })).toBeInTheDocument()
    expect(dottedTab()).toBeNull()
  })
})
