/**
 * 카드 추가 직후 회사 조사 스트립 (plan §1-A).
 *
 * 시나리오:
 * 1. 조사 있는 회사 추가 → **그리드 위 스트립**에 3요소 (모달·화면 이동 없음)
 * 2. 🔴 **카드 높이는 조사 유무와 무관하게 그대로다** — 스트립을 카드 안에 넣었을 때
 *    `[grid-auto-rows:1fr]` 계약 때문에 모든 카드가 +112px 커지던 문제의 회귀 방어
 * 3. 🔴 조사 없는 회사 추가 → **아무 일도 안 일어난다**(스트립 0 · 이동 0).
 *    커버리지가 낮아 대부분의 회사가 이 경로를 탄다 — 이 기능의 안전장치다.
 * 4. 🔴 스트립 클릭 → **카드 상세 「회사 알아보기」 탭**에 도착하고 최근 행보 타임라인이 그려진다.
 *    ×는 이동하지 않는다 (치우려다 이동하면 안 된다).
 * 7·8. **보드 진입 1회 노출** — 기존 사용자용 경로 (파일 아래 describe. localStorage 기억이라
 *    새로고침 경로가 진짜인지는 실브라우저에서만 알 수 있다).
 */
import { test, expect, type Page } from '@playwright/test'
import { mockAuth } from './helpers/auth'

const RESEARCH = {
  status: 'ok',
  research: {
    businessSummary:
      '국내 최대 메신저를 운영하는 플랫폼 기업이다. 최근에는 광고와 커머스로 수익원을 넓히고 있다.',
    interviewKeywords: [
      { keyword: '분산 시스템', category: 'tech' },
      { keyword: '수평 확장', category: 'tech' },
      { keyword: '도전적 문화', category: 'talent' },
      { keyword: '광고 수익', category: 'business' },
      { keyword: '백엔드 직무', category: 'role' },
      { keyword: '규제 이슈', category: 'issue' },
    ],
    talentProfile: ['도전', '협업', '성장'],
    // 스트립에는 안 나오고(첫 화면 3요소 밖) 카드 상세 탭에서 타임라인이 되는 실측 서식
    recentTrends:
      "1) 2026-04-28 발표: AI 검색 서비스 'AI탭' 베타 출시. 2) 2026-04-30 1분기 실적발표: 매출 3조2,411억원.",
    competitors: '네이버·구글코리아와 경쟁한다.',
  },
}

/**
 * 재배치 검증용 — **상단 그룹 3항목이 다 있는** 조사. 핵심가치는 실측 주 패턴(쉼표+괄호형).
 * 실측 353개사 보유율이 핵심가치 312 · 인재상 335 · 직무 정보 351 이라 이게 보통 경우다.
 */
const RESEARCH_WANTED = {
  status: 'ok',
  research: {
    ...RESEARCH.research,
    // 명함(칩 한 줄)이 뜨는 조건 — 없으면 블록째 사라진다
    companyProfile: {
      founded: '1999년 6월 2일',
      hq: '경기도 성남시 분당구',
      industry: '인터넷 플랫폼',
      size: '직원 수 약 4,500명',
    },
    coreValues:
      '인재제일(기업은 사람이라는 신념으로 인재를 소중히 여기고 능력 발휘 기회 제공), 최고지향(끊임없는 열정과 도전정신으로 세계 최고를 추구), 상생추구(지역사회·국가·인류의 공동 번영을 위해 노력) — 공식 5대 핵심가치',
    jobInsights: '백엔드 직무는 대규모 트래픽 처리 경험과 분산 시스템 이해를 본다.',
  },
}

const NEW_ID = 'app-new'
/** 보드 진입 1회 노출의 소진 기록 (`utils/researchIntro`) */
const SEEN_KEY = 'chwippo:research-reveal-seen:test-user-uuid-1'

function makeApp(id: string, companyName: string, createdAt = '2026-05-01T00:00:00Z') {
  return {
    id,
    userId: 'test-user-uuid-1',
    companyName,
    jobTitle: '백엔드 개발자',
    jobCategory: null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [],
    createdAt,
    updatedAt: createdAt,
  }
}

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data }),
})

/**
 * `intro: true` 면 **보드 진입 1회 노출을 살려 둔 채** 시작한다 (기존 사용자 시나리오).
 * 기본은 소진 상태 — 이 파일의 다른 시나리오는 「카드 추가」 경로를 재는 것이라
 * 진입 노출이 끼면 무엇을 보고 있는지가 흐려진다.
 */
async function setup(
  page: Page,
  research: unknown,
  width = 1280,
  opts: { intro?: boolean } = {},
) {
  await mockAuth(page)
  if (!opts.intro) {
    await page.addInitScript(
      (key) => localStorage.setItem(key, '2026-08-01T00:00:00.000Z'),
      SEEN_KEY,
    )
  }
  // 🔴 a2 가 **더 나중에 만든 카드**다 — 진입 노출의 대상 판정(createdAt)이 여기 달려 있다
  const apps = [makeApp('a1', '기존회사에이'), makeApp('a2', '기존회사비', '2026-05-02T00:00:00Z')]

  await page.route('**/companies/autocomplete*', (route) => route.fulfill(json([])))
  /* 조사는 **테스트 도중 바뀔 수 있다** — 「지금은 조사가 없지만 며칠 뒤 채워진다」가
     보드 진입 1회 노출의 핵심 시나리오다. 그래서 값을 handle 로 들고 있는다. */
  const state = { research }
  await page.route('**/applications/*/coverletter/research*', (route) =>
    route.fulfill(json(state.research)),
  )
  await page.route('**/applications', (route) => {
    if (route.request().method() === 'POST') {
      const created = makeApp(NEW_ID, '조사대상회사')
      apps.push(created)
      return route.fulfill(json(created))
    }
    return route.fulfill(json(apps))
  })
  // 스트립을 눌러 도착하는 카드 상세 (`useApplication`)
  await page.route(`**/applications/${NEW_ID}`, (route) =>
    route.fulfill(json(apps.find((a) => a.id === NEW_ID) ?? makeApp(NEW_ID, '조사대상회사'))),
  )

  // 첫 카드 축하 오버레이는 별도 경로 — 여기선 "이미 카드가 있는 유저" 로 고정된다(기존 2장)
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/board')
  await expect(page.locator('[data-card-id="a1"]')).toBeVisible()
  return state
}

const cardHeights = (page: Page) =>
  page.$$eval('[data-card-id]', (els) => els.map((el) => (el as HTMLElement).offsetHeight))

async function addCard(page: Page) {
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await page.getByText('지원 중으로 추가').click()
  // 8/28 A안 모달 — 회사 칸 placeholder 가 「어느 회사에 지원하세요?」(B 문구)로 바뀜
  await page.getByPlaceholder(/어느 회사에 지원하세요/).fill('조사대상회사')
  await page.getByRole('button', { name: '추가하기' }).click()
  await expect(page.locator(`[data-card-id="${NEW_ID}"]`)).toBeVisible()
}

test.describe('카드 추가 직후 회사 조사 스트립', () => {
  test('1) 조사 있음 — 그리드 위 스트립에 3요소 + 어느 회사인지', async ({ page }) => {
    await setup(page, RESEARCH)
    const before = await cardHeights(page)
    await addCard(page)

    const strip = page.getByRole('region', { name: '조사대상회사 회사 조사' })
    await expect(strip).toBeVisible()
    await expect(strip.getByText('어떤 회사일까요?')).toBeVisible()
    await expect(strip.getByText('분산 시스템')).toBeVisible()
    await expect(strip.getByText('도전 · 협업 · 성장')).toBeVisible()
    await expect(
      strip.getByText('국내 최대 메신저를 운영하는 플랫폼 기업이다.'),
    ).toBeVisible()
    // 어느 회사 얘기인지 스트립 안에서 알 수 있다
    await expect(strip.getByText('조사대상회사')).toBeVisible()

    // 🔴 칩 상한 5 — 6번째 키워드는 안 나온다
    await expect(strip.getByText('규제 이슈')).toHaveCount(0)
    // 🔴 첫 화면에서 뺀 항목이 새어나오지 않는다 (최근 행보·경쟁사는 카드 상세 탭에서만)
    await expect(strip.getByText('AI탭')).toHaveCount(0)
    await expect(strip.getByText('구글코리아')).toHaveCount(0)

    // 스트립은 카드 그리드보다 위에 있다 (그리드 밖)
    const stripBox = (await strip.boundingBox())!
    const cardBox = (await page.locator(`[data-card-id="a1"]`).boundingBox())!
    expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(cardBox.y)

    // 모달·화면 이동 없음 — 보드에 그대로 있다
    await expect(page).toHaveURL(/\/board$/)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // 🔴 카드 높이 무변화 — 그리드 계약 무접촉 (예전엔 118 → 230 이었다)
    const after = await cardHeights(page)
    console.log('[research-reveal 조사 있음] 카드 높이', before, '→', after)
    expect(Math.max(...after) - Math.min(...before)).toBeLessThanOrEqual(1)
    expect(Math.max(...before) - Math.min(...after)).toBeLessThanOrEqual(1)
  })

  test('1-b) 닫기 → 스트립만 사라지고 카드 높이는 그대로', async ({ page }) => {
    await setup(page, RESEARCH)
    const before = await cardHeights(page)
    await addCard(page)

    await page.getByRole('button', { name: '회사 조사 닫기' }).click()
    await expect(page.getByRole('region', { name: /회사 조사/ })).toHaveCount(0)
    expect(await cardHeights(page)).toEqual([...before, before[0]])
  })

  test('1-c) 320px — 스트립이 뜨고 가로 오버플로가 없다', async ({ page }) => {
    await setup(page, RESEARCH, 320)
    const before = await cardHeights(page)
    await addCard(page)

    const strip = page.getByRole('region', { name: '조사대상회사 회사 조사' })
    await expect(strip.getByText('어떤 회사일까요?')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    // 모바일에서도 카드는 안 커진다 (여기가 가장 아팠던 화면이다)
    const after = await cardHeights(page)
    console.log('[research-reveal 320px] 카드 높이', before, '→', after)
    expect(Math.max(...after) - Math.min(...before)).toBeLessThanOrEqual(1)
  })

  /**
   * 🔴 전역 `prefers-reduced-motion` 가드(index.css)는 animation-duration 만 0.01ms 로
   * 누르고 **delay 는 안 건드린다.** 순차 등장이 delay 로 만들어지므로, 가드가 이 연출을
   * 죽이지(=요소가 opacity 0 에 머물지) 않는지 실측한다.
   */
  test('1-d) 모션 최소화 — 3요소가 즉시 보인다 (opacity 1)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setup(page, RESEARCH)
    await addCard(page)

    const strip = page.getByRole('region', { name: '조사대상회사 회사 조사' })
    await expect(strip.getByText('어떤 회사일까요?')).toBeVisible()
    for (const text of ['어떤 회사일까요?', '도전 · 협업 · 성장']) {
      const opacity = await strip
        .getByText(text)
        .evaluate((el) => getComputedStyle(el).opacity)
      expect(opacity).toBe('1')
    }
  })

  test('4) 🔴 스트립 클릭 → 카드 상세 「회사 알아보기」 탭 + 최근 행보 타임라인', async ({ page }) => {
    await setup(page, RESEARCH)
    await addCard(page)

    const strip = page.getByRole('region', { name: '조사대상회사 회사 조사' })
    await strip.getByRole('link', { name: '조사대상회사 회사 정보 자세히 보기' }).click()

    await expect(page).toHaveURL(new RegExp(`/board/${NEW_ID}\\?tab=company$`))
    // 탭이 열려 있고 그룹이 그려진다
    await expect(page.getByRole('heading', { name: '이 회사가 원하는 사람' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '어떤 회사인가요' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '자소서에 쓸 이야기' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '이 회사 주요 키워드' })).toBeVisible()

    // 🔴 타임라인 — 날짜가 배지로 떨어지고 번호 마커는 본문에 남지 않는다
    await expect(page.getByText('2026-04-28')).toBeVisible()
    await expect(page.getByText('2026-04-30')).toBeVisible()
    await expect(
      page.getByText("발표: AI 검색 서비스 'AI탭' 베타 출시."),
    ).toBeVisible()

    // 스트립에서 5개로 잘렸던 키워드가 여기선 전부 나온다
    await expect(page.getByText('규제 이슈')).toBeVisible()
  })

  test('4-b) ×는 이동하지 않는다 — 보드에 그대로 있다', async ({ page }) => {
    await setup(page, RESEARCH)
    await addCard(page)

    await page.getByRole('button', { name: '회사 조사 닫기' }).click()
    await expect(page).toHaveURL(/\/board$/)
    await expect(page.getByRole('region', { name: /회사 조사/ })).toHaveCount(0)
  })

  /**
   * 🔴 점의 핵심은 모양이 아니라 **사라지는 조건**이다. 항상 켜져 있으면 벽지가 되고,
   * 더 나쁘게는 읽지 않은 알림처럼 읽혀 계속 거슬린다. 실브라우저에서 「떴다가 열면
   * 사라지고 새로고침해도 안 돌아온다」를 통째로 확인한다 (localStorage 라 jsdom 만으로는
   * 새로고침 경로가 진짜인지 알 수 없다).
   */
  test('5) 🔴 미열람 점 — 탭 줄에 뜨고, 한 번 열면 사라지고, 새로고침해도 안 돌아온다', async ({ page }) => {
    await setup(page, RESEARCH)
    await addCard(page)

    // 스트립이 아니라 **카드 상세로 직접** 들어간다 — 점을 보는 자리가 여기다
    await page.goto(`/board/${NEW_ID}`)

    const tab = page.getByRole('button', { name: /회사 알아보기/ })
    await expect(tab).toBeVisible()
    // 🔴 별표(★)가 아니다 — 이 화면의 별은 카드 즐겨찾기라 뜻이 겹치면 안 된다
    await expect(tab).toHaveText('회사 알아보기')
    await expect(tab).toHaveAccessibleName(/아직 안 봤어요/)
    const dot = tab.locator('span[role="img"]')
    await expect(dot).toBeVisible()
    const dotBox = (await dot.boundingBox())!
    console.log('[research-dot] 점 크기', dotBox.width, '×', dotBox.height)
    expect(dotBox.width).toBeLessThanOrEqual(8)

    await tab.click()
    await expect(page.getByRole('heading', { name: '어떤 회사인가요' })).toBeVisible()
    await expect(dot).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('button', { name: '회사 알아보기', exact: true })).toBeVisible()
    await expect(page.locator('span[role="img"]')).toHaveCount(0)
  })

  test('5-c) 320px — 점이 붙어도 탭 줄이 넘치지 않는다', async ({ page }) => {
    await setup(page, RESEARCH, 320)
    await addCard(page)
    await page.goto(`/board/${NEW_ID}`)

    await expect(page.getByRole('button', { name: /회사 알아보기/ }).locator('span[role="img"]')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    console.log('[research-dot 320px] 가로 오버플로', overflow)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('5-b) 조사 없으면 탭도 점도 없다', async ({ page }) => {
    await setup(page, null)
    await addCard(page)
    await page.goto(`/board/${NEW_ID}`)

    await expect(page.getByRole('button', { name: '전형 단계' })).toBeVisible()
    await expect(page.getByRole('button', { name: /회사 알아보기/ })).toHaveCount(0)
    await expect(page.locator('span[role="img"]')).toHaveCount(0)
  })

  /**
   * 🔴 재배치의 핵심 단언은 **좌표**다 — DOM 순서만으로는 `lg:grid` 열 배치 때문에
   * "위에 있다"가 보장되지 않는다. 실브라우저에서 y 좌표와 폭을 직접 잰다.
   *
   * 2026-08-22 상단 재구성으로 읽는 순서가 **명함(사실) → 주요 키워드(성격) →
   * 원하는 사람(나에게) → 2열(배경)** 이 됐다. 그 순서를 좌표로 잠근다.
   */
  test('6) 🔴 상단 순서 — 명함 → 주요 키워드 → 원하는 사람 → 2열 (전폭) + 320px 오버플로 0', async ({
    page,
  }) => {
    await setup(page, RESEARCH_WANTED)
    await addCard(page)
    await page.goto(`/board/${NEW_ID}?tab=company`)

    const wanted = page.getByRole('heading', { name: '이 회사가 원하는 사람' })
    await expect(wanted).toBeVisible()
    // 🔴 명함에서 회사명 h2 가 사라졌다 — 남은 손잡이는 aria-label 뿐이고,
    //    페이지 헤더의 h1 회사명은 그대로다 (중복이 헤더 쪽만 남았다는 실측)
    const nameplate = page.getByRole('region', { name: '회사 기본 정보' })
    await expect(page.getByRole('heading', { name: '조사대상회사', level: 2 })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '조사대상회사', level: 1 })).toBeVisible()
    await expect(nameplate.getByText('인터넷 플랫폼')).toBeVisible()

    const about = page.getByRole('heading', { name: '어떤 회사인가요' })
    const forCl = page.getByRole('heading', { name: '자소서에 쓸 이야기' })
    const keywords = page.getByRole('heading', { name: '이 회사 주요 키워드' })
    // 개명 — 옛 이름은 화면 어디에도 없다
    await expect(page.getByRole('heading', { name: '예상 면접 키워드' })).toHaveCount(0)

    const box = async (l: typeof wanted) => (await l.boundingBox())!
    const [nameplateBox, kwBox, wantedBox, aboutBox, forClBox] = await Promise.all(
      [nameplate, keywords, wanted, about, forCl].map(box),
    )
    console.log('[상단 순서] y', {
      명함: nameplateBox.y,
      키워드: kwBox.y,
      원하는사람: wantedBox.y,
      어떤회사: aboutBox.y,
      자소서: forClBox.y,
    })
    console.log('[명함] 높이', nameplateBox.height)
    // 🔴 명함 → 키워드 → 원하는 사람 → 2열
    expect(kwBox.y).toBeGreaterThan(nameplateBox.y + nameplateBox.height - 1)
    expect(wantedBox.y).toBeGreaterThan(kwBox.y)
    for (const later of [aboutBox, forClBox]) {
      expect(wantedBox.y).toBeLessThan(later.y)
    }
    // 🔴 키워드는 「원하는 사람」 **안이 아니다** — 그 그룹 밖·위에 별도 블록으로 선다
    const wantedSection = page.locator('section', { has: wanted })
    await expect(wantedSection.getByRole('heading', { name: '이 회사 주요 키워드' })).toHaveCount(0)
    // 🔴 **전폭** — 2열의 왼쪽(300px)보다 훨씬 넓고, 두 열을 합친 만큼이다.
    //    명함·키워드도 같은 전폭 (상단 3블록이 한 기둥이다)
    const kwWidth = (await page.locator('section', { has: keywords }).boundingBox())!.width
    const wantedWidth = (await page.locator('section', { has: wanted }).boundingBox())!.width
    const aboutWidth = (await page.locator('section', { has: about }).boundingBox())!.width
    const forClWidth = (await page.locator('section', { has: forCl }).boundingBox())!.width
    console.log('[상단 블록] 폭', {
      명함: nameplateBox.width,
      키워드: kwWidth,
      원하는사람: wantedWidth,
      어떤회사: aboutWidth,
    })
    expect(wantedWidth).toBeGreaterThan(aboutWidth + forClWidth)
    expect(kwWidth).toBe(wantedWidth)
    expect(nameplateBox.width).toBe(wantedWidth)

    // 데스크탑에서 핵심가치·인재상은 **나란히** (같은 줄, 긴 쪽이 왼쪽),
    // 직무 정보는 그 아래 전폭 문단
    const valuesBox = (await page.getByRole('heading', { name: '핵심가치' }).boundingBox())!
    const talentBox = (await page.getByRole('heading', { name: '인재상' }).boundingBox())!
    const jobBox = (await page.getByRole('heading', { name: '직무 정보' }).boundingBox())!
    expect(Math.abs(valuesBox.y - talentBox.y)).toBeLessThanOrEqual(2)
    expect(talentBox.x).toBeGreaterThan(valuesBox.x)
    expect(jobBox.y).toBeGreaterThan(talentBox.y)
    expect(Math.abs(jobBox.x - valuesBox.x)).toBeLessThanOrEqual(2)

    // 🔴 320px — 세로로 쌓이고 가로 오버플로 0
    await page.setViewportSize({ width: 320, height: 900 })
    await expect(wanted).toBeVisible()
    const narrowValues = (await page.getByRole('heading', { name: '핵심가치' }).boundingBox())!
    const narrowTalent = (await page.getByRole('heading', { name: '인재상' }).boundingBox())!
    expect(narrowTalent.y).toBeGreaterThan(narrowValues.y)
    // 좁은 화면에서도 상단 순서는 그대로다 (명함 → 키워드 → 원하는 사람)
    const [nx, kx, wx] = await Promise.all(
      [nameplate, keywords, wanted].map(async (l) => (await l.boundingBox())!.y),
    )
    console.log('[상단 순서 320px] y', { 명함: nx, 키워드: kx, 원하는사람: wx })
    expect(kx).toBeGreaterThan(nx)
    expect(wx).toBeGreaterThan(kx)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    console.log('[상단 재구성 320px] 가로 오버플로', overflow)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  /**
   * 🔴 명함이 **사라지는 경로** — 실브라우저에서만 "빈 상자가 안 남는다"를 확인할 수 있다.
   * `companyProfile` 은 실측 커버리지가 100% 가 아니라 이 경로가 실제로 돈다.
   */
  test('6-b) 🔴 companyProfile 없음 — 명함 블록째 없고 키워드가 맨 위에 붙는다', async ({ page }) => {
    await setup(page, RESEARCH) // companyProfile 없는 픽스처
    await addCard(page)
    await page.goto(`/board/${NEW_ID}?tab=company`)

    const keywords = page.getByRole('heading', { name: '이 회사 주요 키워드' })
    await expect(keywords).toBeVisible()
    await expect(page.getByRole('region', { name: '회사 기본 정보' })).toHaveCount(0)

    // 키워드 블록 위에는 탭 줄뿐 — 빈 상자도, 죽은 여백도 없다
    const kwBox = (await page.locator('section', { has: keywords }).boundingBox())!
    const tabRow = (await page.getByRole('button', { name: '회사 알아보기' }).boundingBox())!
    const gap = kwBox.y - (tabRow.y + tabRow.height)
    console.log('[명함 없음] 탭 줄 ~ 키워드 간격', gap)
    expect(gap).toBeLessThanOrEqual(28) // 탭 줄 패딩(4) + mb-4(16) 수준
  })

  test('2) 조사 없음 — 스트립 0 · 카드 높이 그대로 (레이아웃 이동 0)', async ({ page }) => {
    await setup(page, null)
    const before = await cardHeights(page)
    await addCard(page)

    await expect(page.getByText('어떤 회사일까요?')).toHaveCount(0)
    await expect(page.getByRole('region', { name: /회사 조사/ })).toHaveCount(0)

    const after = await cardHeights(page)
    console.log('[research-reveal 조사 없음] 카드 높이', before, '→', after)
    expect(after).toHaveLength(before.length + 1)
    expect(Math.max(...after) - Math.min(...before)).toBeLessThanOrEqual(1)
    expect(Math.max(...before) - Math.min(...after)).toBeLessThanOrEqual(1)
  })
})

/**
 * 🔴 **기존 사용자를 위한 보드 진입 1회 노출.**
 *
 * 스트립은 카드를 만드는 순간에만 뜬다 — 이미 카드를 만들어 둔 사람은 그 순간을 영영 못 만난다.
 * 그래서 보드에 들어올 때 **가장 최근 카드**의 조사를 한 번 보여주고, 그때만 한 줄 안내를 붙인다.
 *
 * 실브라우저로만 확인되는 것: 기억이 **localStorage** 라 「새로고침해도 안 돌아온다」·「조사가
 * 없던 날은 기회가 남아 다음 방문에 뜬다」가 jsdom 에서는 진짜인지 알 수 없다.
 */
test.describe('보드 진입 1회 노출 (기존 사용자)', () => {
  const GUIDE = '이제 카드에서 이런 회사 정보를 볼 수 있어요'
  const seenFlag = (page: Page) =>
    page.evaluate((k) => localStorage.getItem(k), SEEN_KEY)

  test('7) 🔴 진입하면 가장 최근 카드로 1회 뜨고 안내 줄이 붙는다 — 새로고침하면 안 뜬다', async ({
    page,
  }) => {
    await setup(page, RESEARCH, 1280, { intro: true })

    // 🔴 대상은 **가장 최근에 만든 카드 하나** (a2). 오래된 카드가 아니다
    const strip = page.getByRole('region', { name: '기존회사비 회사 조사' })
    await expect(strip).toBeVisible()
    await expect(page.getByRole('region', { name: '기존회사에이 회사 조사' })).toHaveCount(0)

    // 🔴 이 경로에만 붙는 한 줄 — "이게 왜 지금?" 에 먼저 답한다
    await expect(strip.getByText(GUIDE)).toBeVisible()
    await expect(strip.getByText('분산 시스템')).toBeVisible()
    await expect(strip.getByText('도전 · 협업 · 성장')).toBeVisible()

    // 카드 그리드보다 위 (그리드 계약 무접촉 — 카드가 커지지 않는다)
    const stripBox = (await strip.boundingBox())!
    const cardBox = (await page.locator('[data-card-id="a1"]').boundingBox())!
    expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(cardBox.y)

    await expect.poll(() => seenFlag(page)).not.toBeNull()

    // 새로고침 = 재방문. 기회는 이미 소진됐다
    await page.reload()
    await expect(page.locator('[data-card-id="a1"]')).toBeVisible()
    await expect(page.getByRole('region', { name: /회사 조사/ })).toHaveCount(0)
    await expect(page.getByText(GUIDE)).toHaveCount(0)
  })

  test('8) 🔴 조사가 없으면 안 뜨고 **기회가 남는다** — 채워진 뒤 다시 들어오면 그때 뜬다', async ({
    page,
  }) => {
    const state = await setup(page, null, 1280, { intro: true })

    // 조사 조회는 실제로 일어났고(= 시도했고), 그런데도 아무것도 안 떴다
    const asked = page.waitForResponse((r) => r.url().includes('/coverletter/research'))
    await page.reload()
    await asked
    await expect(page.locator('[data-card-id="a1"]')).toBeVisible()
    await expect(page.getByRole('region', { name: /회사 조사/ })).toHaveCount(0)
    // 🔴 소진 조건은 「렌더됐다」이지 「시도했다」가 아니다 — 기회가 그대로 남는다
    expect(await seenFlag(page)).toBeNull()

    // 며칠 뒤 그 회사 조사가 채워졌다
    state.research = RESEARCH
    await page.reload()

    const strip = page.getByRole('region', { name: '기존회사비 회사 조사' })
    await expect(strip).toBeVisible()
    await expect(strip.getByText(GUIDE)).toBeVisible()
    await expect.poll(() => seenFlag(page)).not.toBeNull()
  })
})
