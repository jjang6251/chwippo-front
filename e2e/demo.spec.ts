import { test, expect, type Page } from '@playwright/test'

/**
 * 데모 모드 전면 개편 E2E.
 *
 * 핵심 증명 포인트: 데모는 백엔드(:3000) 로 요청을 단 한 건도 보내지 않는다.
 *  - page.route('http://localhost:3000/**') 로 백엔드행 요청을 잡아 카운트 → 모든 시나리오 후 0 단언.
 *    (주의: 'api' 를 포함하는 glob 패턴 금지 — Vite 소스 파일 경로까지 매칭되는 사고 방지. 오리진 기준으로 잡는다.)
 *  - console error 0 (fail-loud console.error = 미등록 GET 이므로 이게 뜨면 데모에 구멍이 있다는 신호)
 *    · 이미지 로드 실패(favicon 등)는 앱 오류가 아니므로 제외.
 */

interface Guard {
  backendHits: () => number
  consoleErrors: () => string[]
}

async function attachGuard(page: Page): Promise<Guard> {
  let hits = 0
  const errors: string[] = []
  await page.route('http://localhost:3000/**', (route) => {
    hits += 1
    route.abort()
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return { backendHits: () => hits, consoleErrors: () => errors }
}

const DEMO_PAGES: { path: string; expect: RegExp }[] = [
  { path: '/demo/dashboard', expect: /회고/ },
  { path: '/demo/board', expect: /카카오/ },
  { path: '/demo/board/demo-a1', expect: /전형 단계/ },
  { path: '/demo/board/demo-a1/steps/demo-a1-s2', expect: /준비 노트/ },
  { path: '/demo/calendar', expect: /카카오|토스|삼성전자/ },
  { path: '/demo/activity', expect: /캡스톤|인턴|기록/ },
  { path: '/demo/activity/manage', expect: /캡스톤|내 활동|활동/ },
  { path: '/demo/coverletters', expect: /자소서|자기소개서/ },
  // 자소서 문서 풀페이지 — 채팅 이력(messages) GET 이 미등록이면 console error 로 잡힌다
  { path: '/demo/board/demo-a1/coverletter', expect: /자소서/ },
  { path: '/demo/myinfo', expect: /내 정보 창고/ },
]

test.describe('데모 모드', () => {
  test('데모 진입(/demo) → 홈=캘린더로 리다이렉트 (본 서비스와 동일)', async ({ page }) => {
    await page.goto('/demo')
    await expect(page).toHaveURL(/\/demo\/calendar$/)
  })

  test('10개 데모 페이지 순회 — 백지 아님 + 백엔드 요청 0 + console error 0', async ({ page }) => {
    const guard = await attachGuard(page)

    for (const p of DEMO_PAGES) {
      await page.goto(p.path)
      // 크래시 fallback 이 아닌 실제 콘텐츠가 보여야 한다
      await expect(page.getByText('화면을 불러오지 못했어요')).toHaveCount(0)
      await expect(page.getByText(p.expect).first()).toBeVisible()
    }

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('보드 — 업종 다양화 신규 회사 노출', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/board')
    // IT 일변도 → 제조(현대자동차) 등 신규 업종 카드가 보드에 노출
    await expect(page.locator('main').getByText('현대자동차').first()).toBeVisible()

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('노드(전형 스텝) 이동 — 화면 즉시 반영', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/board/demo-a1')

    // demo-a1 현재 스텝 = 1차 기술면접(index 2). 코딩테스트·과제(index 1, 완료) 노드를 눌러 현재를 이동.
    await page.getByRole('button', { name: '코딩테스트·과제 (완료)' }).click()
    await expect(
      page.getByRole('button', { name: '코딩테스트·과제 (현재)' }),
    ).toBeVisible()

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('카드 상세 — 공고 요건 카드 노출 + 펼치면 더미 고지', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/board/demo-a1')

    // 접힘 헤더 (요건 N개 정리됨) — 회사 메모 아래 공고 요건 섹션
    const toggle = page.getByRole('button', { name: /공고 요건/ })
    await expect(toggle).toBeVisible()
    await toggle.click()

    // 펼치면 요건 표시 + 데모 전용 더미 고지
    await expect(page.getByText('예시용 더미 공고 요건이에요 — 실제 채용 공고가 아닙니다')).toBeVisible()

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('체크리스트 항목 추가 — 인메모리 반영', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/board/demo-a1/steps/demo-a1-s2')

    const input = page.getByPlaceholder('항목 추가 후 Enter')
    await input.fill('E2E 체크 항목')
    await input.press('Enter')
    await expect(page.getByText('E2E 체크 항목')).toBeVisible()

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('캘린더 데일리 노트 추가 — 인메모리 반영', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/calendar')

    // 선택된 날(기본 오늘) 패널의 상시 노출 고스트 입력행(placeholder "할 일 추가")에 입력 후 Enter
    const input = page.getByPlaceholder('할 일 추가')
    await input.first().fill('E2E 데모 할 일')
    await input.first().press('Enter')
    // 데모 store 의 getDailyNotes 는 날짜/범위 파라미터를 무시해 오늘/어제 조회에 함께 잡힘 →
    // 오늘 할 일 + 이월 후보로 이중 렌더될 수 있어 first() 로 스코프 (인메모리 반영 확인이 목적)
    await expect(page.getByText('E2E 데모 할 일').first()).toBeVisible()

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('차단 mutation(자소서 문항 추가) — 가입 모달 노출', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/board/demo-a1')

    // 본문(main) 안의 '자소서' 탭 — 사이드바 '자소서'(링크)와 구분하려 main 으로 스코프
    const main = page.locator('main')
    await main.getByRole('button', { name: '자소서' }).click()
    await main.getByRole('button', { name: '+ 지원 동기' }).click()

    await expect(page.getByText('데모에서는 저장되지 않아요')).toBeVisible()

    // 차단은 서버 요청 없이 모달만 — 백엔드 히트 0 유지
    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('자소서 카드 클릭 → 문서 풀페이지 (데모 유지)', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/coverletters')

    // 카카오(demo-a1) 카드 클릭 → /demo/board/demo-a1/coverletter 문서 페이지
    await page.getByRole('link', { name: /카카오/ }).first().click()

    await expect(page).toHaveURL(/\/demo\/board\/demo-a1\/coverletter/)
    await expect(page.getByText('화면을 불러오지 못했어요')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /카카오/ }).first()).toBeVisible()

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
    // 사이드탭 하이라이트 = 자소서 (지원현황보드 아님) — aria-current 로 판정
    await expect(page.getByRole('link', { name: /자소서/ }).first()).toHaveAttribute('aria-current', 'page')
    // AI 챗 영역 데모 안내 — 실서비스 가치 설명 문구
    await expect(page.getByText(/활동 일지.*내 정보 창고.*초안 작성/s).first()).toBeVisible()
  })

  test('자소서 모아보기 — 전 카드 노출 + 진행률 상태 다양성', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/coverletters')

    // 진행중 탭 기본 — 여러 회사 카드 노출
    await expect(page.locator('main').getByText('카카오').first()).toBeVisible()
    // 완성 카드(🎉 모든 문항 작성 완료)와 진행 중 카드(다음 미작성)가 함께 = 상태 다양성
    await expect(page.getByText('🎉 모든 문항 작성 완료').first()).toBeVisible()
    await expect(page.getByText('다음 미작성').first()).toBeVisible()

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('자소서 doc 풀페이지 — 대표 카드(삼성전자) 렌더 (문항·답변)', async ({ page }) => {
    const guard = await attachGuard(page)
    await page.goto('/demo/board/demo-a3/coverletter')

    await expect(page.getByText('화면을 불러오지 못했어요')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /삼성전자/ }).first()).toBeVisible()

    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })

  test('데모 이탈 금지 — 주요 내부 이동 후 URL 이 /demo/ 유지', async ({ page }) => {
    const guard = await attachGuard(page)

    // 클릭은 본문(main)으로 스코프 — 상단 데모 배너의 "무료로 시작하기" 버튼과 구분
    // 보드 카드 → 카드 상세
    await page.goto('/demo/board')
    await page.locator('main').getByText('카카오').first().click()
    await expect(page).toHaveURL(/\/demo\/board\//)

    // 캘린더 임박 일정/아젠다 → 카드·스텝 상세
    await page.goto('/demo/calendar')
    await page.locator('main').getByText('카카오').first().click()
    await expect(page).toHaveURL(/\/demo\//)

    // 회고(대시보드) "얻은 것 목록"(쿠팡 회고) → 카드 상세
    await page.goto('/demo/dashboard')
    await page.locator('main').getByText('쿠팡').first().click()
    await expect(page).toHaveURL(/\/demo\/board\//)

    // 어떤 클릭도 랜딩(/)·실서비스 라우트로 탈출하지 않았다
    expect(guard.backendHits()).toBe(0)
    expect(guard.consoleErrors()).toEqual([])
  })
  test('내정보 자격증 수정 모달 — 자동완성 포커스에도 크래시 없음', async ({ page }) => {
    const backendHits: string[] = []
    await page.route('http://localhost:3000/**', (route) => {
      backendHits.push(route.request().url())
      return route.abort()
    })
    await page.goto('/demo/myinfo')
    await expect(page.getByRole('heading', { name: '내 정보 창고' })).toBeVisible()
    // 첫 방문은 전 섹션 접힘 — 자격증 섹션 헤더(버튼) 펼치기 ('어학 자격증' 오매칭 방지)
    await page.getByRole('button', { name: '📜 자격증', exact: true }).click()
    // 자격증 항목 클릭 = 펼침 토글 → ✏️ 편집 버튼이 수정 모달
    const certRow = page.getByRole('button', { name: /정보처리기사/ })
    await certRow.getByRole('button', { name: '편집' }).click()
    const nameInput = page.getByRole('dialog').getByRole('combobox').first()
    await nameInput.click()
    await nameInput.fill('정보처리')
    // 데모 안내 문구 노출 (검색 결과 없음 아님) + ErrorBoundary 폴백 없음
    await expect(page.getByText(/가입하면 자격증 정보가 자동완성/)).toBeVisible()
    await expect(page.getByText('화면을 불러오지 못했어요')).toHaveCount(0)
    expect(backendHits).toEqual([])
  })

  test('전 데모 페이지 링크 href 감사 — 전부 /demo 또는 허용 퇴장 경로', async ({ page }) => {
    const ALLOWED = /^(\/demo(\/|$|\?)|\/$|\/login|\/privacy|\/terms|https?:|mailto:|#)/
    for (const p of DEMO_PAGES) {
      await page.goto(p.path)
      await page.waitForTimeout(400)
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') ?? ''))
      const bad = hrefs.filter((h) => h && !ALLOWED.test(h))
      expect(bad, `${p.path} 에서 데모 탈출 href 발견`).toEqual([])
    }
  })

  test('escape 안전망 — 내 활동 로그 클릭이 랜딩으로 새지 않음', async ({ page }) => {
    await page.goto('/demo/activity/manage')
    await page.getByText('팀 회의에서 서버 아키텍처').first().click()
    await page.waitForTimeout(1200)
    // 데모 잔류 (가입 모달 노출) — 랜딩(/) 금지
    expect(page.url()).toContain('/demo')
    await expect(page.getByText('데모에서는 저장되지 않아요')).toBeVisible()
  })

})
