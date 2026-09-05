/**
 * 내 정보 › **경험** 섹션 — 경력이 떨어져 나간 뒤의 반대편 (CEO 2026-09-06).
 *
 * 경력 spec(`MyInfo.careerSection.test.tsx`)이 「경력만 보인다」를 지킨다면, 여기는
 * **경력이 여기 남지 않는다**를 지킨다. 필터는 한 줄이고 방향이 반대라, 한쪽만 고치면
 * 같은 활동이 두 섹션에 겹쳐 뜨거나 어디에도 안 뜬다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 경력 유형(인턴·정규직)은 빠지고 동아리·프로젝트만 나온다 · 헤더는 「진행 중 N개」
 *  2. 🔴 「경험 추가」 모달의 유형 칩에 경력 5종이 없다 · 첫 칸은 「활동 정보 · 활동명」
 */
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Activity, ActivityType } from '@/types/activity'
import { ActivitySection } from './MyInfo'

const h = vi.hoisted(() => ({ activities: [] as Activity[] }))

vi.mock('@/hooks/useActivities', () => ({
  useActivities: () => ({ data: h.activities, isLoading: false }),
  useRemoveActivity: () => ({ mutate: vi.fn() }),
  useCreateActivity: () => ({ mutateAsync: vi.fn() }),
  useUpdateActivity: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false, useMediaQuery: () => false }))

function makeActivity(over: Partial<Activity> & { id: string; name: string; type: ActivityType }): Activity {
  return {
    userId: 'u-1',
    org: null,
    role: null,
    resultUrl: null,
    outcome: null,
    startedAt: null,
    endedAt: null,
    archivedAt: null,
    legacyExperienceId: null,
    summaryReflection: null,
    applicationSummary: null,
    country: null,
    orgDepartment: null,
    isCurrent: false,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

const CAREER_LABELS = ['인턴', '알바', '정규직', '계약직', '프리랜서']

const draw = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ActivitySection mode="experience" sectionRef={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  h.activities = []
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('경험 섹션 — 경력은 여기 남지 않는다', () => {
  it('1) 🔴 인턴·정규직은 빠지고 동아리·프로젝트만 나온다 · 헤더는 「진행 중 N개」', () => {
    h.activities = [
      makeActivity({ id: 'a1', name: '스타트업 백엔드 인턴', type: 'intern', endedAt: '2025-08-31' }),
      makeActivity({ id: 'a2', name: '△△커머스 백엔드 개발', type: 'fulltime', isCurrent: true }),
      makeActivity({ id: 'a3', name: '교내 개발 동아리 운영진', type: 'club', endedAt: '2024-12-31' }),
      makeActivity({ id: 'a4', name: '졸업 캡스톤 프로젝트', type: 'project' }),
    ]
    draw()
    expect(screen.getByText('교내 개발 동아리 운영진')).toBeInTheDocument()
    expect(screen.getByText('졸업 캡스톤 프로젝트')).toBeInTheDocument()
    expect(screen.queryByText('스타트업 백엔드 인턴')).toBeNull()
    expect(screen.queryByText('△△커머스 백엔드 개발')).toBeNull()
    // 종료일 없는 캡스톤만 진행 중 — 재직 중인 정규직은 세지 않는다
    expect(screen.getByText('진행 중 1개')).toBeInTheDocument()
    expect(screen.queryByText(/재직 중 \d개/)).toBeNull()
  })

  it('2) 🔴 「경험 추가」 모달의 유형 칩에 경력 5종이 없다', () => {
    h.activities = [makeActivity({ id: 'a3', name: '교내 개발 동아리 운영진', type: 'club' })]
    draw()
    fireEvent.click(screen.getByRole('button', { name: /경험 추가$/ }))

    expect(screen.getByRole('heading', { name: '경험 추가' })).toBeInTheDocument()
    // 첫 칸의 말도 경험 쪽 — 「경력명」이 새어 나오면 안 된다
    expect(screen.getByText('활동 정보')).toBeInTheDocument()
    // 필수 칸이라 접근 이름 뒤에 「필수 입력」이 붙는다 — 앞부분만 맞춘다
    expect(screen.getByLabelText(/^활동명/)).toHaveAttribute('placeholder', '예: 마케팅 학회')
    expect(screen.queryByLabelText(/^경력명/)).toBeNull()
    const groups = screen.getAllByRole('group')
    expect(groups.map((g) => g.getAttribute('aria-label'))).not.toContain('💼 경력')
    for (const label of CAREER_LABELS) {
      expect(screen.queryByRole('button', { name: new RegExp(`^\\S*\\s*${label}$`) }), label).toBeNull()
    }
    expect(within(groups[0]).getByRole('button', { name: /동아리$/ })).toBeInTheDocument()
  })
})
