/**
 * 내 정보 › **경력** 섹션 — 「경험이랑 경력은 분류해야지」 (CEO 2026-09-06).
 *
 * 🔴 이 spec 이 지키는 것: **저장소는 `activities` 하나**인데 화면은 둘이라는 것.
 *    갈림길은 `type` 하나뿐이라, 필터가 한 글자만 어긋나도 방금 추가한 경력이 경험 쪽에서
 *    사라진다 — 그 경계를 여기서 못 박는다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 경력 유형만 나열된다 (인턴·정규직 O · 동아리 X) · 헤더는 「재직 중 N개」
 *  2. 행 문구 — 「회사 · 부서 · 직위 · 기간」, 재직 중이면 「~ 재직 중」
 *  3. 빈 상태 CTA — 「첫 경력 추가하기」 + 경력 예시
 *  4. 🔴 「경력 추가」 모달의 유형 칩은 경력 5개뿐 (동아리로 새지 않는다)
 *  5. 편집 클릭 → **경력 모드** 모달 (제목 「경력 편집」 · 첫 칸 「경력 정보 · 경력명」 · 값 복원)
 *  6. 🔴 딥링크 `#career` — 섹션 id 가 살아 있고, 옛 접힘 목록에 없는 새 id 라 펼쳐진 채로 도착한다
 */
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Activity, ActivityType } from '@/types/activity'
import { ActivitySection, MyInfo } from './MyInfo'

const h = vi.hoisted(() => ({
  activities: [] as Activity[],
  emptyQuery: <T,>(data: T) => () => ({ data, isLoading: false, isError: false }),
}))

vi.mock('@/hooks/useActivities', () => ({
  useActivities: () => ({ data: h.activities, isLoading: false }),
  useRemoveActivity: () => ({ mutate: vi.fn() }),
  useCreateActivity: () => ({ mutateAsync: vi.fn() }),
  useUpdateActivity: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/useMyinfo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMyinfo')>()),
  useProfile: h.emptyQuery(undefined),
  useEducations: h.emptyQuery([]),
  useLangCerts: h.emptyQuery([]),
  useCerts: h.emptyQuery([]),
  useAwards: h.emptyQuery([]),
  useCoverletter: h.emptyQuery(undefined),
  useDocuments: h.emptyQuery([]),
  useFieldDictionary: () => ({ data: undefined, isError: true }),
}))
vi.mock('@/hooks/useExamSchedules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useExamSchedules')>()),
  useExamSchedules: h.emptyQuery([]),
}))
vi.mock('@/hooks/useStorageUsage', () => ({
  useStorageUsage: () => ({ data: undefined, isLoading: false }),
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

const INTERN = makeActivity({
  id: 'a-intern', name: '스타트업 백엔드 인턴', type: 'intern',
  org: '□□랩스', role: '백엔드', startedAt: '2025-07-01', endedAt: '2025-08-31',
})
const FULLTIME = makeActivity({
  id: 'a-fulltime', name: '△△커머스 백엔드 개발', type: 'fulltime',
  org: '△△커머스', orgDepartment: '결제플랫폼팀', role: '사원',
  startedAt: '2025-09-01', endedAt: null, isCurrent: true,
})
const CLUB = makeActivity({
  id: 'a-club', name: '교내 개발 동아리 운영진', type: 'club', org: '△△대학교', role: '운영진',
})

function wrap(ui: React.ReactNode, initialEntries = ['/myinfo']) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const drawCareer = () => wrap(<ActivitySection mode="career" sectionRef={() => {}} />)
/** 유형 칩 그룹만 — 바깥 「유형」 그룹 안의 묶음들 (「재직 중」 토글은 그 바깥이라 빠진다) */
const typeGroups = () =>
  within(screen.getByRole('group', { name: /^유형/ })).getAllByRole('group')

beforeEach(() => {
  h.activities = []
  localStorage.clear()
  // jsdom 에는 스크롤이 없다 — 칩 바 자동 정렬·딥링크가 마운트 직후 부른다
  Element.prototype.scrollIntoView = vi.fn()
  window.scrollTo = vi.fn()
})
afterEach(cleanup)

describe('경력 섹션 — 활동에서 경력 유형만', () => {
  it('1) 🔴 인턴·정규직은 나오고 동아리는 안 나온다 · 헤더는 「재직 중 N개」', () => {
    h.activities = [INTERN, FULLTIME, CLUB]
    drawCareer()
    expect(screen.getByText('스타트업 백엔드 인턴')).toBeInTheDocument()
    expect(screen.getByText('△△커머스 백엔드 개발')).toBeInTheDocument()
    expect(screen.queryByText('교내 개발 동아리 운영진')).toBeNull()
    // 인턴은 2025-08 에 끝났고 정규직은 재직 중 — 진행 중인 건 하나다
    expect(screen.getByText('재직 중 1개')).toBeInTheDocument()
    expect(screen.queryByText(/진행 중/)).toBeNull()
  })

  it('2) 행 문구 — 회사 · 부서 · 직위 · 기간 (재직 중이면 「~ 재직 중」)', () => {
    h.activities = [FULLTIME, INTERN]
    drawCareer()
    expect(screen.getByText('△△커머스 · 결제플랫폼팀 · 사원 · 2025.09 ~ 재직 중')).toBeInTheDocument()
    expect(screen.getByText('□□랩스 · 백엔드 · 2025.07 ~ 2025.08')).toBeInTheDocument()
  })

  it('3) 빈 상태 — 「첫 경력 추가하기」 + 경력 예시', () => {
    drawCareer()
    expect(screen.getByRole('button', { name: /첫 경력 추가하기/ })).toBeInTheDocument()
    expect(screen.getByText('예: ○○커머스 · 사원 · 2025.09 ~ 재직 중')).toBeInTheDocument()
    // 경험 쪽 문구가 새어 나오면 안 된다
    expect(screen.queryByText(/첫 경험 추가하기/)).toBeNull()
  })

  it('4) 🔴 「경력 추가」 모달의 유형 칩은 경력 5개뿐', () => {
    h.activities = [FULLTIME]
    drawCareer()
    fireEvent.click(screen.getByRole('button', { name: /경력 추가$/ }))

    expect(screen.getByRole('heading', { name: '경력 추가' })).toBeInTheDocument()
    // 필수 칸이라 접근 이름 뒤에 「필수 입력」이 붙는다 — 앞부분만 맞춘다
    expect(screen.getByLabelText(/^경력명/)).toHaveAttribute('placeholder', '예: 화장품 브랜드 마케팅 인턴')
    const groups = typeGroups()
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['💼 경력'])
    expect(within(groups[0]).getAllByRole('button')).toHaveLength(5)
    for (const label of ['인턴', '알바', '정규직', '계약직', '프리랜서']) {
      expect(within(groups[0]).getByRole('button', { name: new RegExp(`${label}$`) }), label).toBeInTheDocument()
    }
    for (const label of ['동아리', '스터디', '봉사', '기타']) {
      expect(screen.queryByRole('button', { name: new RegExp(`^\\S*\\s*${label}$`) }), label).toBeNull()
    }
  })

  it('5) 편집 클릭 → 경력 모드 모달 (제목 「경력 편집」 · 값 복원)', () => {
    h.activities = [FULLTIME]
    drawCareer()
    fireEvent.click(screen.getByRole('button', { name: '편집' }))

    expect(screen.getByRole('heading', { name: '경력 편집' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('△△커머스 백엔드 개발')).toBeInTheDocument()
    expect(screen.getByLabelText('부서')).toHaveValue('결제플랫폼팀')
    // 경력 모드라 첫 칸이 「경력 정보 · 경력명」이고 라벨이 회사·직위이며, 경험 유형 칩은 없다
    expect(screen.getByText('경력 정보')).toBeInTheDocument()
    expect(screen.getByLabelText(/^경력명/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^활동명/)).toBeNull()
    expect(screen.getByLabelText('회사')).toBeInTheDocument()
    expect(screen.getByLabelText('직위·직급')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^\S*\s*동아리$/ })).toBeNull()
  })
})

describe('딥링크 · 접힘 상태', () => {
  it('6) 🔴 `#career` — 섹션이 살아 있고, 옛 접힘 목록에 없는 새 id 라 펼쳐져 있다', () => {
    // 업데이트 전 사용자의 저장값 — 12개 섹션이 전부 접혀 있었다 (career 는 없던 id)
    localStorage.setItem('myinfo:collapsed:v2', JSON.stringify([
      'profile', 'education', 'military', 'extras', 'experiences',
      'language-certs', 'certs', 'awards', 'files',
      'coverletter', 'goals', 'exam-schedules',
    ]))
    const { container } = wrap(<MyInfo />, ['/myinfo#career'])

    expect(container.querySelector('section#career')).not.toBeNull()
    // 헤더만 있는 게 아니라 본문이 열려 있다 (접힌 섹션은 body 를 그리지 않는다)
    expect(container.querySelector('#career-body')).not.toBeNull()
    expect(screen.getByRole('button', { name: /첫 경력 추가하기/ })).toBeInTheDocument()
    // 옛 id 들은 저장된 대로 접힌 채다
    expect(container.querySelector('#experiences-body')).toBeNull()
  })
})
