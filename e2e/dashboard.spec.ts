/**
 * 회고(회고=성장) 페이지 E2E — 구 대시보드.
 *
 * 캘린더 UX 재구성으로 홈은 /calendar 로 이동하고, /dashboard 는
 * "지난 달보다 얼마나 성장했는지 돌아보는" 회고 페이지로 강등됐다.
 * D-day 목록·오늘 할 일은 캘린더로 이관 → 이 페이지에서는 검증하지 않는다.
 */
import { test, expect } from '@playwright/test'
import { mockAuth, TEST_USER } from './helpers/auth'

const STATS = { total: 5, inProgress: 3, interviewsAttended: 2, passed: 1 }

const STREAK = {
  streak: { current: 0, lastActivityDate: null },
  heatmap: [],
  statusDistribution: [],
}

const GROWTH = {
  monthlyComparison: {
    currentYearMonth: '2026-07',
    previousYearMonth: '2026-06',
    applications: { current: 0, previous: 0, delta: 0 },
    activityLogs: { current: 0, previous: 0, delta: 0 },
    reflections: { current: 0, previous: 0, delta: 0 },
  },
  funnel: { total: 0, reachedInterview: 0, passed: 0 },
  insights: { mostActiveWeekday: null, topJobCategory: null },
  milestoneCounts: {
    applications: 0,
    reachedInterview: 0,
    passed: 0,
    activityLogs: 0,
    reflections: 0,
  },
}

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data }),
})

async function mockDashboardApis(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page)
  await page.route('**/dashboard/stats', (r) => r.fulfill(json(STATS)))
  await page.route('**/dashboard/streak', (r) => r.fulfill(json(STREAK)))
  await page.route('**/dashboard/growth-metrics', (r) => r.fulfill(json(GROWTH)))
  await page.route('**/dashboard/interview-review', (r) => r.fulfill(json([])))
  await page.route('**/applications', (r) => r.fulfill(json([])))
}

test.describe('회고 페이지', () => {
  test('닉네임이 새로고침 없이 즉시 표시됨', async ({ page }) => {
    await mockDashboardApis(page)
    await page.goto('/dashboard')

    // AuthGuard가 refresh로 유저 세팅 후 닉네임 표시 (헤더 성장 문구에 포함)
    await expect(page.getByText(TEST_USER.nickname, { exact: false })).toBeVisible()
  })

  test('회고 페이지 정체성 — "회고" 헤더 + 성장 문구 표시', async ({ page }) => {
    await mockDashboardApis(page)
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /회고/ })).toBeVisible()
    await expect(page.getByText(/지난 달보다 얼마나 성장/)).toBeVisible()
  })

  test('통계 4개 KPI 카드 — 지원·진행중·면접·합격 라벨 표시', async ({ page }) => {
    await mockDashboardApis(page)
    await page.goto('/dashboard')

    await expect(page.getByText('지원한 회사')).toBeVisible()
    await expect(page.getByText('진행 중')).toBeVisible()
    await expect(page.getByText('면접 본 횟수')).toBeVisible()
    await expect(page.getByText('합격', { exact: true })).toBeVisible()
  })

  test('통계 카드 값이 mock 데이터 반영 (지원 5)', async ({ page }) => {
    await mockDashboardApis(page)
    await page.goto('/dashboard')

    // "지원한 회사" 카드 내부의 값(5)이 표시됨 — 카드 컨테이너로 스코프
    const totalCard = page
      .locator('div', { has: page.getByText('지원한 회사') })
      .filter({ hasText: '5' })
      .first()
    await expect(totalCard).toBeVisible()
  })
})
