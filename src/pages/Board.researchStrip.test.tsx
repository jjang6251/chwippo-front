/**
 * Board — 카드 추가 직후 회사 조사 스트립의 **자리와 수명**.
 *
 * 1. 스토어가 비면 스트립 없음 + 조사 요청 0 (카드 N장이 각자 조회하지 않는다)
 * 2. 지목된 카드 → 그 회사 스트립이 **그리드 위**에 뜬다
 * 3. 다음 카드를 추가하면 그쪽 내용으로 **교체**된다 (쌓이지 않는다)
 * 4. 닫기 → 사라진다
 * 5. 조사 없는 회사 → 스트립 자체가 없다 (레이아웃 이동 0)
 * 6. 필터에 걸려 카드가 안 보여도 스트립은 뜬다 (전체 목록에서 찾는다)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { coverletterDocApi } from '@/api/coverletterDoc'
import { useResearchRevealStore } from '@/stores/researchRevealStore'
import type { Application } from '@/types/application'

function makeApp(over: Partial<Application>): Application {
  return {
    id: 'x', userId: 'u', companyName: '회사', jobTitle: null, jobCategory: null,
    status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex: 0,
    needsDetail: false, isStarred: false, steps: [], createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z', ...over,
  }
}

const APPS: Application[] = [
  makeApp({ id: 'a1', companyName: '네이버' }),
  makeApp({ id: 'a2', companyName: '카카오' }),
  makeApp({ id: 'a3', companyName: '토스', status: 'PLANNED' }),
]

vi.mock('@/hooks/useApplications', () => ({
  useApplications: () => ({ data: APPS, isLoading: false }),
  useUpdateApplication: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/components/card/CompanyCard', () => ({
  CompanyCard: ({ application }: { application: Application }) => (
    <div data-testid="company-card">{application.companyName}</div>
  ),
}))
vi.mock('@/components/card/AddCardModal', () => ({ AddCardModal: () => null }))
// 보드 마운트 시 보완 대기 초안 조회 — 이 spec 관심 밖이라 빈 목록으로 막는다 (실요청 금지)
vi.mock('@/api/jobPosting', () => ({
  jobPostingCardApi: { pending: () => Promise.resolve([]) },
}))
vi.mock('@/api/coverletterDoc', () => ({
  coverletterDocApi: { getResearch: vi.fn() },
}))

import { Board } from './Board'

const mockedGet = vi.mocked(coverletterDocApi.getResearch)

const research = (keyword: string) => ({
  status: 'ok' as const,
  research: {
    interviewKeywords: [{ keyword, category: 'tech' as const }],
    talentProfile: ['도전'],
    businessSummary: '한 줄 요약이다.',
  },
})

function renderBoard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <Board />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useResearchRevealStore.setState({ appId: null })
  mockedGet.mockImplementation(async (id: string) =>
    id === 'a1' ? research('분산 시스템') : id === 'a2' ? research('추천 알고리즘') : null,
  )
})

describe('Board — 회사 조사 스트립', () => {
  it('1) 스토어가 비면 스트립 없음 + 조사 요청 0', async () => {
    renderBoard()
    await waitFor(() => expect(screen.getAllByTestId('company-card').length).toBeGreaterThan(0))
    expect(screen.queryByText('어떤 회사일까요?')).toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('2) 지목된 카드 → 그 회사 스트립이 카드 그리드보다 앞에 온다', async () => {
    useResearchRevealStore.setState({ appId: 'a1' })
    const { container } = renderBoard()

    const strip = await screen.findByRole('region', { name: '네이버 회사 조사' })
    expect(strip).toHaveTextContent('어떤 회사일까요?')
    expect(await screen.findByText('분산 시스템')).toBeInTheDocument()

    // DOM 순서 = 스트립이 첫 카드보다 앞 (그리드 위)
    const firstCard = screen.getAllByTestId('company-card')[0]
    expect(strip.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // 그리드 안에 들어가지 않았다 (카드 높이 계약 무접촉)
    expect(container.querySelector('.grid')?.contains(strip)).toBe(false)
  })

  it('3) 다음 카드를 추가하면 교체된다 (쌓이지 않는다)', async () => {
    useResearchRevealStore.setState({ appId: 'a1' })
    renderBoard()
    await screen.findByText('분산 시스템')

    useResearchRevealStore.getState().reveal('a2')
    expect(await screen.findByText('추천 알고리즘')).toBeInTheDocument()
    expect(screen.queryByText('분산 시스템')).toBeNull()
    expect(screen.getAllByRole('region', { name: /회사 조사/ })).toHaveLength(1)
  })

  it('4) 닫기 → 사라진다', async () => {
    useResearchRevealStore.setState({ appId: 'a1' })
    renderBoard()
    await screen.findByText('분산 시스템')

    fireEvent.click(screen.getByRole('button', { name: '회사 조사 닫기' }))
    await waitFor(() => expect(screen.queryByText('분산 시스템')).toBeNull())
    expect(useResearchRevealStore.getState().appId).toBeNull()
  })

  it('5) 조사 없는 회사 → 스트립 자체가 없다', async () => {
    useResearchRevealStore.setState({ appId: 'a3' })
    renderBoard()
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('a3', { countHit: false }))
    expect(screen.queryByRole('region', { name: /회사 조사/ })).toBeNull()
  })

  it('6) 필터에 걸려 카드가 안 보여도 스트립은 뜬다', async () => {
    useResearchRevealStore.setState({ appId: 'a1' })
    renderBoard()
    fireEvent.click(screen.getByRole('tab', { name: /지원 예정/ }))

    // 네이버 카드는 필터에서 빠졌지만 스트립은 남는다
    expect(await screen.findByRole('region', { name: '네이버 회사 조사' })).toBeInTheDocument()
    const cardNames = screen.getAllByTestId('company-card').map((el) => el.textContent)
    expect(cardNames).not.toContain('네이버')
  })
})
