/**
 * `/myinfo` — **로딩 자리와 실제 크기가 같은가** (2026-08-11).
 *
 * 🔴 진척도 카드는 로딩 자리가 `h-28`(112px)인데 실제는 118px, 저장용량 바는 38px 인데
 * 실제는 56px 이었다. 데이터가 도착하는 순간 **합쳐서 24px 자라며 아래 화면 전체를 밀어냈다** —
 * 누르려던 버튼이 그 순간 아래로 도망간다. 실측 CLS 0.179 (「개선 필요」 구간).
 *
 * Clarity 실사용자 기록에서도 /myinfo 세션 CLS 가 0.22~0.4 로 나왔다 — 실제로 겪고 있었다.
 *
 * jsdom 은 레이아웃을 안 하므로 이 계약은 **브라우저에서만** 잴 수 있다.
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/auth'

const json = (d: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d }) })

test('로딩 자리가 실제 카드와 같은 높이다', async ({ page }) => {
  await page.route('http://localhost:3000/**', (r) => {
    const u = new URL(r.request().url()).pathname
    if (u.includes('coin-balance')) return r.fulfill(json({ balance: 100, monthlyCoinLimit: 100, tier: 'free', nextResetAt: '2026-09-01T00:00:00Z' }))
    if (u.includes('streak')) return r.fulfill(json({ streak: { current: 5 } }))
    if (u.includes('unread-count')) return r.fulfill(json({ count: 0 }))
    if (u.includes('announcement')) return r.fulfill(json(null))
    if (u.includes('storage-usage')) return new Promise((res) => setTimeout(() => res(r.fulfill(json({ usedMB: 12.3, limitMB: 100, percentage: 12 }))), 600))
    return new Promise((res) => setTimeout(() => res(r.fulfill(json([]))), 600))
  })
  await mockAuth(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:5173/myinfo', { waitUntil: 'domcontentloaded' })

  const heights = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('main .mb-6.space-y-3 > *')).map((e) =>
        Math.round(e.getBoundingClientRect().height),
      ),
    )

  await page.waitForTimeout(250)
  const loading = await heights()
  await page.waitForTimeout(1500)
  const loaded = await heights()

  expect(loading.length, '로딩 중 카드가 안 보인다').toBe(2)
  expect(loaded.length).toBe(2)
  // 자리를 미리 잡아두지 않으면 데이터 도착 순간 아래가 통째로 밀린다
  expect(loading, `로딩 자리 ${loading} ≠ 실제 ${loaded}`).toEqual(loaded)
})
