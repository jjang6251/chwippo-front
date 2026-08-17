import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 면접 모아보기 — 상태 필터 + 세션 우선 정렬 (2026-08-17).
 *
 * 🔴 **PLANNED 회귀가 이 파일의 존재 이유다.** 필터가 `'CREATED'`(존재하지 않는 상태)를
 * 담고 있어 **지원 예정 카드가 6월부터 이 페이지에서 영영 안 보였다** — 배열 리터럴이
 * string[] 으로 넓어져 tsc 가 못 잡는 구멍. `as ApplicationStatus[]` 로 막았고,
 * 이 spec 이 동작 레벨에서 다시 막는다.
 *
 * 정렬 계약(CEO 지시): ① 세션 있는 카드 먼저 ② 그 안에선 최신 세션순
 * ③ 세션 없는 그룹은 기존 순서 유지.
 */
const h = vi.hoisted(() => ({
  apps: [] as Array<{ id: string; company: string; status: string }>,
  sessionsByApp: {} as Record<string, Array<{ id: string; createdAt: string }>>,
}))

vi.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({ data: undefined, isLoading: false }),
  useApplications: () => ({
    data: h.apps.map((a) => ({
      id: a.id,
      company: a.company,
      companyName: a.company,
      jobTitle: null,
      jobCategory: null,
      status: a.status,
    })),
    isLoading: false,
  }),
}))

vi.mock('@/api/interviewPrep', () => ({
  interviewPrepApi: {
    list: vi.fn((appId: string) =>
      Promise.resolve(
        (h.sessionsByApp[appId] ?? []).map((s) => ({
          id: s.id,
          round: '1차',
          interviewType: null,
          applicationId: appId,
          createdAt: s.createdAt,
          jobDescription: null,
          emphasisPoints: null,
        })),
      ),
    ),
    remove: vi.fn(),
  },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), error: vi.fn() },
}))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => vi.fn(),
}))
vi.mock('@/components/card/NewInterviewSessionModal', () => ({
  NewInterviewSessionModal: () => null,
}))

import { Interviews } from './Interviews'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

/** 회사명들이 문서에 나타나는 순서 */
function orderOf(...names: string[]): string[] {
  const text = document.body.textContent ?? ''
  return [...names].sort((a, b) => text.indexOf(a) - text.indexOf(b))
}

describe('Interviews — 상태 필터', () => {
  beforeEach(() => {
    h.apps = []
    h.sessionsByApp = {}
  })

  it('🔴 PLANNED(지원 예정) 카드가 보인다 — CREATED 오타로 6월부터 숨어 있던 회귀', async () => {
    h.apps = [{ id: 'a1', company: '지원예정회사', status: 'PLANNED' }]
    render(<Interviews />, { wrapper })
    expect(await screen.findByText(/지원예정회사/)).toBeInTheDocument()
  })

  it('FAILED 는 안 보인다 — 불합격 기록은 카드 상세로 (자소서 페이지 탭과 같은 정책)', async () => {
    h.apps = [
      { id: 'a1', company: '진행중회사', status: 'IN_PROGRESS' },
      { id: 'a2', company: '불합격회사', status: 'FAILED' },
    ]
    render(<Interviews />, { wrapper })
    await screen.findByText(/진행중회사/)
    expect(screen.queryByText(/불합격회사/)).not.toBeInTheDocument()
  })
})

describe('Interviews — 세션 우선 정렬', () => {
  beforeEach(() => {
    h.apps = []
    h.sessionsByApp = {}
  })

  it('🔴 세션 있는 카드가 위로 온다 (원래 순서가 뒤여도)', async () => {
    h.apps = [
      { id: 'a1', company: '세션없음A', status: 'IN_PROGRESS' },
      { id: 'a2', company: '세션있음B', status: 'IN_PROGRESS' },
    ]
    h.sessionsByApp = { a2: [{ id: 's1', createdAt: '2026-08-01T00:00:00Z' }] }
    render(<Interviews />, { wrapper })
    await screen.findByText(/1차/) // 세션 로드 완료 대기
    expect(orderOf('세션없음A', '세션있음B')).toEqual(['세션있음B', '세션없음A'])
  })

  it('세션 그룹 안에선 최신 세션순 — 최근 준비하던 카드가 맨 위', async () => {
    h.apps = [
      { id: 'a1', company: '옛세션회사', status: 'IN_PROGRESS' },
      { id: 'a2', company: '최신세션회사', status: 'IN_PROGRESS' },
    ]
    h.sessionsByApp = {
      a1: [{ id: 's1', createdAt: '2026-07-01T00:00:00Z' }],
      a2: [{ id: 's2', createdAt: '2026-08-10T00:00:00Z' }],
    }
    render(<Interviews />, { wrapper })
    await screen.findAllByText(/1차/)
    expect(orderOf('옛세션회사', '최신세션회사')).toEqual(['최신세션회사', '옛세션회사'])
  })

  it('세션 없는 그룹은 기존 순서 유지 (안정 정렬)', async () => {
    h.apps = [
      { id: 'a1', company: '무세션1', status: 'PLANNED' },
      { id: 'a2', company: '무세션2', status: 'IN_PROGRESS' },
      { id: 'a3', company: '무세션3', status: 'PASSED' },
    ]
    render(<Interviews />, { wrapper })
    await screen.findByText(/무세션1/)
    expect(orderOf('무세션1', '무세션2', '무세션3')).toEqual([
      '무세션1',
      '무세션2',
      '무세션3',
    ])
  })
})
