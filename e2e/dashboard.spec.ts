import { test, expect } from '@playwright/test'
import { mockAuth, TEST_USER } from './helpers/auth'

async function mockDashboardApis(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page)
  await page.route('**/dashboard/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { total: 5, interviews: 2, passed: 1 },
      }),
    })
  )
  await page.route('**/dashboard/dday', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { type: 'deadline', applicationId: 'app-1', companyName: '라인', stepName: null, date: '2026-05-10', dday: 3 },
          { type: 'interview', applicationId: 'app-2', companyName: '토스', stepName: '1차 면접', date: '2026-05-14', dday: 7 },
        ],
      }),
    })
  )
  await page.route('http://localhost:3000/todos**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'todo-1', content: '자기소개서 작성', date: new Date().toISOString().slice(0, 10), isDone: false },
        ],
      }),
    })
  )
  await page.route('**/myinfo/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null }),
    })
  )
}

test.describe('대시보드', () => {
  test('닉네임이 새로고침 없이 즉시 표시됨', async ({ page }) => {
    await mockDashboardApis(page)
    await page.goto('/dashboard')

    // AuthGuard가 refresh로 유저 세팅 후 닉네임 표시
    await expect(page.getByText(TEST_USER.nickname)).toBeVisible()
  })

  test('통계 카드 3개 — 지원수·면접중·합격수 표시', async ({ page }) => {
    await mockDashboardApis(page)
    await page.goto('/dashboard')

    await expect(page.getByText('5', { exact: true })).toBeVisible()  // 전체 지원수
    await expect(page.getByText('2', { exact: true })).toBeVisible()  // 면접 진행중
    await expect(page.getByText('1', { exact: true })).toBeVisible()  // 최종 합격
  })

  test('D-day 목록에 라인·토스 표시', async ({ page }) => {
    await mockDashboardApis(page)
    await page.goto('/dashboard')

    await expect(page.getByText('라인')).toBeVisible()
    await expect(page.getByText('토스')).toBeVisible()
  })

  test('오늘 할 일 항목 표시', async ({ page }) => {
    await mockDashboardApis(page)
    await page.goto('/dashboard')

    await expect(page.getByText('자기소개서 작성')).toBeVisible()
  })
})
