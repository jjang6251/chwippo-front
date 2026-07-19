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

  // 캘린더 UX 재구성 — 홈 = /calendar (대시보드는 회고 페이지로 강등). 로그인 상태 랜딩 진입 시 /calendar 로 이동.
  test('로그인 상태에서 / 접속 시 /calendar로 이동', async ({ page }) => {
    await mockAuth(page)
    await page.goto('/')
    await expect(page).toHaveURL(/\/calendar/)
  })
})
