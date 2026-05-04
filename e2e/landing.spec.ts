import { test, expect } from '@playwright/test'
import { mockAuth, mockAuthFail } from './helpers/auth'

test.describe('랜딩 페이지', () => {
  test('비로그인 상태에서 Hero, 기능 소개, CTA 표시', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/')

    await expect(page.getByText('치뽀').first()).toBeVisible()
    // Hero 슬로건
    await expect(page.getByText(/취업 준비/).first()).toBeVisible()
    // 카카오 로그인 CTA 버튼
    await expect(page.getByText(/카카오로 무료 시작/).first()).toBeVisible()
  })

  test('로그인 상태에서 / 접속 시 /dashboard로 이동', async ({ page }) => {
    await mockAuth(page)
    await page.route('**/dashboard/stats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { total: 0, interviews: 0, passed: 0 } }) })
    )
    await page.route('**/dashboard/dday', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    )
    await page.route('http://localhost:3000/todos**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    )
    await page.route('**/myinfo/profile', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) })
    )
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
