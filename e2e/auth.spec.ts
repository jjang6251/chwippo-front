import { test, expect } from '@playwright/test'
import { mockAuth, mockAuthFail } from './helpers/auth'

test.describe('인증 흐름', () => {
  // 캘린더 UX 재구성 이후: 비로그인 보호 라우트 접근 시 AuthGuard 가 랜딩(/)으로 되돌린다.
  // (구 스펙은 /login 기대 — 현재 제품은 랜딩으로 통일)
  test('비로그인 상태에서 /dashboard 접근 시 랜딩(/)으로 리다이렉트', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL('http://localhost:5173/')
  })

  test('비로그인 상태에서 /board 접근 시 랜딩(/)으로 리다이렉트', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/board')
    await expect(page).toHaveURL('http://localhost:5173/')
  })

  test('비로그인 상태에서 /calendar 접근 시 랜딩(/)으로 리다이렉트', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/calendar')
    await expect(page).toHaveURL('http://localhost:5173/')
  })

  test('로그인 페이지에 카카오 로그인 버튼 표시', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/login')
    await expect(page.getByText(/카카오/).first()).toBeVisible()
  })

  // 홈 = /calendar 로 전환됨 (대시보드는 "회고" 페이지로 강등). 로그인 상태 /login 진입 시 /calendar 로 이동.
  test('로그인 상태에서 /login 접근 시 /calendar로 이동', async ({ page }) => {
    await mockAuth(page)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/calendar/)
  })
})
