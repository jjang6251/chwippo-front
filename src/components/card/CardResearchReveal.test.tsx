/**
 * 카드 추가 직후 회사 조사 — 스트립 렌더 시나리오.
 *
 * 1. 정상: 3요소(키워드 칩·인재상 인라인·요약 전문) · 칩 5개 상한 · 요약은 잘리지 않는다
 * 2. 스트립 껍데기: 어느 회사인지 표시 · 닫기 · **카드처럼 보이지 않는다**(채움·사방 테두리 없음)
 * 3. 필드 일부만: 키워드 0 / 인재상 0 / 요약 없음 → 있는 것만 (빈 라벨·빈 줄 없음)
 * 4. 전부 빈 조사 → 렌더 0 (껍데기만 남는 스트립 금지)
 * 5. 부재 4종 — null(미조사·만료) · opt_out · blocked · API 실패 → **전부 렌더 0, 토스트 0**
 * 6. 조회수 미집계 — `countHit:false` 로 호출
 * 7. 세션성 — 스토어 초기값은 항상 null (새로고침하면 사라진다)
 * 8. 데모 무영향 — DEMO_COMPANY_RESEARCH(null) 이면 렌더 0
 * 9. 🔴 이동 — 스트립은 카드 상세 「회사 알아보기」 탭으로 가는 링크다. **닫기(×)는 이동하지 않는다**
 *
 * 보드 진입 1회 노출(`intro`):
 * 17. 🔴 **이 경우에만 한 줄 안내** — 3주 전 카드에 갑자기 뜨면 "이게 왜 지금?" 이 된다.
 *     카드 추가로 뜬 경우엔 없다 (방금 한 일이 답이라 군더더기)
 * 18. 🔴 **소진은 렌더될 때만** — 조사가 없어 안 떴으면 기회가 그대로 남는다.
 *     카드 추가·축하 오버레이로 뜬 것도 같은 기회를 쓴다
 * 19. 계측 이름이 경로별로 갈린다 (shown·click 둘 다)
 *
 * 계측 (`trackClarityEvent` 실제 구현 + `window.clarity` 스파이):
 * 10. 스트립이 **실제로 떴을 때** `research_reveal_shown_strip` — 조사 커버리지를 재는 유일한 창
 * 11. 축하 오버레이 변형은 `research_reveal_shown_celebration` (자리를 갈라 봐야 한다)
 * 12. 🔴 리렌더에 중복 발사 없음 · 조사가 없으면(렌더 0) 이벤트도 0
 * 13. 스트립 클릭 → `research_reveal_click_strip`
 * 14. 🔴 데모에서는 0회 (JobSiteChips 선례 — 실사용자 판정 오염 금지)
 * 15. 출처 표식은 router state — 🔴 URL 쿼리가 아니다 (공유된 주소가 스트립 성과로 잡히면 안 된다)
 * 16. 🔴 계측이 던져도 스트립이 살아 있고 이동도 정상 (방어는 `lib/clarity` 의 try/catch)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoModeContextProvider } from '@/contexts/demoMode'
import { useAuthStore } from '@/stores/authStore'
import { CardResearchReveal } from './CardResearchReveal'
import { coverletterDocApi } from '@/api/coverletterDoc'
import { DEMO_COMPANY_RESEARCH } from '@/demo/sampleData'
import type { CompanyResearchResult } from '@/types/interviewPrep'

vi.mock('@/api/coverletterDoc', () => ({
  coverletterDocApi: { getResearch: vi.fn() },
}))

const toastError = vi.fn()
vi.mock('@/stores/toastStore', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a) },
}))

const mockedGet = vi.mocked(coverletterDocApi.getResearch)

const KEYWORDS = [
  { keyword: '분산 시스템', category: 'tech' as const },
  { keyword: '수평 확장', category: 'tech' as const },
  { keyword: '도전적 문화', category: 'talent' as const },
  { keyword: '광고 수익', category: 'business' as const },
  { keyword: '백엔드 직무', category: 'role' as const },
  { keyword: '규제 이슈', category: 'issue' as const },
  { keyword: '일곱번째', category: 'tech' as const },
  { keyword: '여덟번째', category: 'tech' as const },
]

const OK: CompanyResearchResult = {
  status: 'ok',
  research: {
    businessSummary: '국내 최대 메신저를 운영하는 플랫폼 기업이다. 최근에는 광고와 커머스로 수익원을 넓히고 있다.',
    interviewKeywords: KEYWORDS,
    talentProfile: ['도전', '협업', '성장'],
    recentTrends: '아주 긴 최근 동향 300자',
    financials: '매출 8조',
    competitors: '네이버',
  },
}

const onDismiss = vi.fn()

function renderStrip(applicationId = 'app-1', intro = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <CardResearchReveal
          applicationId={applicationId}
          company={{ name: '카카오', domain: 'kakaocorp.com' }}
          intro={intro}
          onDismiss={onDismiss}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

/** 칩 = rounded-full 배지. 인재상·요약이 칩으로 새어나오는지 함께 감시한다 */
const chips = (c: HTMLElement) => Array.from(c.querySelectorAll('span.rounded-full'))

beforeEach(() => {
  vi.clearAllMocks()
  mockedGet.mockResolvedValue(OK)
})

describe('CardResearchReveal — 정상', () => {
  it('1) 3요소 렌더 · 칩 5개 상한 · 인재상은 칩이 아닌 인라인 · 요약은 전문 그대로', async () => {
    const { container } = renderStrip()

    expect(await screen.findByText('어떤 회사일까요?')).toBeInTheDocument()

    // 칩 상한 — 원본 8개 중 앞 5개만
    await waitFor(() => expect(chips(container)).toHaveLength(5))
    expect(screen.getByText('분산 시스템')).toBeInTheDocument()
    expect(screen.getByText('백엔드 직무')).toBeInTheDocument()
    expect(screen.queryByText('규제 이슈')).toBeNull()
    expect(screen.queryByText('여덟번째')).toBeNull()

    // 인재상 — 가운뎃점 인라인 텍스트 1개 (칩 3개가 아니다)
    const talents = screen.getByText('도전 · 협업 · 성장')
    expect(talents.tagName).toBe('P')
    expect(talents.className).not.toContain('rounded-full')

    /* 🔴 요약은 **잘리지 않는다** — 2026-08-22 CEO 실기("글이 길면 잘리네")로 첫 문장 자르기를
       걷어냈다. 잘린 소개는 마지막 어절이 사라져 무슨 회사인지가 오히려 흐려진다.
       위계는 색·크기로만 낮춘다(`text-text-quaternary`) — 줄 수가 늘어도 주인공은 칩이다. */
    const summary = screen.getByText(
      '국내 최대 메신저를 운영하는 플랫폼 기업이다. 최근에는 광고와 커머스로 수익원을 넓히고 있다.',
    )
    expect(summary.className).not.toMatch(/line-clamp|truncate/)
    expect(summary.className).toContain('text-text-quaternary')

    // 🔴 첫 화면에 넣지 않기로 한 항목들이 새어나오지 않는다
    expect(screen.queryByText(/최근 동향/)).toBeNull()
    expect(screen.queryByText(/매출 8조/)).toBeNull()
    expect(screen.queryByText('네이버')).toBeNull()
  })

  it('1-b) 키워드 카테고리 색은 기존 조사 카드와 같은 토큰을 쓴다', async () => {
    const { container } = renderStrip()
    await screen.findByText('분산 시스템')
    const tech = chips(container).find((el) => el.textContent === '분산 시스템')!
    const talent = chips(container).find((el) => el.textContent === '도전적 문화')!
    expect(tech.className).toContain('text-info')
    expect(talent.className).toContain('text-success')
  })
})

describe('CardResearchReveal — 스트립 껍데기', () => {
  it('2-a) 어느 회사 얘기인지 보인다 (카드 헤더와 같은 표기)', async () => {
    renderStrip()
    expect(await screen.findByText('카카오')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '카카오 회사 조사' })).toBeInTheDocument()
  })

  it('2-b) 닫기 버튼이 있고 누르면 호출된다', async () => {
    renderStrip()
    const close = await screen.findByRole('button', { name: '회사 조사 닫기' })
    fireEvent.click(close)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('2-d) 🔴 스트립 본문은 카드 상세 「회사 알아보기」 탭으로 가는 링크다', async () => {
    renderStrip('app-42')
    const link = await screen.findByRole('link', { name: '카카오 회사 정보 자세히 보기' })
    expect(link).toHaveAttribute('href', '/board/app-42?tab=company')
    // 3요소가 전부 링크 안에 있다 — 어디를 눌러도 같은 곳으로 간다
    expect(link).toHaveTextContent('분산 시스템')
    expect(link).toHaveTextContent('도전 · 협업 · 성장')
    expect(link).toHaveTextContent('자세히 →')
  })

  it('2-e) 🔴 닫기(×)는 링크 밖에 있다 — 치우려다 이동하면 안 된다', async () => {
    renderStrip()
    const close = await screen.findByRole('button', { name: '회사 조사 닫기' })
    const link = screen.getByRole('link', { name: /자세히 보기/ })
    expect(link.contains(close)).toBe(false)
    // 닫기를 눌러도 이동 신호(anchor 클릭)가 아니다
    fireEvent.click(close)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('2-c) 🔴 카드처럼 보이지 않는다 — 채움·사방 테두리·라운드 없이 좌측 스트라이프만', async () => {
    renderStrip()
    const strip = await screen.findByRole('region', { name: '카카오 회사 조사' })
    expect(strip.className).toContain('border-l-2')
    expect(strip.className).not.toContain('bg-surface-2')
    expect(strip.className).not.toContain('rounded-xl')
    // 카드가 쓰는 사방 테두리(border border-line)가 없다
    expect(strip.className).not.toMatch(/(^|\s)border\s/)
  })
})

describe('CardResearchReveal — 경계값', () => {
  it('3-a) 키워드 0개 → 라벨·칩 없이 나머지만', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { talentProfile: ['도전'], businessSummary: '요약이다.' },
    })
    const { container } = renderStrip()
    expect(await screen.findByText('도전')).toBeInTheDocument()
    expect(screen.queryByText('어떤 회사일까요?')).toBeNull()
    expect(chips(container)).toHaveLength(0)
    // 회사 표기는 남는다 — 어느 회사 얘기인지가 사라지면 안 된다
    expect(screen.getByText('카카오')).toBeInTheDocument()
  })

  it('3-b) 인재상 0개·요약 없음 → 키워드만', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { interviewKeywords: ['레거시 문자열 키워드'] },
    })
    renderStrip()
    expect(await screen.findByText('레거시 문자열 키워드')).toBeInTheDocument()
    expect(screen.getByText('어떤 회사일까요?')).toBeInTheDocument()
  })

  it('3-c) 요약이 한 문장(마침표 없음)이어도 그대로 나온다', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { businessSummary: '마침표 없는 한 줄 요약' },
    })
    renderStrip()
    expect(await screen.findByText('마침표 없는 한 줄 요약')).toBeInTheDocument()
  })

  it('4) 3요소가 전부 비면 렌더 0 (빈 스트립 금지)', async () => {
    mockedGet.mockResolvedValue({ status: 'ok', research: {} })
    const { container } = renderStrip()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})

describe('CardResearchReveal — 조사 부재 4종은 전부 같은 처리(렌더 0 · 토스트 0)', () => {
  const cases: Array<[string, CompanyResearchResult | null | Error]> = [
    ['null (미조사·만료)', null],
    ['opt_out', { status: 'opt_out' }],
    ['blocked', { status: 'blocked' }],
    ['API 실패', new Error('500')],
  ]

  it.each(cases)('5) %s → 아무것도 렌더하지 않는다', async (_label, value) => {
    if (value instanceof Error) mockedGet.mockRejectedValue(value)
    else mockedGet.mockResolvedValue(value)

    const { container } = renderStrip()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(toastError).not.toHaveBeenCalled()
  })

  it('8) 데모(DEMO_COMPANY_RESEARCH = null)도 같은 처리', async () => {
    mockedGet.mockResolvedValue(DEMO_COMPANY_RESEARCH)
    const { container } = renderStrip()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})

describe('CardResearchReveal — 조회수·세션성', () => {
  it('6) 조회수 미집계 — countHit:false 로 호출한다', async () => {
    renderStrip()
    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith('app-1', { countHit: false }),
    )
  })

  it('7) 새로고침하면 사라진다 — 스토어 초기값은 null (persist 없음)', async () => {
    vi.resetModules()
    const fresh = await import('@/stores/researchRevealStore')
    expect(fresh.useResearchRevealStore.getState().appId).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 계측 — `trackClarityEvent` 를 mock 하지 않고 **실제 구현**을 태운다.
// 광고 차단 방어(try/catch)가 그 안에 있어서, mock 으로 갈아끼우면 정작 검증하려는
// 방어가 사라진 채로 통과한다. 대신 `window.clarity` 를 스파이로 세운다.
// ─────────────────────────────────────────────────────────────────────────

/** 실제로 나간 이벤트 이름들 */
function firedEvents(): string[] {
  const spy = (window as unknown as { clarity?: { mock?: { calls: unknown[][] } } }).clarity
  return (spy?.mock?.calls ?? []).filter((c) => c[0] === 'event').map((c) => String(c[1]))
}

function renderTracked(
  opts: { variant?: 'strip' | 'celebration'; demo?: boolean; intro?: boolean } = {},
) {
  const { variant = 'strip', demo = false, intro = false } = opts
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <DemoModeContextProvider value={demo}>
        <QueryClientProvider client={qc}>
          <CardResearchReveal
            applicationId="app-1"
            variant={variant}
            intro={intro}
            company={{ name: '카카오', domain: 'kakaocorp.com' }}
            onDismiss={onDismiss}
          />
        </QueryClientProvider>
      </DemoModeContextProvider>
    </MemoryRouter>,
  )
}

describe('CardResearchReveal — 계측', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'test-clarity')
    ;(window as unknown as { clarity?: unknown }).clarity = vi.fn()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as unknown as { clarity?: unknown }).clarity
  })

  it('10·12) 스트립이 실제로 뜨면 shown 1회 — 리렌더에 중복 없음', async () => {
    const { rerender } = renderTracked()
    await screen.findByText('분산 시스템')
    await waitFor(() => expect(firedEvents()).toEqual(['research_reveal_shown_strip']))

    // 부모 리렌더를 여러 번 태워도 한 번 그대로 (수치의 분모가 부풀면 안 된다)
    for (let i = 0; i < 3; i++) {
      rerender(
        <MemoryRouter>
          <DemoModeContextProvider value={false}>
            <QueryClientProvider client={new QueryClient()}>
              <CardResearchReveal applicationId="app-1" company={{ name: '카카오' }} />
            </QueryClientProvider>
          </DemoModeContextProvider>
        </MemoryRouter>,
      )
    }
    expect(firedEvents()).toEqual(['research_reveal_shown_strip'])
  })

  it('11) 축하 오버레이 변형은 자리 이름이 다르다', async () => {
    renderTracked({ variant: 'celebration' })
    await screen.findByText('분산 시스템')
    await waitFor(() => expect(firedEvents()).toEqual(['research_reveal_shown_celebration']))
  })

  it('12-b) 조사가 없으면(렌더 0) 이벤트도 0 — 커버리지 분자가 오염되지 않는다', async () => {
    mockedGet.mockResolvedValue(null)
    const { container } = renderTracked()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(firedEvents()).toEqual([])
  })

  it('13) 스트립 클릭 → click 1회 (shown 과 구분된다)', async () => {
    renderTracked()
    fireEvent.click(await screen.findByRole('link', { name: /자세히 보기/ }))
    await waitFor(() =>
      expect(firedEvents()).toEqual([
        'research_reveal_shown_strip',
        'research_reveal_click_strip',
      ]),
    )
    // 🔴 닫기는 클릭 성과가 아니다
    fireEvent.click(screen.getByRole('button', { name: '회사 조사 닫기' }))
    expect(firedEvents().filter((e) => e.includes('click'))).toHaveLength(1)
  })

  it('14) 🔴 데모에서는 0회 — 렌더는 되지만 계측은 안 나간다', async () => {
    renderTracked({ demo: true })
    fireEvent.click(await screen.findByRole('link', { name: /자세히 보기/ }))
    expect(firedEvents()).toEqual([])
  })

  it('15) 🔴 출처 표식은 router state — URL 쿼리에 붙이지 않는다', async () => {
    /** 도착지에서 무엇이 실려 왔는지 그대로 보여준다 */
    function Probe() {
      const loc = useLocation()
      return (
        <div data-testid="probe">
          {loc.search}|{JSON.stringify(loc.state)}
        </div>
      )
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <MemoryRouter initialEntries={['/board']}>
        <QueryClientProvider client={qc}>
          <Routes>
            <Route
              path="/board"
              element={
                <CardResearchReveal applicationId="app-1" company={{ name: '카카오' }} />
              }
            />
            <Route path="/board/:id" element={<Probe />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: /자세히 보기/ })
    // 주소는 그대로 (복사·공유해도 스트립 성과로 잡히지 않는다)
    expect(link).toHaveAttribute('href', '/board/app-1?tab=company')
    expect(link.getAttribute('href')).not.toContain('from=')

    fireEvent.click(link)
    expect(screen.getByTestId('probe')).toHaveTextContent('?tab=company|{"from":"strip"}')
  })

  it('16) 🔴 계측이 던져도 스트립이 살아 있다', async () => {
    ;(window as unknown as { clarity: () => void }).clarity = () => {
      throw new Error('blocked by extension')
    }
    renderTracked()
    // 렌더(shown 발사 시점)도, 클릭도 사용자 흐름을 막지 않는다
    const link = await screen.findByRole('link', { name: /자세히 보기/ })
    fireEvent.click(link)
    expect(screen.getByText('분산 시스템')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '회사 조사 닫기' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 보드 진입 1회 노출 (`intro`) — 기존 사용자용 경로
// ─────────────────────────────────────────────────────────────────────────

const GUIDE = '이제 카드에서 이런 회사 정보를 볼 수 있어요'

describe('CardResearchReveal — 보드 진입 1회 노출', () => {
  it('17) 🔴 intro 일 때만 한 줄 안내가 붙는다', async () => {
    renderStrip('app-1', true)
    const guide = await screen.findByText(GUIDE)
    // 3요소보다 위 — "이게 왜 지금?" 에 먼저 답한다
    expect(
      guide.compareDocumentPosition(screen.getByText('분산 시스템')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // 가장 약한 톤 — 주인공은 여전히 칩이다
    expect(guide.className).toContain('text-text-quaternary')
  })

  it('17-b) 카드 추가로 뜬 경우엔 안내 줄이 없다 (방금 한 일이 답이다)', async () => {
    renderStrip()
    await screen.findByText('분산 시스템')
    expect(screen.queryByText(GUIDE)).toBeNull()
  })

  it('17-c) 축하 오버레이 변형에는 안내 줄이 없다 (첫 카드 = 방금 한 일)', async () => {
    renderTracked({ variant: 'celebration', intro: true })
    await screen.findByText('분산 시스템')
    expect(screen.queryByText(GUIDE)).toBeNull()
  })
})

describe('CardResearchReveal — 노출 기회 소진', () => {
  const SEEN_KEY = 'chwippo:research-reveal-seen:u1'
  const USER = {
    id: 'u1', nickname: 'tester', email: 'a@b.c', role: 'user' as const,
    onboardedAt: null, termsAgreedAt: null, aiConsentAt: null, aiConsentVersion: null,
    onboardedCoinAt: null, signupJobCategories: null, signupOtherText: null, signupSeriesId: null, signupJobTitle: null,
    sampleCardsDismissedAt: null, calendarHomeIntroDismissedAt: null, alarmPromptedAt: null,
  }

  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: USER })
  })
  afterEach(() => useAuthStore.setState({ user: null }))

  it('18) 스트립이 실제로 뜨면 소진된다', async () => {
    renderStrip('app-1', true)
    await screen.findByText('분산 시스템')
    await waitFor(() => expect(localStorage.getItem(SEEN_KEY)).not.toBeNull())
  })

  it('18-b) 🔴 조사가 없어 안 떴으면 기회가 남는다 (「시도했다」로 소진하지 않는다)', async () => {
    mockedGet.mockResolvedValue(null)
    const { container } = renderStrip('app-1', true)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(localStorage.getItem(SEEN_KEY)).toBeNull()
  })

  it('18-c) 카드 추가·축하 오버레이로 뜬 것도 같은 기회를 쓴다', async () => {
    const strip = renderStrip()
    await screen.findByText('분산 시스템')
    await waitFor(() => expect(localStorage.getItem(SEEN_KEY)).not.toBeNull())
    strip.unmount()

    localStorage.clear()
    renderTracked({ variant: 'celebration' })
    await screen.findByText('분산 시스템')
    await waitFor(() => expect(localStorage.getItem(SEEN_KEY)).not.toBeNull())
  })

  it('18-d) 로그인 전(userId 없음)에는 기록하지 않는다', async () => {
    useAuthStore.setState({ user: null })
    renderStrip('app-1', true)
    await screen.findByText('분산 시스템')
    expect(localStorage.length).toBe(0)
  })
})

describe('CardResearchReveal — 계측 (보드 진입 경로)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'test-clarity')
    ;(window as unknown as { clarity?: unknown }).clarity = vi.fn()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as unknown as { clarity?: unknown }).clarity
  })

  it('19) 🔴 shown·click 둘 다 경로 이름이 갈린다 (카드 추가와 섞이면 CTR 이 거짓이 된다)', async () => {
    renderTracked({ intro: true })
    fireEvent.click(await screen.findByRole('link', { name: /자세히 보기/ }))
    await waitFor(() =>
      expect(firedEvents()).toEqual([
        'research_reveal_shown_intro',
        'research_reveal_click_intro',
      ]),
    )
  })

  it('19-b) 🔴 같은 자리에서 대상이 바뀌면(진입 노출 → 카드 추가) 새 노출로 잡힌다', async () => {
    const { rerender } = renderTracked({ intro: true })
    await screen.findByText('분산 시스템')
    await waitFor(() => expect(firedEvents()).toEqual(['research_reveal_shown_intro']))

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    rerender(
      <MemoryRouter>
        <DemoModeContextProvider value={false}>
          <QueryClientProvider client={qc}>
            <CardResearchReveal applicationId="app-2" company={{ name: '네이버' }} />
          </QueryClientProvider>
        </DemoModeContextProvider>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(firedEvents()).toEqual([
        'research_reveal_shown_intro',
        'research_reveal_shown_strip',
      ]),
    )
  })
})
