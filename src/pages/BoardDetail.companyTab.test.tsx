/**
 * BoardDetail — 「회사 알아보기」 탭의 **노출 조건과 URL 폴백**.
 *
 * 시나리오:
 *  1. 조사 있음 → 탭이 뜨고 눌러서 들어간다
 *  2. 🔴 조사 없음 → 탭 자체가 없다 (빈 탭 금지 — 「조사 없으면 조용히」)
 *  3. `?tab=company` 직접 진입 — 조사 있으면 바로 그 탭
 *  4. 🔴 `?tab=company` 인데 조사가 없으면 **기본 탭으로 안전 폴백** (빈 화면 금지)
 *  5. 🔴 flag 가 꺼진 `?tab=coverletter` 도 같은 폴백 (기존 구멍)
 *  6. 조사 응답이 늦게 와도 탭이 생기면 그때 열린다 (상태를 지우지 않는다)
 *  7. 🔴 탭 노출 판정 요청은 **조회수 미집계** — 카드를 열기만 한 건 열람이 아니다
 *  8. 회귀 — 기존 탭(전형 단계·자소서·면접)과 DART 「회사 정보」 섹션 무변경
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Application } from '@/types/application'
import type { CompanyResearchResult } from '@/types/interviewPrep'

const h = vi.hoisted(() => ({
  interviewEnabled: true,
  aiEnabled: true,
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: APP, isLoading: false }),
  useUpdateApplication: () => ({ mutate: vi.fn() }),
  useUpdateCurrentStep: () => ({ mutate: vi.fn() }),
  useUpdateSteps: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useStepDetail', () => ({ useChecklist: () => ({ data: [] }) }))
vi.mock('@/hooks/useDemoNavigate', () => ({ useDemoNavigate: () => vi.fn() }))
vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => h.aiEnabled,
  useInterviewAiEnabled: () => h.interviewEnabled,
}))
vi.mock('@/components/card/CoverLetterTab', () => ({
  CoverLetterTab: () => <div data-testid="cl-tab" />,
}))
vi.mock('@/components/card/InterviewPrepTab', () => ({
  InterviewPrepTab: () => <div data-testid="iv-tab" />,
}))
vi.mock('@/components/board/CompanyInfoSection', () => ({
  CompanyInfoSection: () => <div data-testid="dart-section">회사 정보</div>,
}))
vi.mock('@/components/coverletter/JobPostingBanner', () => ({
  JobPostingBanner: () => <div data-testid="jp-section" />,
}))
vi.mock('@/components/board/CompanyMemoCard', () => ({
  CompanyMemoCard: () => <div data-testid="memo-card" />,
}))
vi.mock('@/api/coverletterDoc', () => ({
  coverletterDocApi: { getResearch: vi.fn() },
}))

import { coverletterDocApi } from '@/api/coverletterDoc'
import { BoardDetail } from './BoardDetail'

const mockedGet = vi.mocked(coverletterDocApi.getResearch)

const APP: Application = {
  id: 'app-1', userId: 'u', companyName: '네이버', jobTitle: '백엔드 개발자',
  jobCategory: null, status: 'IN_PROGRESS', jobUrl: null, memo: null,
  currentStepIndex: 0, needsDetail: false, isStarred: false,
  steps: [
    { id: 's0', applicationId: 'app-1', orderIndex: 0, name: '서류 제출', scheduledDate: null, location: null, notes: null, pinnedContent: null },
  ],
  createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
}

const RESEARCH: CompanyResearchResult = {
  status: 'ok',
  cachedAt: '2026-08-19T15:30:00Z',
  research: {
    businessSummary: '국내 최대 검색 포털이다.',
    recentTrends: `1) 2026-04-28 발표: AI탭 베타 출시. 2) 2026-04-30 실적발표: 매출 3조원.`,
    interviewKeywords: [{ keyword: '분산 시스템', category: 'tech' }],
  },
}

function renderDetail(search = '') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[`/board/app-1${search}`]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/board/:id" element={<BoardDetail />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const tabButton = (name: string) => screen.queryByRole('button', { name })

beforeEach(() => {
  vi.clearAllMocks()
  h.aiEnabled = true
  h.interviewEnabled = true
  mockedGet.mockResolvedValue(RESEARCH)
})

describe('BoardDetail — 「회사 알아보기」 탭 노출', () => {
  it('1) 조사 있음 → 탭이 뜨고 눌러서 들어간다', async () => {
    renderDetail()
    const tab = await screen.findByRole('button', { name: '회사 알아보기' })
    fireEvent.click(tab)
    expect(await screen.findByRole('heading', { name: '어떤 회사인가요' })).toBeInTheDocument()
    expect(screen.getByText('2026-04-28')).toBeInTheDocument()
  })

  /**
   * 🔴 **열린 탭이 배경색에만 실려 있으면 스크린리더는 넷을 똑같이 읽는다.**
   * `aria-pressed` 가 조용히 빠져도 화면은 멀쩡하고 아무 테스트도 안 깨지므로 여기서 고정한다
   * (2026-08-23 /uiux). `role="tab"` 정식 패턴은 키보드 동작이 바뀌어 일부러 안 썼다.
   */
  it('1-b) 🔴 열린 탭만 aria-pressed — 눌러서 옮기면 따라 이동한다', async () => {
    renderDetail()
    const company = await screen.findByRole('button', { name: '회사 알아보기' })
    const steps = screen.getByRole('button', { name: '전형 단계' })

    // 기본은 전형 단계가 열려 있다
    expect(steps).toHaveAttribute('aria-pressed', 'true')
    expect(company).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(company)
    await screen.findByRole('heading', { name: '어떤 회사인가요' })
    expect(company).toHaveAttribute('aria-pressed', 'true')
    expect(steps).toHaveAttribute('aria-pressed', 'false')
    // 🔴 열린 것은 언제나 하나뿐 (넷 중 하나만 true)
    expect(
      ['전형 단계', '회사 알아보기', '자소서', '면접 준비']
        .map((n) => tabButton(n))
        .filter((b) => b?.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(1)
  })

  it('2) 🔴 조사 없음 → 탭 자체가 없다', async () => {
    mockedGet.mockResolvedValue(null)
    renderDetail()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(tabButton('회사 알아보기')).toBeNull()
    // 나머지 탭은 그대로
    expect(tabButton('전형 단계')).toBeInTheDocument()
    expect(tabButton('자소서')).toBeInTheDocument()
    expect(tabButton('면접 준비')).toBeInTheDocument()
  })

  it('2-b) opt_out·빈 껍데기도 같은 처리', async () => {
    mockedGet.mockResolvedValue({ status: 'opt_out' })
    renderDetail()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(tabButton('회사 알아보기')).toBeNull()
  })
})

describe('BoardDetail — URL `?tab=` 폴백', () => {
  it('3) `?tab=company` + 조사 있음 → 바로 그 탭', async () => {
    renderDetail('?tab=company')
    expect(await screen.findByRole('heading', { name: '어떤 회사인가요' })).toBeInTheDocument()
  })

  it('4) 🔴 `?tab=company` 인데 조사가 없으면 기본 탭 — 빈 화면이 되지 않는다', async () => {
    mockedGet.mockResolvedValue(null)
    renderDetail('?tab=company')
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: '어떤 회사인가요' })).toBeNull()
    // 전형 단계 본문이 보인다
    expect(screen.getByTestId('memo-card')).toBeInTheDocument()
    expect(tabButton('전형 단계')).toHaveClass('bg-surface-3')
  })

  it('5) 🔴 flag 가 꺼진 `?tab=coverletter` 도 같은 폴백', async () => {
    h.aiEnabled = false
    renderDetail('?tab=coverletter')
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(screen.queryByTestId('cl-tab')).toBeNull()
    expect(screen.getByTestId('memo-card')).toBeInTheDocument()
    expect(tabButton('전형 단계')).toHaveClass('bg-surface-3')
  })

  it('6) 조사가 늦게 도착해도 `?tab=company` 의도는 살아남는다', async () => {
    let resolve!: (v: CompanyResearchResult) => void
    mockedGet.mockReturnValue(new Promise((r) => { resolve = r }))
    renderDetail('?tab=company')
    // 아직 조사가 없어 폴백 상태
    expect(screen.getByTestId('memo-card')).toBeInTheDocument()
    resolve(RESEARCH)
    expect(await screen.findByRole('heading', { name: '어떤 회사인가요' })).toBeInTheDocument()
  })
})

describe('BoardDetail — 조회수·회귀', () => {
  it('7) 🔴 탭 노출 판정은 미집계 — 카드를 연 것만으로 조회수가 오르면 안 된다', async () => {
    renderDetail()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(mockedGet).toHaveBeenCalledWith('app-1', { countHit: false })
    // 탭에 들어가야 비로소 집계 경로가 호출된다
    fireEvent.click(await screen.findByRole('button', { name: '회사 알아보기' }))
    await waitFor(() =>
      expect(mockedGet.mock.calls.some(([, o]) => o?.countHit !== false)).toBe(true),
    )
  })

  it('8) 회귀 — 기존 탭 3개와 DART 「회사 정보」 섹션은 그대로', async () => {
    renderDetail()
    await screen.findByRole('button', { name: '회사 알아보기' })
    // 순서: 전형 단계 → 회사 알아보기 → 자소서 → 면접 준비
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => ['전형 단계', '회사 알아보기', '자소서', '면접 준비'].includes(t ?? ''))
    expect(labels).toEqual(['전형 단계', '회사 알아보기', '자소서', '면접 준비'])

    // DART 섹션은 전형 단계 안에 그대로 (탭 이름과 겹치지 않는다)
    expect(screen.getByTestId('dart-section')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '자소서' }))
    expect(screen.getByTestId('cl-tab')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '면접 준비' }))
    expect(screen.getByTestId('iv-tab')).toBeInTheDocument()
  })
})
