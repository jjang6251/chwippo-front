import { test, expect } from '@playwright/test'

/**
 * 내정보 창고 모바일 섹션 칩 바 — sticky 오프셋의 웹/네이티브 분기 회귀 방어.
 *
 * 웹 모바일: 상단 MobileHeader(h-12) 아래 붙어야 함 → top 48px.
 * 네이티브(WebView, ?native=1): 웹 헤더가 숨고 네이티브 헤더가 대체 → top 0.
 * top-12 를 고정하면 앱에서 칩 바가 상단에서 48px 떠서 스크롤됨 (2026-07-19 CEO 실기 발견).
 */
test.use({ viewport: { width: 375, height: 700 } })

const chipBar = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: '섹션 바로가기' })

test.describe('내정보 칩 바 sticky 오프셋', () => {
  test('웹 모바일 → top 48px (헤더 아래)', async ({ page }) => {
    await page.goto('/demo/myinfo')
    await expect(chipBar(page)).toBeVisible()
    const top = await chipBar(page).evaluate((el) => getComputedStyle(el).top)
    expect(top).toBe('48px')
  })

  test('네이티브 모드(?native=1) → top 0 (네이티브 헤더가 대체)', async ({ page }) => {
    await page.goto('/demo/myinfo?native=1')
    await expect(chipBar(page)).toBeVisible()
    const top = await chipBar(page).evaluate((el) => getComputedStyle(el).top)
    expect(top).toBe('0px')
  })
})
