import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OpsReach } from './OpsReach'
import {
  getAdminReach,
  type ReachData,
  type ReachRow,
  type ReachStage,
} from '@/api/adminReach'

/**
 * 🔴 이 화면은 **제품 판단의 근거**다. 숫자가 틀려도 화면은 멀쩡해 보이므로,
 * 오독을 부르는 표기를 회귀로 고정한다:
 *  ① 소표본에 % 금지 — "1명 중 1명 = 100%" 재발 방지
 *  ② 데스크탑 `null` 은 **"미확인"** — "모바일" 로 읽히면 안 된다
 *  ③ 샘플 카드는 실제 카드와 분리 표기
 */

vi.mock('@/api/adminReach', async (orig) => ({
  ...(await orig<typeof import('@/api/adminReach')>()),
  getAdminReach: vi.fn(),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

const getMock = vi.mocked(getAdminReach)

const row = (over: Partial<ReachRow> = {}): ReachRow => ({
  userId: 'u1',
  nickname: '테스트유저',
  signupDate: '2026-08-01',
  lastActiveAt: '2026-08-05T10:00:00Z',
  platform: { app: false, web: true },
  desktopSeenAt: null,
  cards: 0,
  sampleCards: 0,
  activityLogs: 0,
  coverletterQuestions: 0,
  coverletterAnswers: 0,
  aiAttempts: 0,
  aiSuccesses: 0,
  stage: 'signup',
  ...over,
})

const data = (over: Partial<ReachData> = {}): ReachData => ({
  rows: [row()],
  truncated: false,
  totalUsers: 1,
  excludedAdmins: 0,
  stageCounts: {
    signup: 1,
    card: 0,
    activity: 0,
    coverletter_question: 0,
    coverletter_answer: 0,
    coverletter_ai: 0,
  },
  desktopAxis: { confirmed: 0, coverletterAnswer: 0, coverletterAi: 0 },
  generatedAt: '2026-08-06T00:00:00Z',
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

describe('OpsReach', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('로딩 중에는 스켈레톤 — 빈 상태 문구가 먼저 뜨지 않는다', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    const { container } = wrap(<OpsReach />)

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText(/아직 가입한 회원이 없어요/)).not.toBeInTheDocument()
  })

  it('에러 → 전용 안내', async () => {
    getMock.mockRejectedValue(new Error('boom'))
    wrap(<OpsReach />)

    expect(await screen.findByText(/불러오지 못했어요/)).toBeInTheDocument()
  })

  it('사용자 0명 → 빈 상태 안내', async () => {
    getMock.mockResolvedValue(data({ rows: [], totalUsers: 0 }))
    wrap(<OpsReach />)

    expect(await screen.findByText(/아직 가입한 회원이 없어요/)).toBeInTheDocument()
  })

  it('정상 — 단계 라벨과 행이 렌더된다', async () => {
    getMock.mockResolvedValue(
      data({
        rows: [row({ cards: 2, stage: 'card' })],
        stageCounts: {
          signup: 1,
          card: 1,
          activity: 0,
          coverletter_question: 0,
          coverletter_answer: 0,
          coverletter_ai: 0,
        },
      }),
    )
    wrap(<OpsReach />)

    expect(await screen.findByText('테스트유저')).toBeInTheDocument()
    expect(screen.getAllByText('자소서 AI').length).toBeGreaterThan(0)
  })

  // 🔴 ①
  it('소표본에는 % 를 쓰지 않는다', async () => {
    getMock.mockResolvedValue(data())
    const { container } = wrap(<OpsReach />)

    await screen.findByText('테스트유저')
    expect(container.textContent).toContain('1명 중 1명')
    expect(container.textContent).not.toContain('100%')
  })

  // 🔴 ②
  it('데스크탑 미확인은 "미확인" 으로 적는다 (모바일이라는 뜻이 아님)', async () => {
    getMock.mockResolvedValue(data())
    const { container } = wrap(<OpsReach />)

    // 안내문(축 카드)과 표 셀 양쪽에 나온다 — 순서에 기대지 않고 title 을 가진 쪽을 찾는다
    const marks = await screen.findAllByText('미확인')
    expect(marks.length).toBeGreaterThanOrEqual(2)
    const cell = marks.find((el) => el.getAttribute('title'))
    expect(cell?.getAttribute('title')).toContain('모바일이라는 뜻이 아님')
    expect(container.textContent).toContain('모바일이라는 뜻이 아니다')
  })

  // 🔴 ③
  it('샘플 카드는 실제 카드와 분리해 보여준다', async () => {
    getMock.mockResolvedValue(data({ rows: [row({ cards: 1, sampleCards: 3, stage: 'card' })] }))
    const { container } = wrap(<OpsReach />)

    await screen.findByText('테스트유저')
    expect(container.textContent).toContain('+샘플 3')
  })

  it('AI 는 시도/성공을 나눠 보여준다', async () => {
    getMock.mockResolvedValue(
      data({ rows: [row({ aiAttempts: 3, aiSuccesses: 1, stage: 'coverletter_ai' })] }),
    )
    const { container } = wrap(<OpsReach />)

    await screen.findByText('테스트유저')
    const cell = container.querySelector('[title="시도 (차단·실패 포함)"]')
    expect(cell?.textContent).toBe('3')
  })

  it('데스크탑 확인자가 0이면 축 카드에 표본 부족을 알린다', async () => {
    getMock.mockResolvedValue(data())
    wrap(<OpsReach />)

    expect(await screen.findByText(/데스크탑 웹이 확인된 사용자가 없어요/)).toBeInTheDocument()
  })

  it('데스크탑 축은 확인된 사용자만 분모로 쓴다', async () => {
    getMock.mockResolvedValue(
      data({
        rows: [row({ desktopSeenAt: '2026-08-02T00:00:00Z', coverletterAnswers: 1 })],
        totalUsers: 10,
        desktopAxis: { confirmed: 2, coverletterAnswer: 1, coverletterAi: 0 },
        stageCounts: {
          signup: 10,
          card: 5,
          activity: 2,
          coverletter_question: 1,
          coverletter_answer: 1,
          coverletter_ai: 0,
        },
      }),
    )
    const { container } = wrap(<OpsReach />)

    await screen.findByText('테스트유저')
    // 분모 2 (데스크탑 확인) — 전체 10 이 아니다
    expect(container.textContent).toContain('2명 중 1명')
    expect(container.textContent).toContain('전체 기준 10명 중 1명')
  })

  it('200행 상한이 걸리면 안내한다', async () => {
    getMock.mockResolvedValue(data({ truncated: true, totalUsers: 250 }))
    const { container } = wrap(<OpsReach />)

    await screen.findByText('테스트유저')
    expect(container.textContent).toContain('전체 250명')
  })

  it('관리자 제외 인원을 헤더에 명시한다', async () => {
    getMock.mockResolvedValue(data({ excludedAdmins: 2 }))
    const { container } = wrap(<OpsReach />)

    await screen.findByText('테스트유저')
    expect(container.textContent).toContain('관리자 2명 제외')
  })

  // 표 뱃지와 퍼널 막대가 **같은 맵**에서 나온다 — 갈라지면 두 블록을 나란히 못 읽는다
  it('단계마다 막대 색이 다르고, 표 뱃지 색과 짝이 맞는다', async () => {
    getMock.mockResolvedValue(
      data({
        rows: [row({ stage: 'activity' })],
        stageCounts: {
          signup: 1,
          card: 1,
          activity: 1,
          coverletter_question: 1,
          coverletter_answer: 1,
          coverletter_ai: 1,
        },
      }),
    )
    const { container } = wrap(<OpsReach />)
    await screen.findByText('테스트유저')

    const bars = [...container.querySelectorAll('[style*="width"]')].map(
      (el) => [...el.classList].find((c) => c.startsWith('bg-')) ?? '',
    )
    // 6단계 = 서로 다른 색 6개 (같은 색이 섞이면 단계 구분이 안 된다)
    expect(bars).toHaveLength(6)
    expect(new Set(bars).size).toBe(6)

    // 활동일지 막대와 표의 활동일지 뱃지가 같은 계열
    expect(bars).toContain('bg-violet/60')
    // 퍼널 라벨과 표 뱃지가 둘 다 span 이라 tagName 으로는 못 가른다 — 뱃지 클래스로 찾는다
    const badge = screen
      .getAllByText('활동일지')
      .find((el) => el.className.includes('rounded-md'))
    expect(badge).toBeDefined()
    expect(badge?.className).toContain('violet')
  })

  // CWE-1321 — 서버가 예상 밖 단계를 주면 className 에 undefined 가 섞여 조용히 깨진다
  it('알 수 없는 단계값이 와도 클래스가 깨지지 않는다', async () => {
    getMock.mockResolvedValue(
      // 서버가 union 밖 값을 준 상황을 흉내낸다 (구버전·신버전 스큐)
      data({ rows: [row({ stage: 'constructor' as ReachStage })] }),
    )
    const { container } = wrap(<OpsReach />)

    await screen.findByText('테스트유저')
    expect(container.innerHTML).not.toContain('undefined')
  })

  // 🔴 admin 은 MobileNav 에 탭이 있어 **휴대폰에서도 열린다.** 10열을 다 살리면
  //    320px 에서 가로 스크롤이 화면 폭의 3배가 된다
  it('좁은 폭에서 접히는 열과 항상 남는 열이 구분된다', async () => {
    getMock.mockResolvedValue(data())
    const { container } = wrap(<OpsReach />)
    await screen.findByText('테스트유저')

    const headers = [...container.querySelectorAll('thead th')]
    const always = headers.filter((th) => !th.className.includes('hidden'))
    expect(always.map((th) => th.textContent)).toEqual(['가입일', '닉네임', '도달 단계'])

    // 헤더와 셀의 숨김 조건이 어긋나면 열이 밀린다 — 개수로 대조
    const cells = [...container.querySelectorAll('tbody tr:first-child td')]
    expect(cells).toHaveLength(headers.length)
    headers.forEach((th, i) => {
      const hidden = (cls: string) => (cls.match(/hidden \w+:table-cell/) ?? [''])[0]
      expect(hidden(cells[i].className)).toBe(hidden(th.className))
    })
  })

  it('행을 누르면 회원 상세로 이동한다', async () => {
    getMock.mockResolvedValue(data())
    wrap(<OpsReach />)

    fireEvent.click(await screen.findByText('테스트유저'))
    expect(navigate).toHaveBeenCalledWith('/ops/users/u1')
  })

  // 🔴 클릭 핸들러만 달면 **키보드로는 아예 못 쓰는 표**가 된다 (OpsUsers 와 같은 패턴)
  it('행은 키보드로도 열 수 있다 (role·tabIndex·Enter/Space·focus ring)', async () => {
    getMock.mockResolvedValue(data())
    wrap(<OpsReach />)
    await screen.findByText('테스트유저')

    const row = screen.getByRole('button', { name: '테스트유저 상세 보기' })
    expect(row).toHaveAttribute('tabIndex', '0')
    expect(row.className).toContain('focus:ring')

    fireEvent.keyDown(row, { key: 'Enter' })
    expect(navigate).toHaveBeenCalledWith('/ops/users/u1')

    fireEvent.keyDown(row, { key: ' ' })
    expect(navigate).toHaveBeenCalledTimes(2)
  })

  // 셀의 "3 / 1" 은 title 없이는 무슨 숫자인지 알 수 없다 — 헤더가 의미를 지고 있어야 한다
  it('자소서·AI 열은 헤더만으로 의미가 읽힌다', async () => {
    getMock.mockResolvedValue(data())
    wrap(<OpsReach />)
    await screen.findByText('테스트유저')

    expect(screen.getByText('자소서 문항/답변')).toBeInTheDocument()
    expect(screen.getByText('AI 시도/성공')).toBeInTheDocument()
  })

  // 이 화면 단독으로는 (a)/(b) 를 못 가른다 — 그 사실이 화면에서 사라지면 안 된다
  it('Clarity 가 여전히 필요하다는 안내를 남긴다', async () => {
    getMock.mockResolvedValue(data())
    const { container } = wrap(<OpsReach />)

    await screen.findByText('테스트유저')
    expect(container.textContent).toContain('Clarity')
    expect(container.textContent).toContain('Activation')
  })
})
