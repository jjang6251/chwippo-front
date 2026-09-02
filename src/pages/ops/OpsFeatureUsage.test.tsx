import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OpsFeatureUsage } from './OpsFeatureUsage'
import { UserFeatureUsageSection } from '@/components/admin/UserFeatureUsageSection'
import {
  getAdminFeatureUsage,
  type FeatureStat,
  type FeatureUsageData,
  type FeatureUsageUserRow,
} from '@/api/adminFeatureUsage'

/**
 * 🔴 이 화면은 **제품 판단의 근거**다. 숫자가 틀려도 화면은 멀쩡해 보이므로,
 * 오독을 부르는 표기를 회귀로 고정한다:
 *  ① `null`(잴 수 없음 · 아직 안 온 주)은 **0 이 아니라 「—」**
 *  ② 퍼센트를 쓰지 않는다 — 머릿수 그대로 (N 이 작아 % 가 노이즈를 신호로 만든다)
 *  ③ 읽는 규율 3한계가 화면에서 사라지지 않는다
 *  ④ 기능 목록을 프론트가 안 들고 있다 — 서버가 새 키를 줘도 그려진다
 */

vi.mock('@/api/adminFeatureUsage', async (orig) => ({
  ...(await orig<typeof import('@/api/adminFeatureUsage')>()),
  getAdminFeatureUsage: vi.fn(),
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { error: vi.fn(), show: vi.fn(), success: vi.fn() },
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

const getMock = vi.mocked(getAdminFeatureUsage)

const feature = (over: Partial<FeatureStat> = {}): FeatureStat => ({
  key: 'study_note',
  label: '공부 노트',
  usersEver: 1,
  usersMultiDay: 0,
  buckets: { one: 1, twoToFour: 0, fivePlus: 0 },
  depthMedian: 120,
  depthUnit: '자 (본문)',
  usersLast7d: 1,
  dateBasis: '노트 생성 시각 (study_notes.created_at)',
  ...over,
})

const userRow = (over: Partial<FeatureUsageUserRow> = {}): FeatureUsageUserRow => ({
  userId: 'u1',
  nickname: '테스트유저',
  joinedAt: '2026-08-05T00:00:00.000Z',
  perFeature: { study_note: { count: 3, lastUsedAt: '2026-08-20T01:00:00.000Z' } },
  ...over,
})

const data = (over: Partial<FeatureUsageData> = {}): FeatureUsageData => ({
  generatedAt: '2026-09-02T03:00:00.000Z',
  excludedAdmins: 1,
  totalUsers: 2,
  features: [feature()],
  users: [userRow()],
  retention: [
    { cohortWeek: '2026-08-03', size: 2, week1: 1, week2: 0, week3: null, week4: null },
  ],
  ...over,
})

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** jsdom 에는 `navigator.clipboard` 가 없다 — 환경을 채우고 호출만 관찰한다 */
function mockClipboard(impl: () => Promise<void>) {
  Object.assign(navigator, { clipboard: { writeText: impl } })
}

describe('OpsFeatureUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('로딩 중에는 스켈레톤 — 빈 상태 문구가 먼저 뜨지 않는다', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    const { container } = wrap(<OpsFeatureUsage />)

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText(/아직 가입한 회원이 없어요/)).not.toBeInTheDocument()
  })

  it('에러 → 전용 안내', async () => {
    getMock.mockRejectedValue(new Error('boom'))
    wrap(<OpsFeatureUsage />)

    expect(await screen.findByText(/불러오지 못했어요/)).toBeInTheDocument()
  })

  it('사용자 0명 → 빈 상태 안내', async () => {
    getMock.mockResolvedValue(data({ totalUsers: 0, users: [], retention: [] }))
    wrap(<OpsFeatureUsage />)

    expect(await screen.findByText(/아직 가입한 회원이 없어요/)).toBeInTheDocument()
  })

  it('정상 — 기능 통계·매트릭스·잔존이 모두 렌더된다', async () => {
    getMock.mockResolvedValue(data())
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    expect(screen.getByText('가입 주차별 잔존')).toBeInTheDocument()
    expect(screen.getByText('기능별 사용 인원')).toBeInTheDocument()
    expect(screen.getByText('유저 × 기능')).toBeInTheDocument()
    // 기능 라벨은 통계 표와 매트릭스 헤더 양쪽에 나온다
    expect(screen.getAllByText('공부 노트').length).toBeGreaterThanOrEqual(2)
    expect(container.textContent).toContain('2026-08-03')
  })

  // 🔴 ①
  it('잴 수 없는 값·아직 안 온 주는 0 이 아니라 「—」로 적는다', async () => {
    getMock.mockResolvedValue(
      data({
        features: [
          feature({
            key: 'myinfo',
            label: '내정보 8종',
            usersMultiDay: null,
            usersLast7d: null,
            dateBasis: '🔴 없음 — 생성 시각 컬럼이 없다',
          }),
        ],
      }),
    )
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    const dashes = [...container.querySelectorAll('[title]')].filter(
      (el) => el.textContent === '—',
    )
    // 기능 표 2칸(2일 이상·최근 7일) + 잔존 표 2칸(3주·4주)
    expect(dashes.length).toBeGreaterThanOrEqual(4)
    expect(
      dashes.some((el) => (el.getAttribute('title') ?? '').includes('아직 오지 않은 주')),
    ).toBe(true)
    expect(
      dashes.some((el) => (el.getAttribute('title') ?? '').includes('잴 수 없음')),
    ).toBe(true)
  })

  // 🔴 ②
  it('퍼센트를 쓰지 않는다 — 머릿수 그대로', async () => {
    getMock.mockResolvedValue(data({ totalUsers: 50 }))
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    expect(container.textContent).not.toContain('%')
    expect(container.textContent).toContain('총 50명')
  })

  it('깊이는 단위와 함께 적는다 (기능마다 단위가 다르다)', async () => {
    getMock.mockResolvedValue(data())
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    expect(container.textContent).toContain('자 (본문)')
    expect(container.textContent).toContain('세로로 비교하면 안 된다')
  })

  it('안 쓴 사람 수를 같이 보여준다 (0회는 버킷에 없다)', async () => {
    getMock.mockResolvedValue(
      data({ totalUsers: 10, features: [feature({ usersEver: 3 })] }),
    )
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    const cells = [...container.querySelectorAll('tbody tr td')].map(
      (td) => td.textContent ?? '',
    )
    expect(cells).toContain('3명')
    expect(cells).toContain('7명')
  })

  // 🔴 ③
  it('읽는 규율 3한계가 화면에 남는다', async () => {
    getMock.mockResolvedValue(data())
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    expect(container.textContent).toContain('Clarity')
    expect(container.textContent).toContain('노이즈')
    expect(container.textContent).toContain('읽기만 하는 사용은 안 잡힌다')
    expect(container.textContent).toContain('관리자 1명의 데이터는')
  })

  // 🔴 ④
  it('서버가 모르는 기능 키를 줘도 라벨 그대로 그린다', async () => {
    getMock.mockResolvedValue(
      data({
        features: [feature({ key: 'brand_new_feature', label: '새로 생긴 기능' })],
        users: [
          userRow({ perFeature: { brand_new_feature: { count: 7, lastUsedAt: null } } }),
        ],
      }),
    )
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    expect(screen.getAllByText('새로 생긴 기능').length).toBeGreaterThanOrEqual(2)
    expect(container.innerHTML).not.toContain('undefined')
  })

  it('안 쓴 기능 칸은 숫자가 아니라 흐린 점이다', async () => {
    getMock.mockResolvedValue(data({ users: [userRow({ perFeature: {} })] }))
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    const cell = container.querySelector('[title="공부 노트 0회"]')
    expect(cell?.textContent).toBe('·')
  })

  // 🔴 admin 은 휴대폰에서도 열린다 — 18열 매트릭스는 반드시 자기 컨테이너 안에서 스크롤
  it('매트릭스는 자기 컨테이너 안에서 가로 스크롤한다 (뒤 페이지로 chaining 금지)', async () => {
    getMock.mockResolvedValue(data())
    const { container } = wrap(<OpsFeatureUsage />)

    await screen.findByText('테스트유저')
    const scrollers = [...container.querySelectorAll('.overflow-x-auto')]
    expect(scrollers.length).toBeGreaterThanOrEqual(3)
    expect(
      scrollers.every((el) => el.className.includes('overscroll-x-contain')),
    ).toBe(true)
  })

  it('행을 누르면 회원 상세로 이동한다 · 키보드로도 열린다', async () => {
    getMock.mockResolvedValue(data())
    wrap(<OpsFeatureUsage />)
    await screen.findByText('테스트유저')

    const row = screen.getByRole('button', { name: '테스트유저 상세 보기' })
    expect(row).toHaveAttribute('tabIndex', '0')

    fireEvent.click(row)
    expect(navigate).toHaveBeenCalledWith('/ops/users/u1')

    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })
    expect(navigate).toHaveBeenCalledTimes(3)
  })

  describe('JSON 복사', () => {
    it('성공하면 「복사됨」으로 바뀌고 원본 JSON 을 넘긴다', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      mockClipboard(writeText)
      const payload = data()
      getMock.mockResolvedValue(payload)
      wrap(<OpsFeatureUsage />)

      fireEvent.click(await screen.findByText('JSON 복사'))

      await screen.findByText('복사됨')
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(payload, null, 2))
    })

    /**
     * 🔴 여기서 복사하는 JSON 은 **화면에 다 나오지 않는 값**이다 —
     * 토스트로 끝내면 받을 방법이 사라진다. 원문을 펼쳐 직접 선택하게 한다.
     */
    it('실패하면 원문을 펼쳐 직접 선택하게 한다', async () => {
      mockClipboard(() => Promise.reject(new Error('denied')))
      getMock.mockResolvedValue(data())
      const { container } = wrap(<OpsFeatureUsage />)

      fireEvent.click(await screen.findByText('JSON 복사'))

      await waitFor(() => {
        expect(container.querySelector('pre')).not.toBeNull()
      })
      const pre = container.querySelector('pre')
      expect(pre?.className).toContain('select-all')
      expect(pre?.textContent).toContain('"generatedAt"')
    })
  })
})

describe('UserFeatureUsageSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('해당 유저 행의 기능만, 많이 쓴 순으로 보여준다', async () => {
    getMock.mockResolvedValue(
      data({
        features: [
          feature({ key: 'study_note', label: '공부 노트' }),
          feature({ key: 'daily_note', label: '오늘 할 일' }),
          feature({ key: 'activity', label: '활동' }),
        ],
        users: [
          userRow({
            perFeature: {
              study_note: { count: 2, lastUsedAt: null },
              daily_note: { count: 9, lastUsedAt: null },
            },
          }),
        ],
      }),
    )
    const { container } = wrap(<UserFeatureUsageSection userId="u1" />)

    await screen.findByText('오늘 할 일')
    const labels = [...container.querySelectorAll('li > span:first-child')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['오늘 할 일', '공부 노트'])
    // 안 쓴 기능은 칸을 만들지 않는다
    expect(screen.queryByText('활동')).not.toBeInTheDocument()
  })

  it('집계에 없는 유저(관리자)는 0 이 아니라 이유를 적는다', async () => {
    getMock.mockResolvedValue(data())
    wrap(<UserFeatureUsageSection userId="admin-1" />)

    expect(await screen.findByText(/집계 대상이 아니에요/)).toBeInTheDocument()
  })

  it('쓴 기능이 없으면 읽기 전용 사용이 안 잡힌다는 것을 알린다', async () => {
    getMock.mockResolvedValue(data({ users: [userRow({ perFeature: {} })] }))
    wrap(<UserFeatureUsageSection userId="u1" />)

    expect(await screen.findByText(/읽기만 하는 사용/)).toBeInTheDocument()
  })
})
