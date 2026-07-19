/**
 * A11 — Board 뷰 토글 통합 시나리오.
 *   1. 기본 = 카드 뷰 (CompanyCard 렌더, 리스트/그룹 아님)
 *   2. 리스트 토글 → 리스트 행(회사명) 렌더, 그룹 헤더 없음
 *   3. 그룹 토글 → 단계 그룹 헤더 렌더, 빈 그룹(불합격) 미렌더
 *   4. localStorage 복원 — 'group' 저장 상태로 마운트 → 그룹 뷰로 시작
 *   5. 토글 선택 → localStorage 저장
 *   6. 필터 탭(지원 중) + 그룹 뷰 조합 → IN_PROGRESS 그룹만
 *
 * CompanyCard·AddCardModal 은 stub (뷰 스위칭·그룹핑만 검증, 카드 내부 로직은 별도 테스트).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Application, ApplicationStep } from '@/types/application'
import { BOARD_VIEW_STORAGE_KEY } from '@/utils/boardViewGroups'

function step(orderIndex: number, date: string | null): ApplicationStep {
  return { id: `s${orderIndex}`, applicationId: 'a', orderIndex, name: `스텝${orderIndex}`, scheduledDate: date, location: null, notes: null, pinnedContent: null }
}
function makeApp(over: Partial<Application>): Application {
  return {
    id: 'x', userId: 'u', companyName: '회사', jobTitle: null, jobCategory: null,
    status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex: 0,
    needsDetail: false, isStarred: false, steps: [], createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z', ...over,
  }
}

const PAST = '2000-01-01'
const FUTURE = '2099-12-31'

const APPS: Application[] = [
  makeApp({ id: 'a1', companyName: '네이버', status: 'IN_PROGRESS', steps: [step(0, FUTURE)], currentStepIndex: 0 }), // document
  makeApp({ id: 'a2', companyName: '카카오', status: 'IN_PROGRESS', steps: [step(0, PAST), step(1, FUTURE)], currentStepIndex: 1 }), // interview
  makeApp({ id: 'a3', companyName: '토스', status: 'PASSED' }), // passed
  makeApp({ id: 'a4', companyName: '쿠팡', status: 'PLANNED' }), // planned
  makeApp({ id: 'a5', companyName: '배민', status: 'IN_PROGRESS', steps: [step(0, PAST), step(1, PAST)], currentStepIndex: 1 }), // waiting
  makeApp({ id: 'a6', companyName: '라인', status: 'FAILED' }), // failed (전체 탭 제외)
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

import { Board } from './Board'

function renderBoard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <Board />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())

describe('Board 뷰 토글', () => {
  it('1) 기본 = 카드 뷰', () => {
    renderBoard()
    expect(screen.getAllByTestId('company-card').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '카드 보기' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: /면접·시험/ })).not.toBeInTheDocument()
  })

  it('2) 리스트 토글 → 리스트 행 렌더, 그룹 헤더 없음', () => {
    renderBoard()
    fireEvent.click(screen.getByRole('button', { name: '리스트 보기' }))
    expect(screen.queryAllByTestId('company-card')).toHaveLength(0)
    // 전체 탭(FAILED 제외) → 라인(FAILED) 은 없고 나머지 회사명은 행으로
    expect(screen.getByText('네이버')).toBeInTheDocument()
    expect(screen.getByText('토스')).toBeInTheDocument()
    expect(screen.queryByText('라인')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /서류/ })).not.toBeInTheDocument()
  })

  it('3) 그룹 토글 → 단계 그룹 헤더 + 빈 그룹(불합격) 미렌더', () => {
    renderBoard()
    fireEvent.click(screen.getByRole('button', { name: '그룹 보기' }))
    expect(screen.getByRole('heading', { name: /면접·시험/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /서류/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /결과 대기/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /지원 예정/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /합격/ })).toBeInTheDocument()
    // 라인(FAILED) 은 전체 탭에서 제외 → 불합격 그룹 없음
    expect(screen.queryByRole('heading', { name: /불합격/ })).not.toBeInTheDocument()
  })

  it('4) localStorage=group 저장 상태로 마운트 → 그룹 뷰로 시작', () => {
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, 'group')
    renderBoard()
    expect(screen.getByRole('button', { name: '그룹 보기' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: /면접·시험/ })).toBeInTheDocument()
  })

  it('5) 토글 선택 → localStorage 저장', () => {
    renderBoard()
    fireEvent.click(screen.getByRole('button', { name: '리스트 보기' }))
    expect(localStorage.getItem(BOARD_VIEW_STORAGE_KEY)).toBe('list')
  })

  it('6) 지원 중 탭 + 그룹 뷰 → IN_PROGRESS 그룹만', () => {
    renderBoard()
    fireEvent.click(screen.getByRole('tab', { name: /지원 중/ }))
    fireEvent.click(screen.getByRole('button', { name: '그룹 보기' }))
    // IN_PROGRESS = 네이버(서류)·카카오(면접)·배민(결과 대기)
    expect(screen.getByRole('heading', { name: /면접·시험/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /서류/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /결과 대기/ })).toBeInTheDocument()
    // 합격(토스)·지원 예정(쿠팡) 은 IN_PROGRESS 탭에서 제외 → 행·그룹 헤더 모두 없음
    expect(screen.queryByRole('heading', { name: /지원 예정/ })).not.toBeInTheDocument()
    expect(screen.queryByText('토스')).not.toBeInTheDocument()
    expect(screen.queryByText('쿠팡')).not.toBeInTheDocument()
  })
})
