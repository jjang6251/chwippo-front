import { test, expect } from '@playwright/test'
import { mockAuth, mockAuthFail } from './helpers/auth'

test.describe('인증 흐름', () => {
  test('비로그인 상태에서 /dashboard 접근 시 /login으로 리다이렉트', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('비로그인 상태에서 /board 접근 시 /login으로 리다이렉트', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/board')
    await expect(page).toHaveURL(/\/login/)
  })

  test('비로그인 상태에서 /calendar 접근 시 /login으로 리다이렉트', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/calendar')
    await expect(page).toHaveURL(/\/login/)
  })

  test('로그인 페이지에 카카오 로그인 버튼 표시', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/login')
    await expect(page.getByText(/카카오/).first()).toBeVisible()
  })

  test('로그인 상태에서 /login 접근 시 /dashboard로 이동', async ({ page }) => {
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
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
