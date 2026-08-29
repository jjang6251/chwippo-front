/**
 * A11 — Board 뷰 토글 통합 시나리오.
 *   1. 기본 = 카드 뷰 (CompanyCard 렌더, 리스트/그룹 아님)
 *   2. 리스트 토글 → 리스트 행(회사명) 렌더, 그룹 헤더 없음
 *   3. 그룹 토글 → 단계 그룹 헤더 렌더, 빈 그룹(불합격) 미렌더
 *   4. localStorage 복원 — 'group' 저장 상태로 마운트 → 그룹 뷰로 시작
 *   5. 토글 선택 → localStorage 저장
 *   6. 필터 탭(지원 중) + 그룹 뷰 조합 → IN_PROGRESS 그룹만
 *
 * 딥링크(`?add=`) — 공지의 「지금 해보기」가 여기로 떨어진다.
 *   7. `?add=posting` → 카드 추가 모달이 IN_PROGRESS + 공고 모드로 열린다
 *   8. 🔴 열자마자 `add` 파라미터가 URL 에서 사라진다 (새로고침에 다시 안 열리게)
 *   9. 🔴 `add` 를 지워도 다른 파라미터(`filter`)는 남는다
 *  10. `?add=1` → 직접 입력 모드
 *  11. 파라미터가 없으면 모달은 안 열린다
 *  12. 모르는 값(`?add=xyz`)도 안 연다
 *
 * CompanyCard·AddCardModal 은 stub (뷰 스위칭·그룹핑만 검증, 카드 내부 로직은 별도 테스트).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
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
// 모달 내부는 별도 spec — 여기선 **어떻게 열렸는지**(상태·시작 모드)만 본다
vi.mock('@/components/card/AddCardModal', () => ({
  AddCardModal: ({
    defaultStatus,
    initialMode,
    onClose,
  }: {
    defaultStatus?: string
    initialMode?: string
    onClose: () => void
  }) => (
    <div data-testid="add-card-modal" data-status={defaultStatus} data-mode={initialMode ?? ''}>
      <button type="button" onClick={onClose}>
        모달 닫기
      </button>
    </div>
  ),
}))
// 보드 마운트 시 보완 대기 초안 조회 — 이 spec 관심 밖이라 빈 목록으로 막는다 (실요청 금지)
vi.mock('@/api/jobPosting', () => ({
  jobPostingCardApi: { pending: () => Promise.resolve([]) },
}))

import { Board } from './Board'

/** 지금 URL — `add` 파라미터가 정말 지워졌는지 보려면 라우터 안에서 읽어야 한다 */
function LocationProbe() {
  const loc = useLocation()
  return <span data-testid="location">{loc.pathname + loc.search}</span>
}

function renderBoard(entry = '/board') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={qc}>
        <Board />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const addModal = () => screen.queryByTestId('add-card-modal')
const currentUrl = () => screen.getByTestId('location').textContent

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

describe('Board 딥링크 ?add=', () => {
  it('7) ?add=posting → 카드 추가 모달이 IN_PROGRESS + 공고 모드로 열린다', () => {
    renderBoard('/board?add=posting')
    expect(addModal()).toBeInTheDocument()
    expect(addModal()).toHaveAttribute('data-status', 'IN_PROGRESS')
    expect(addModal()).toHaveAttribute('data-mode', 'posting')
  })

  it('13) 🔴 이미 /board 에 있는데 ?add=posting 으로 바뀌어도 열린다 (공지 CTA 는 보드 위에서 눌린다)', () => {
    // 실브라우저 실측(2026-08-30): 마운트 초기값만 읽던 첫 구현은 같은 페이지 안 이동에서 파라미터만 지우고 안 열렸다
    function NavProbe() {
      const navigate = useNavigate()
      return (
        <button type="button" onClick={() => navigate('/board?add=posting')}>
          지금 해보기
        </button>
      )
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <MemoryRouter initialEntries={['/board']}>
        <QueryClientProvider client={qc}>
          <Board />
          <LocationProbe />
          <NavProbe />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    expect(addModal()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '지금 해보기' }))
    expect(addModal()).toBeInTheDocument()
    expect(addModal()).toHaveAttribute('data-mode', 'posting')
    // 닫으면 파라미터도 같이 사라진다
    fireEvent.click(screen.getByRole('button', { name: '모달 닫기' }))
    expect(addModal()).not.toBeInTheDocument()
    expect(currentUrl()).toBe('/board')
  })

  it('8) 🔴 모달을 닫으면 add 파라미터가 URL 에서 사라진다 (닫기 전엔 남아 있어 새로고침해도 다시 열린다 — 아직 안 닫았으니)', () => {
    renderBoard('/board?add=posting')
    expect(currentUrl()).toBe('/board?add=posting')
    expect(addModal()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '모달 닫기' }))
    expect(addModal()).not.toBeInTheDocument()
    expect(currentUrl()).toBe('/board')
  })

  it('9) 닫을 때 add 만 지우고 다른 파라미터는 남긴다', () => {
    renderBoard('/board?filter=PLANNED&add=posting')
    expect(addModal()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '모달 닫기' }))
    expect(currentUrl()).toBe('/board?filter=PLANNED')
  })

  it('10) ?add=1 → 직접 입력 모드', () => {
    renderBoard('/board?add=1')
    expect(addModal()).toHaveAttribute('data-status', 'IN_PROGRESS')
    expect(addModal()).toHaveAttribute('data-mode', 'manual')
  })

  it('11) 파라미터가 없으면 모달은 안 열린다', () => {
    renderBoard()
    expect(addModal()).not.toBeInTheDocument()
  })

  it('12) 모르는 값은 안 연다', () => {
    renderBoard('/board?add=xyz')
    expect(addModal()).not.toBeInTheDocument()
  })
})
