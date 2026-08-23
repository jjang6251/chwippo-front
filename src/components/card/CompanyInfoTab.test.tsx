/**
 * 카드 상세 「회사 알아보기」 탭.
 *
 * 시나리오:
 *  1. 4그룹 — 쓸모별 제목 + 12항목이 각자 제 그룹에
 *  2. 명함 — companyProfile 칩만 (아바타·회사명은 페이지 헤더 몫)
 *  3. 최근 행보 타임라인 — 날짜 배지 + 항목 / 파싱 실패 시 **원문 문단 그대로**
 *  4. 키워드는 **전부** (스트립의 5개 상한이 여기 새어들면 안 된다)
 *  5. 인재상은 칩이 아니다 (바로 위 키워드 칩과 한 덩어리로 읽히면 안 된다)
 *  6. 필드 일부만 — 있는 것만 · 그룹 전체가 비면 그룹도 없다 · 「확인하지 못했어요」 없음
 *  7. AI 추정 배지 (inferredFields)
 *  8. 시점 표기 — KST (UTC 그대로 찍으면 하루 어긋나는 경계값으로 잠근다)
 *  9. 출처 접기 — 기본 접힘
 * 10. 🔴 조회수 **집계** — 사람이 읽는 화면이라 countHit 기본값(true)
 * 11. 조사 부재 4종 → 렌더 0
 * 12. 🔴 **소제목 위계 3단** — 섹션 제목 > 소제목 > 본문이 실제 스타일로 갈린다
 * 13. 🔴 **「확인하지 못함」류 숨김** — 순수 부정은 항목째 / 부정 뒤 내용은 표시 / 그룹도 비면 숨김
 * 14. 비전·미션 인용 블록 — 라벨 살림 / 인용부호 없으면 문단
 * 15. 핵심가치 목록 — 이름·부연 분리 / 산문이면 원문 문단
 *
 * ── 2026-08-22 재배치 (핵심가치·인재상·직무 정보를 맨 위로) ──
 * 16. 🔴 새 그룹 「이 회사가 원하는 사람」이 **명함 아래·2열 위** (DOM 순서 + 형제 관계)
 * 17. 세 항목 있음/없음 조합 — 하나만 있어도 뜬다 / **셋 다 없으면 그룹째 숨김**
 * 18. 🔴 세 항목의 시각 규격이 **서로 다르다** (형태가 곧 위계) —
 *     인재상 15/700 한 줄(칩 아님) · 핵심가치 이름 15/700 목록 · 직무 정보 13/400 문단
 * 19. 남은 그룹 정리 — 「면접 전에 볼 것」 소멸 / 키워드 그룹은 제목이 곧 항목 이름
 *
 * ── 2026-08-22 상단 재구성 (명함 중복 제거 + 키워드 상단 이동·개명) ──
 * 20. 🔴 명함 — 아바타·회사명 **부재** · 칩만 · 칩 0개면 **블록째** 숨김 · 이름은 aria 로 대체
 * 21. 🔴 「이 회사 주요 키워드」 — 개명 · 명함 아래·「원하는 사람」 위 ·
 *     그 그룹 **안이 아님**(형제) · 0개면 숨김 · 소제목 없음
 * 22. 🔴 인재상에 **밑줄·brand 색이 없다** (회귀 방어 — 나중에 누가 다시 넣으면 깨진다)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanyInfoTab } from './CompanyInfoTab'
import { coverletterDocApi } from '@/api/coverletterDoc'
import type { CompanyResearchData, CompanyResearchResult } from '@/types/interviewPrep'

vi.mock('@/api/coverletterDoc', () => ({
  coverletterDocApi: { getResearch: vi.fn() },
}))

const mockedGet = vi.mocked(coverletterDocApi.getResearch)

const TRENDS = `1) 2026-04-28 발표: AI 검색 서비스 'AI탭' 베타 출시. 2) 2026-04-30 1분기 실적발표: 매출 3조2,411억원. 3) 2025-02-20 발표: 하이퍼클로바X 신모델 공개.`
const DIFFS = `1) 검색·커머스·페이·웹툰이 한 계정으로 묶인 생활 플랫폼. 2) 자체 초거대 언어모델을 보유한 국내 소수 기업.`
// 🔴 비전·핵심가치는 **네이버 실제 시드 원문** — 지어낸 서식으로는 파서 분기를 검증할 수 없다
const VISION = `비전: '세상의 무한한 가능성을 연결합니다'. 미션: '네이버는 연결합니다, 현재와 미래를.'`
const VALUES = `네이버 채용 공식 페이지 기준 4가지 핵심가치 — ① 기술로 연결합니다(세상의 무한한 가능성을 연결) ② 다양성을 이끌어 냅니다(누구나 쉽게 창작하고 더 많은 사람과 연결되는 생태계) ③ 비즈니스를 꽃피우게 합니다(기술과 데이터로 사업 성장을 지원) ④ 시대를 기록합니다(방대한 데이터를 안전하게 보존해 미래에 전달). 슬로건은 '모든 이의 더 나은 가능성을 만듭니다'.`

const FULL: CompanyResearchResult = {
  status: 'ok',
  cachedAt: '2026-08-19T15:30:00Z', // KST 로는 8/20 00:30 — UTC 로 찍으면 8/19 가 된다
  research: {
    businessSummary: '국내 최대 검색 포털을 운영하는 플랫폼 기업이다.',
    companyProfile: {
      founded: '1999년 6월 2일',
      hq: '경기도 성남시 분당구',
      industry: '인터넷 플랫폼',
      size: '직원 수 약 4,500명',
    },
    productsAndTech: {
      products: ['네이버 검색', '네이버페이'],
      techStack: ['하이퍼클로바X'],
    },
    financials: '2025년 연간 매출 12조350억원.',
    competitors: '카카오·구글코리아와 경쟁한다.',
    recentTrends: TRENDS,
    differentiators: DIFFS,
    visionMission: VISION,
    coreValues: VALUES,
    jobInsights: '백엔드 직무는 대규모 트래픽 경험을 본다.',
    talentProfile: ['성장 지향', '협업', '다양성 존중'],
    interviewKeywords: [
      { keyword: '분산 시스템', category: 'tech' },
      { keyword: '수평 확장', category: 'tech' },
      { keyword: '도전적 문화', category: 'talent' },
      { keyword: '광고 수익', category: 'business' },
      { keyword: '백엔드 직무', category: 'role' },
      { keyword: '규제 이슈', category: 'issue' },
      { keyword: '일곱번째', category: 'tech' },
      { keyword: '여덟번째', category: 'tech' },
    ],
    sources: [
      { id: 1, title: '네이버 뉴스룸', url: 'https://www.navercorp.com/news', domain: 'navercorp.com' },
      { id: 2, title: '전자공시', url: 'https://dart.fss.or.kr/x', domain: 'dart.fss.or.kr' },
    ],
    inferredFields: ['financials'],
  },
}

function renderTab(applicationId = 'app-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CompanyInfoTab applicationId={applicationId} />
    </QueryClientProvider>,
  )
}

const chips = (c: HTMLElement) => Array.from(c.querySelectorAll('span.rounded-full'))

beforeEach(() => {
  vi.clearAllMocks()
  mockedGet.mockResolvedValue(FULL)
})

const groupOf = (h: HTMLElement) => h.closest('section')!

describe('CompanyInfoTab — 쓸모별 4그룹', () => {
  it('1) 제목 4개 + 각 항목이 제 그룹에 들어간다', async () => {
    renderTab()
    const wanted = await screen.findByRole('heading', { name: '이 회사가 원하는 사람' })
    const about = screen.getByRole('heading', { name: '어떤 회사인가요' })
    const forCl = screen.getByRole('heading', { name: '자소서에 쓸 이야기' })
    const kw = screen.getByRole('heading', { name: '이 회사 주요 키워드' })

    // ⓪ 나에게 뭘 원하나 — 인재상·핵심가치·직무 정보
    for (const label of ['인재상', '핵심가치', '직무 정보']) {
      expect(groupOf(wanted)).toHaveTextContent(label)
    }
    // ① 이 회사는 — 사업·제품/기술·재무·경쟁사
    for (const label of ['사업 영역', '제품·기술 스택', '재무·매출', '경쟁사·시장']) {
      expect(groupOf(about)).toHaveTextContent(label)
    }
    // ② 자소서 — 최근 행보·왜 이 회사인가·비전 (핵심가치는 ⓪로 올라갔다)
    for (const label of ['최근 행보', '왜 이 회사인가', '비전·미션']) {
      expect(groupOf(forCl)).toHaveTextContent(label)
    }
    // ③ 키워드만 남았다 — 그룹 제목이 곧 항목 이름이라 소제목이 없다
    expect(groupOf(kw).querySelectorAll('h3')).toHaveLength(0)
    expect(groupOf(kw)).toHaveTextContent('분산 시스템')

    // 🔴 그룹이 섞이지 않는다
    expect(groupOf(about)).not.toHaveTextContent('최근 행보')
    expect(groupOf(forCl)).not.toHaveTextContent('핵심가치')
    expect(groupOf(forCl)).not.toHaveTextContent('주요 키워드')
    expect(groupOf(kw)).not.toHaveTextContent('인재상')
    expect(groupOf(kw)).not.toHaveTextContent('직무 정보')
  })

  it('2) 명함 — companyProfile 4값이 칩으로', async () => {
    renderTab()
    await screen.findByRole('heading', { name: '이 회사가 원하는 사람' })
    for (const v of ['인터넷 플랫폼', '경기도 성남시 분당구', '1999년 6월 2일', '직원 수 약 4,500명']) {
      expect(screen.getByText(v)).toBeInTheDocument()
    }
  })
})

describe('CompanyInfoTab — 최근 행보 타임라인', () => {
  it('3-a) 날짜 배지 + 항목 3개 (번호 마커는 본문에 남지 않는다)', async () => {
    const { container } = renderTab()
    await screen.findByText('최근 행보')
    const timeline = container.querySelector('ol')!
    expect(timeline.querySelectorAll('li')).toHaveLength(3)
    expect(screen.getByText('2026-04-28')).toBeInTheDocument()
    expect(screen.getByText('2026-04-30')).toBeInTheDocument()
    expect(screen.getByText('2025-02-20')).toBeInTheDocument()
    expect(
      screen.getByText("발표: AI 검색 서비스 'AI탭' 베타 출시."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^1\)/)).toBeNull()
  })

  it('3-b) 🔴 파싱 실패(날짜 없는 산문) → 원문 문단이 통째로 남는다 (화면이 비지 않는다)', async () => {
    const prose =
      '2025년 연간 매출 3조 3,266억 원으로 창사 최대 실적을 냈고, 1분기에도 최대 분기를 경신했습니다(2026-05 발표).'
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { recentTrends: prose },
    })
    renderTab()
    expect(await screen.findByText(prose)).toBeInTheDocument()
  })

  it('3-c) 「왜 이 회사인가」는 번호 목록 — 타임라인이 아니다 (날짜가 없다)', async () => {
    renderTab()
    await screen.findByText('왜 이 회사인가')
    expect(
      screen.getByText('검색·커머스·페이·웹툰이 한 계정으로 묶인 생활 플랫폼.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('자체 초거대 언어모델을 보유한 국내 소수 기업.'),
    ).toBeInTheDocument()
  })
})

describe('CompanyInfoTab — 칩·위계', () => {
  it('4) 🔴 키워드는 8개 전부 (스트립의 5개 상한이 여기 새어들면 안 된다)', async () => {
    renderTab()
    await screen.findByText('이 회사 주요 키워드')
    for (const kw of ['분산 시스템', '규제 이슈', '일곱번째', '여덟번째']) {
      expect(screen.getByText(kw)).toBeInTheDocument()
    }
  })

  it('5) 인재상은 칩이 아니라 인라인 텍스트 (칩과 멀어진 뒤에도 규칙은 그대로)', async () => {
    const { container } = renderTab()
    const talents = await screen.findByText('성장 지향 · 협업 · 다양성 존중')
    expect(talents.tagName).toBe('P')
    expect(chips(container).some((el) => el.textContent === '성장 지향')).toBe(false)
  })
})

describe('CompanyInfoTab — 필드 일부만', () => {
  it('6-a) 있는 것만 그린다 — 빈 항목 라벨·「확인하지 못했어요」 없음', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { businessSummary: '요약뿐이다.', interviewKeywords: ['키워드'] },
    })
    renderTab()
    expect(await screen.findByText('요약뿐이다.')).toBeInTheDocument()
    expect(screen.queryByText('재무·매출')).toBeNull()
    expect(screen.queryByText('최근 행보')).toBeNull()
    expect(screen.queryByText(/확인하지 못했어요/)).toBeNull()
  })

  it('6-b) 그룹 전체가 비면 그룹 제목도 없다', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { businessSummary: '요약뿐이다.' },
    })
    renderTab()
    expect(await screen.findByRole('heading', { name: '어떤 회사인가요' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '이 회사가 원하는 사람' })).toBeNull()
    expect(screen.queryByRole('heading', { name: '자소서에 쓸 이야기' })).toBeNull()
    expect(screen.queryByRole('heading', { name: '이 회사 주요 키워드' })).toBeNull()
  })
})

describe('CompanyInfoTab — AI 산출물 표기 (맨 아래)', () => {
  it('7) inferredFields 항목에 「추정」 배지', async () => {
    renderTab()
    const badge = await screen.findByRole('note', { name: /AI 추정/ })
    expect(badge).toHaveTextContent('추정')
    // 재무에만 붙는다 (사업 영역에는 없다)
    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(screen.getByText(/「추정」 이 붙은 항목은/)).toBeInTheDocument()
  })

  it('8) 🔴 시점은 KST — 8/19 15:30Z 는 KST 로 8/20 이다', async () => {
    renderTab()
    expect(await screen.findByText('2026-08-20 기준 (KST)')).toBeInTheDocument()
  })

  it('8-b) cachedAt 이 없거나 이상하면 시점 줄 자체가 없다 (거짓 날짜 금지)', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      cachedAt: 'not-a-date',
      research: { businessSummary: '요약이다.' },
    })
    renderTab()
    await screen.findByText('요약이다.')
    expect(screen.queryByText(/기준 \(KST\)/)).toBeNull()
  })

  it('9) 출처는 기본 접힘 — 누르면 도메인 칩', async () => {
    renderTab()
    const toggle = await screen.findByRole('button', { name: /출처 \(2\)/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('navercorp.com')).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByText('navercorp.com')).toBeInTheDocument()
    expect(screen.getByText('dart.fss.or.kr')).toBeInTheDocument()
  })

  it('9-b) AI 안내 문구는 항상 있다', async () => {
    renderTab()
    expect(
      await screen.findByText(/AI 가 공개 자료를 모아 정리한 내용이에요/),
    ).toBeInTheDocument()
  })
})

describe('CompanyInfoTab — 조회수·부재', () => {
  it('10) 🔴 조회수 집계 — countHit 기본값으로 호출 (스트립만 미집계다)', async () => {
    renderTab('app-9')
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    const [, opts] = mockedGet.mock.calls[0]
    expect(mockedGet.mock.calls[0][0]).toBe('app-9')
    expect(opts?.countHit).not.toBe(false)
  })

  const absent: Array<[string, CompanyResearchResult | null]> = [
    ['null (미조사·만료)', null],
    ['opt_out', { status: 'opt_out' }],
    ['blocked', { status: 'blocked' }],
    ['빈 껍데기', { status: 'ok', research: {} }],
  ]

  it.each(absent)('11) %s → 렌더 0', async (_label, value) => {
    mockedGet.mockResolvedValue(value)
    const { container } = renderTab()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})

// ── 2026-08-22 가독성 수리 ──────────────────────────────────────────────

describe('CompanyInfoTab — 12) 🔴 소제목 위계 3단', () => {
  it('12-a) 섹션 제목(16/700) > 소제목(14/600) > 본문(13/400) — 크기·굵기가 단조 감소한다', async () => {
    renderTab()
    const section = await screen.findByRole('heading', { name: '어떤 회사인가요' })
    const sub = screen.getByRole('heading', { name: '사업 영역' })
    const body = screen.getByText('국내 최대 검색 포털을 운영하는 플랫폼 기업이다.')

    // 섹션 제목 — h2 · 16px · 700
    expect(section.tagName).toBe('H2')
    expect(section).toHaveClass('text-base', 'font-bold', 'text-text-primary')
    // 소제목 — h3 · 14px · 600 (문서 구조도 섹션 아래로 내려간다)
    expect(sub.tagName).toBe('H3')
    expect(sub).toHaveClass('text-sm', 'font-semibold', 'text-text-primary')
    // 본문 — 13px · 굵기 지정 없음(400) · secondary
    expect(body).toHaveClass('text-[13px]', 'text-text-secondary')
    expect(body.className).not.toMatch(/font-(semibold|bold)/)
  })

  it('12-b) 🔴 소제목이 섹션 제목과 같아지지 않는다 (올리다 위계가 다시 무너지는 지점)', async () => {
    renderTab()
    const section = await screen.findByRole('heading', { name: '자소서에 쓸 이야기' })
    const sub = screen.getByRole('heading', { name: '최근 행보' })
    expect(section.className).not.toBe(sub.className)
    expect(sub).not.toHaveClass('text-base')
    expect(sub).not.toHaveClass('font-bold')
  })
})

describe('CompanyInfoTab — 13) 🔴 「확인하지 못함」류는 항목째 숨긴다', () => {
  const PURE = '삼성물산 별도의 공식 핵심가치 문구는 확인하지 못함 (인재상으로 대체 서술)'
  const HAS_CONTENT =
    '우리금융캐피탈 자체의 공식 핵심가치 문서는 확인되지 않았다. 우리금융그룹 차원에서는 정도경영과 임직원 존중·소통, 계열사 간 신뢰를 통한 시너지 창출을 강조한다.'

  it('13-a) 순수 부정 → 소제목도 본문도 없다 (빈 값과 같은 처리)', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { recentTrends: TRENDS, coreValues: PURE },
    })
    renderTab()
    await screen.findByText('최근 행보')
    expect(screen.queryByRole('heading', { name: '핵심가치' })).toBeNull()
    expect(screen.queryByText(/확인하지 못함/)).toBeNull()
  })

  it('13-b) 🔴 과잉 차단 방어 — 부정 뒤에 내용이 있으면 그대로 보여준다', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { coreValues: HAS_CONTENT },
    })
    renderTab()
    expect(await screen.findByRole('heading', { name: '핵심가치' })).toBeInTheDocument()
    expect(screen.getByText(HAS_CONTENT)).toBeInTheDocument()
  })

  it('13-c) 항목이 다 숨겨져 그룹이 통째로 비면 그룹 제목도 없다', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: {
        businessSummary: '국내 최대 검색 포털이다.',
        coreValues: PURE,
        visionMission: '공식 비전 슬로건은 확인되지 않음',
      },
    })
    renderTab()
    await screen.findByText('국내 최대 검색 포털이다.')
    expect(screen.queryByRole('heading', { name: '자소서에 쓸 이야기' })).toBeNull()
    expect(screen.getByRole('heading', { name: '어떤 회사인가요' })).toBeInTheDocument()
  })

  it('13-d) 조사가 전부 「확인하지 못함」이면 탭 자체가 렌더 0', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { coreValues: PURE, visionMission: '공식 비전 슬로건은 확인되지 않음' },
    })
    const { container } = renderTab()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})

describe('CompanyInfoTab — 14) 비전·미션 인용 블록', () => {
  it('14-a) 인용부호가 있으면 인용 블록 + 라벨을 살린다 (네이버 실데이터)', async () => {
    const { container } = renderTab()
    await screen.findByRole('heading', { name: '비전·미션' })
    const quotes = container.querySelectorAll('blockquote')
    expect(quotes).toHaveLength(2)
    // 🔴 시각 언어는 에디터 `.chw-prose blockquote` 와 같은 왼쪽 brand 선
    expect(quotes[0]).toHaveClass('border-l-[3px]', 'border-brand')
    expect(screen.getByText('비전')).toBeInTheDocument()
    expect(screen.getByText('미션')).toBeInTheDocument()
    expect(screen.getByText('세상의 무한한 가능성을 연결합니다')).toBeInTheDocument()
    expect(screen.getByText('네이버는 연결합니다, 현재와 미래를.')).toBeInTheDocument()
    // 따옴표는 벗긴다 (원문 그대로 남으면 인용 블록과 겹쳐 두 번 인용된다)
    expect(screen.queryByText(/'세상의 무한한/)).toBeNull()
  })

  it('14-b) 인용부호가 없으면 지금처럼 문단 (삼성전자 실데이터 — 실측 45%)', async () => {
    const prose =
      '인재와 기술을 바탕으로 최고의 제품과 서비스를 창출하여 인류사회에 공헌한다 (삼성전자 공식 경영이념)'
    mockedGet.mockResolvedValue({ status: 'ok', research: { visionMission: prose } })
    const { container } = renderTab()
    expect(await screen.findByText(prose)).toBeInTheDocument()
    expect(container.querySelector('blockquote')).toBeNull()
  })

  it('14-c) 🔴 문장 속 인용은 블록으로 뽑지 않는다 — 문장이 두 동강 난다 (LG전자 실데이터)', async () => {
    const embedded = `비전 '일등LG', 경영이념 '고객을 위한 가치창조'와 '인간존중의 경영'을 LG WAY로 실천`
    mockedGet.mockResolvedValue({ status: 'ok', research: { visionMission: embedded } })
    const { container } = renderTab()
    expect(await screen.findByText(embedded)).toBeInTheDocument()
    expect(container.querySelector('blockquote')).toBeNull()
  })
})

describe('CompanyInfoTab — 15) 핵심가치 목록', () => {
  it('15-a) 이름은 굵게, 부연은 작고 흐리게 — 머리말·꼬리는 항목이 아니다 (네이버 실데이터)', async () => {
    const { container } = renderTab()
    await screen.findByRole('heading', { name: '핵심가치' })
    const list = container.querySelector('ul.list-disc')!
    const items = list.querySelectorAll('li')
    expect(items).toHaveLength(4)

    // 🔴 상단으로 올라오며 이름이 주인공이 됐다 — 15px/700 (부연은 12px 그대로)
    const name = screen.getByText('기술로 연결합니다')
    expect(name).toHaveClass('text-[15px]', 'font-bold', 'text-text-primary')
    const note = screen.getByText('세상의 무한한 가능성을 연결')
    expect(note).toHaveClass('text-xs', 'text-text-tertiary')

    // 머리말은 목록 밖 · 마지막 항목 뒤 문장은 꼬리로 빠진다
    expect(screen.getByText('네이버 채용 공식 페이지 기준 4가지 핵심가치')).toBeInTheDocument()
    expect(screen.getByText(/슬로건은 '모든 이의 더 나은 가능성을 만듭니다'/)).toBeInTheDocument()
    expect(list.textContent).not.toContain('슬로건은')
  })

  it('15-b) 🔴 쉼표+괄호형이 주 패턴이다 (삼성전자 실데이터)', async () => {
    const raw = `인재제일(기업은 사람이라는 신념으로 인재를 소중히 여기고 능력 발휘 기회 제공), 최고지향(끊임없는 열정과 도전정신으로 세계 최고를 추구), 상생추구(지역사회·국가·인류의 공동 번영을 위해 노력) — 삼성전자 공식 5대 핵심가치`
    mockedGet.mockResolvedValue({ status: 'ok', research: { coreValues: raw } })
    const { container } = renderTab()
    await screen.findByRole('heading', { name: '핵심가치' })
    expect(container.querySelectorAll('ul.list-disc li')).toHaveLength(3)
    expect(screen.getByText('인재제일')).toBeInTheDocument()
    expect(screen.getByText('삼성전자 공식 5대 핵심가치')).toBeInTheDocument()
  })

  it('15-c) 🔴 못 읽으면 원문 문단 그대로 — 산문에 억지로 쉼표를 끊지 않는다 (한국콜마 실데이터)', async () => {
    const prose = `윤리경영과 환경경영을 기반으로 한 건강한 기업문화. 슬로건은 '인류의 건강과 아름다움을 위하여, Let's Kolmar!'`
    mockedGet.mockResolvedValue({ status: 'ok', research: { coreValues: prose } })
    const { container } = renderTab()
    expect(await screen.findByText(prose)).toBeInTheDocument()
    expect(container.querySelector('ul.list-disc')).toBeNull()
  })
})

// ── 2026-08-22 재배치 — 핵심가치·인재상·직무 정보를 맨 위로 ────────────────

/** b 가 a 보다 문서상 **뒤에** 오는가 */
const follows = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

/**
 * 명함 블록 — 회사명 h2 가 사라져 **`aria-label` 이 유일한 손잡이**다.
 * (그게 접근성 대체가 실제로 붙어 있다는 단언이기도 하다)
 */
const nameplate = () => screen.getByRole('region', { name: '회사 기본 정보' })

describe('CompanyInfoTab — 16) 🔴 「이 회사가 원하는 사람」이 맨 위', () => {
  it('16-a) 명함·키워드 **아래** · 2열 그룹 **위** (DOM 순서)', async () => {
    renderTab()
    const wanted = await screen.findByRole('heading', { name: '이 회사가 원하는 사람' })
    const card = nameplate()
    const kw = screen.getByRole('heading', { name: '이 회사 주요 키워드' })
    const about = screen.getByRole('heading', { name: '어떤 회사인가요' })
    const forCl = screen.getByRole('heading', { name: '자소서에 쓸 이야기' })

    for (const earlier of [card, kw]) expect(follows(earlier, wanted)).toBe(true)
    for (const later of [about, forCl]) {
      expect(follows(wanted, later)).toBe(true)
    }
  })

  it('16-b) 🔴 2열 **밖**이다 — 명함과 형제, 「어떤 회사인가요」와는 남남 (전폭이 되는 조건)', async () => {
    renderTab()
    const wanted = await screen.findByRole('heading', { name: '이 회사가 원하는 사람' })
    const cardSection = nameplate()
    const about = screen.getByRole('heading', { name: '어떤 회사인가요' })

    expect(groupOf(wanted).parentElement).toBe(cardSection.parentElement)
    expect(groupOf(about).parentElement).not.toBe(cardSection.parentElement)
  })

  it('16-c) 데스크탑 2열은 **두 단어형이 다 있을 때만** — 하나뿐이면 반쪽이 비지 않는다', async () => {
    const { container, unmount } = renderTab()
    await screen.findByRole('heading', { name: '이 회사가 원하는 사람' })
    expect(container.querySelector('.lg\\:grid-cols-2')).not.toBeNull()
    unmount()

    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { talentProfile: ['성장 지향'], jobInsights: '백엔드는 트래픽을 본다.' },
    })
    const only = renderTab()
    await screen.findByRole('heading', { name: '인재상' })
    expect(only.container.querySelector('.lg\\:grid-cols-2')).toBeNull()
  })
})

describe('CompanyInfoTab — 17) 세 항목 있음/없음 조합', () => {
  const cases: Array<[string, CompanyResearchData, string[], string[]]> = [
    ['핵심가치만', { coreValues: '인재제일(사람이 먼저), 최고지향(세계 최고), 상생추구(공동 번영)' }, ['핵심가치'], ['인재상', '직무 정보']],
    ['인재상만', { talentProfile: ['성장 지향', '협업'] }, ['인재상'], ['핵심가치', '직무 정보']],
    ['직무 정보만', { jobInsights: '백엔드 직무는 대규모 트래픽 경험을 본다.' }, ['직무 정보'], ['핵심가치', '인재상']],
    [
      '핵심가치 + 직무 정보',
      {
        coreValues: '인재제일(사람이 먼저), 최고지향(세계 최고), 상생추구(공동 번영)',
        jobInsights: '백엔드 직무는 대규모 트래픽 경험을 본다.',
      },
      ['핵심가치', '직무 정보'],
      ['인재상'],
    ],
  ]

  it.each(cases)('17-%#) %s — 있는 것만 그린다', async (_label, research, shown, hidden) => {
    mockedGet.mockResolvedValue({ status: 'ok', research })
    renderTab()
    const group = groupOf(await screen.findByRole('heading', { name: '이 회사가 원하는 사람' }))
    for (const label of shown) expect(group).toHaveTextContent(label)
    for (const label of hidden) expect(screen.queryByRole('heading', { name: label })).toBeNull()
  })

  it('17-e) 🔴 셋 다 없으면 그룹째 사라진다 (다른 그룹은 그대로)', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { businessSummary: '국내 최대 검색 포털이다.', recentTrends: TRENDS },
    })
    renderTab()
    await screen.findByText('국내 최대 검색 포털이다.')
    expect(screen.queryByRole('heading', { name: '이 회사가 원하는 사람' })).toBeNull()
    expect(screen.getByRole('heading', { name: '어떤 회사인가요' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '자소서에 쓸 이야기' })).toBeInTheDocument()
  })

  it('17-f) 🔴 「확인하지 못함」뿐인 셋 → 그룹째 사라진다 (isFilled 판정은 한 곳)', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: {
        businessSummary: '국내 최대 검색 포털이다.',
        coreValues: '공식 핵심가치 문구는 확인하지 못함',
        jobInsights: '직무별 상세 요건은 확인되지 않았다.',
      },
    })
    renderTab()
    await screen.findByText('국내 최대 검색 포털이다.')
    expect(screen.queryByRole('heading', { name: '이 회사가 원하는 사람' })).toBeNull()
  })
})

describe('CompanyInfoTab — 18) 🔴 세 항목의 형태가 서로 다르다 (형태가 곧 위계)', () => {
  it('18-a) 인재상 — 15px/700 한 줄. 칩도 목록도 아니다', async () => {
    renderTab()
    const talent = await screen.findByText('성장 지향 · 협업 · 다양성 존중')
    expect(talent.tagName).toBe('P')
    expect(talent).toHaveClass('text-[15px]', 'font-bold', 'text-text-primary')
    // 칩(rounded-full 알약)도 아니고 목록도 아니다
    expect(talent.className).not.toMatch(/rounded-full|border/)
    expect(talent.closest('ul')).toBeNull()
  })

  it('18-b) 핵심가치 — **목록**이고 이름만 15px/700, 부연은 12px 로 남는다', async () => {
    const { container } = renderTab()
    await screen.findByRole('heading', { name: '핵심가치' })
    const name = screen.getByText('기술로 연결합니다')
    expect(name).toHaveClass('text-[15px]', 'font-bold')
    expect(name.closest('ul.list-disc')).not.toBeNull()
    expect(screen.getByText('세상의 무한한 가능성을 연결')).toHaveClass(
      'text-xs',
      'text-text-tertiary',
    )
    expect(container.querySelectorAll('ul.list-disc li')).toHaveLength(4)
  })

  it('18-c) 🔴 핵심가치 문단형은 **키우지 않는다** — 뽑을 게 없으면 13px 본문 그대로', async () => {
    const prose =
      '윤리경영과 환경경영을 기반으로 한 건강한 기업문화를 지향하며 구성원의 성장을 지원한다.'
    mockedGet.mockResolvedValue({ status: 'ok', research: { coreValues: prose } })
    const { container } = renderTab()
    const body = await screen.findByText(prose)
    expect(body).toHaveClass('text-[13px]', 'text-text-secondary')
    expect(body.className).not.toMatch(/text-\[15px\]|font-bold/)
    expect(container.querySelector('ul.list-disc')).toBeNull()
  })

  it('18-d) 직무 정보 — 서술형이라 **문단 13px/400** 그대로 (억지로 단어로 뽑지 않는다)', async () => {
    renderTab()
    await screen.findByRole('heading', { name: '직무 정보' })
    const body = screen.getByText('백엔드 직무는 대규모 트래픽 경험을 본다.')
    expect(body.tagName).toBe('P')
    expect(body).toHaveClass('text-[13px]', 'text-text-secondary')
    expect(body.className).not.toMatch(/font-(semibold|bold)/)
  })

  it('18-e) 🔴 셋 다 섹션 제목(16/700)을 넘지 않는다 — 소제목(14/600)은 그대로다', async () => {
    renderTab()
    const section = await screen.findByRole('heading', { name: '이 회사가 원하는 사람' })
    expect(section).toHaveClass('text-base', 'font-bold')
    for (const label of ['인재상', '핵심가치', '직무 정보']) {
      const sub = screen.getByRole('heading', { name: label })
      expect(sub.tagName).toBe('H3')
      expect(sub).toHaveClass('text-sm', 'font-semibold', 'text-text-primary')
    }
  })
})

describe('CompanyInfoTab — 19) 남은 그룹 정리', () => {
  it('19-a) 「면접 전에 볼 것」은 없다 — 키워드 하나가 이름을 바꿔 위로 갔다', async () => {
    renderTab()
    await screen.findByRole('heading', { name: '이 회사 주요 키워드' })
    expect(screen.queryByRole('heading', { name: '면접 전에 볼 것' })).toBeNull()
    // 상한 없음은 그대로다
    expect(screen.getByText('여덟번째')).toBeInTheDocument()
  })

  it('19-c) 「자소서에 쓸 이야기」는 핵심가치가 빠져도 셋이 남아 응집력을 유지한다', async () => {
    renderTab()
    const forCl = groupOf(await screen.findByRole('heading', { name: '자소서에 쓸 이야기' }))
    for (const label of ['최근 행보', '왜 이 회사인가', '비전·미션']) {
      expect(forCl).toHaveTextContent(label)
    }
    expect(forCl).not.toHaveTextContent('핵심가치')
  })
})

// ── 2026-08-22 상단 재구성 — 명함 중복 제거 + 키워드 상단 이동·개명 ──────────

describe('CompanyInfoTab — 20) 🔴 명함에서 아바타·회사명을 뺐다', () => {
  it('20-a) 회사명도 아바타도 없다 — 페이지 헤더에 이미 있어 중복이었다', async () => {
    renderTab()
    const card = await screen.findByRole('region', { name: '회사 기본 정보' })
    // 회사명이 어디에도 없다 (탭은 회사명을 더 이상 받지도 않는다)
    expect(screen.queryByRole('heading', { name: '네이버' })).toBeNull()
    expect(screen.queryByText('네이버')).toBeNull()
    // 아바타 — 로고 img 도 이니셜 상자도 없다
    expect(card.querySelector('img')).toBeNull()
    // 제목 층이 통째로 빠졌다 — 남은 건 칩 한 줄뿐
    expect(card.querySelectorAll('h1, h2, h3')).toHaveLength(0)
  })

  it('20-b) 칩만 렌더 — 4값이 그대로 명함 안에 있다', async () => {
    renderTab()
    const card = await screen.findByRole('region', { name: '회사 기본 정보' })
    for (const v of ['인터넷 플랫폼', '경기도 성남시 분당구', '1999년 6월 2일', '직원 수 약 4,500명']) {
      expect(card).toHaveTextContent(v)
    }
  })

  it('20-c) 🔴 companyProfile 이 비면 **블록째** 사라진다 (테두리만 남은 상자 금지)', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { businessSummary: '국내 최대 검색 포털이다.', talentProfile: ['성장 지향'] },
    })
    renderTab()
    await screen.findByText('국내 최대 검색 포털이다.')
    expect(screen.queryByRole('region', { name: '회사 기본 정보' })).toBeNull()
  })

  it('20-d) 🔴 companyProfile 값이 전부 공백이어도 블록째 사라진다', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: {
        businessSummary: '국내 최대 검색 포털이다.',
        companyProfile: { founded: '  ', hq: '', industry: undefined, size: '' },
      },
    })
    renderTab()
    await screen.findByText('국내 최대 검색 포털이다.')
    expect(screen.queryByRole('region', { name: '회사 기본 정보' })).toBeNull()
  })

  it('20-e) 🔴 제목이 사라진 자리를 aria 가 대신한다 (칩만 읽히면 맥락이 없다)', async () => {
    renderTab()
    const card = await screen.findByRole('region', { name: '회사 기본 정보' })
    expect(card.tagName).toBe('SECTION')
    expect(card).toHaveAttribute('aria-label', '회사 기본 정보')
  })
})

describe('CompanyInfoTab — 21) 🔴 「이 회사 주요 키워드」', () => {
  it('21-a) 개명 — 「예상 면접 키워드」는 어디에도 없다', async () => {
    renderTab()
    expect(
      await screen.findByRole('heading', { name: '이 회사 주요 키워드' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '예상 면접 키워드' })).toBeNull()
    expect(screen.queryByText(/예상 면접 키워드/)).toBeNull()
  })

  it('21-b) 위치 — 명함 **아래** · 「이 회사가 원하는 사람」 **위** (DOM 순서)', async () => {
    renderTab()
    const kw = await screen.findByRole('heading', { name: '이 회사 주요 키워드' })
    const card = nameplate()
    const wanted = screen.getByRole('heading', { name: '이 회사가 원하는 사람' })

    expect(follows(card, kw)).toBe(true)
    expect(follows(kw, wanted)).toBe(true)
  })

  it('21-c) 🔴 「이 회사가 원하는 사람」 **안이 아니다** — 형제다 (뜻이 다른 블록)', async () => {
    renderTab()
    const kw = await screen.findByRole('heading', { name: '이 회사 주요 키워드' })
    const wanted = screen.getByRole('heading', { name: '이 회사가 원하는 사람' })

    // 그룹 안에 들어가 있지 않다
    expect(groupOf(wanted).contains(kw)).toBe(false)
    expect(groupOf(kw).contains(wanted)).toBe(false)
    // 명함·「원하는 사람」과 같은 부모 아래 나란히 선다
    expect(groupOf(kw).parentElement).toBe(nameplate().parentElement)
    expect(groupOf(kw).parentElement).toBe(groupOf(wanted).parentElement)
    // 칩이 그 그룹으로 새지 않는다
    expect(groupOf(wanted)).not.toHaveTextContent('분산 시스템')
  })

  it('21-d) 키워드가 없으면 블록째 사라진다 (다른 상단 블록은 그대로)', async () => {
    mockedGet.mockResolvedValue({
      status: 'ok',
      research: { businessSummary: '국내 최대 검색 포털이다.', talentProfile: ['성장 지향'] },
    })
    renderTab()
    await screen.findByRole('heading', { name: '인재상' })
    expect(screen.queryByRole('heading', { name: '이 회사 주요 키워드' })).toBeNull()
    expect(screen.getByRole('heading', { name: '이 회사가 원하는 사람' })).toBeInTheDocument()
  })

  it('21-e) 🔴 제목 층 — 그룹 제목(16/700)이 곧 항목 이름이라 소제목이 없다', async () => {
    renderTab()
    const kw = await screen.findByRole('heading', { name: '이 회사 주요 키워드' })
    expect(kw.tagName).toBe('H2')
    // 다른 그룹 제목과 **같은 층**이다 — 여기만 작게 두면 위 명함에 딸린 항목처럼 읽힌다
    expect(kw).toHaveClass('text-base', 'font-bold', 'text-text-primary')
    expect(kw.className).toBe(
      screen.getByRole('heading', { name: '이 회사가 원하는 사람' }).className,
    )
    // 제목을 두 번 쓰지 않는다
    expect(groupOf(kw).querySelectorAll('h3')).toHaveLength(0)
    expect(screen.getAllByRole('heading', { name: '이 회사 주요 키워드' })).toHaveLength(1)
  })

  it('21-f) 칩 색·상한은 그대로 — 8개 전부 · 카테고리색 유지', async () => {
    renderTab()
    const kw = await screen.findByRole('heading', { name: '이 회사 주요 키워드' })
    const group = groupOf(kw)
    expect(group.querySelectorAll('span.rounded-full')).toHaveLength(8)
    expect(screen.getByText('분산 시스템')).toHaveClass('bg-info/10', 'text-info')
    expect(screen.getByText('규제 이슈')).toHaveClass('bg-danger/10', 'text-danger')
  })
})

/**
 * 🔴 회귀 방어 — 「인재상을 더 튀게」 요청이 오면 가장 먼저 손이 가는 게 밑줄·brand 색이다.
 * 이 앱에서 밑줄은 **누를 수 있는 것**이고 `text-brand` 는 CTA·활성 색이라 둘 다
 * 거짓 어포던스가 된다. 굵기(15/700)만으로 세운다 — 나중에 누가 다시 넣으면 여기서 깨진다.
 */
describe('CompanyInfoTab — 22) 🔴 인재상에 밑줄·brand 색이 없다', () => {
  it('22-a) 15px/700 · `text-text-primary` — underline 도 text-brand 도 없다', async () => {
    renderTab()
    const talent = await screen.findByText('성장 지향 · 협업 · 다양성 존중')
    expect(talent).toHaveClass('text-[15px]', 'font-bold', 'text-text-primary')
    expect(talent.className).not.toMatch(/underline|decoration|text-brand|text-accent/)
    expect(talent.querySelector('u, a, mark')).toBeNull()
  })

  it('22-b) 소제목(인재상 라벨)에도 밑줄·brand 색이 없다', async () => {
    renderTab()
    const label = await screen.findByRole('heading', { name: '인재상' })
    expect(label.className).not.toMatch(/underline|decoration|text-brand|text-accent/)
  })
})
