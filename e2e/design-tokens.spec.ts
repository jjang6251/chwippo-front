/**
 * 의미 토큰이 **실제로 그려지는가**.
 *
 * 🔴 **왜 e2e 인가** (2026-08-11). `line`·`line-strong` 은 오랫동안 `borderColor`·`divideColor`
 * 에만 정의돼 있어서, `bg-line` 은 **클래스만 쓰이고 CSS 가 생성되지 않았다** — 바텀시트 손잡이·
 * 대시보드 스켈레톤·진행바 트랙·캘린더 점 22곳이 통째로 투명이었다. 코드는 멀쩡해 보이고
 * 타입도 lint 도 통과한다. **없는 클래스를 쓰는 건 조용히 아무 일도 안 하기 때문이다.**
 *
 * 유닛 테스트로는 못 잡는다 — jsdom 은 CSS 를 적용하지 않아 `className` 에 문자열이 있는지만
 * 볼 수 있고, 그 클래스가 **색을 만드는지**는 실제 브라우저에서만 알 수 있다.
 */
import { test, expect } from '@playwright/test'

const TOKENS = ['bg-line', 'bg-line-strong', 'bg-surface-2', 'bg-card-solid']

test('배경 의미 토큰이 실제 색을 만든다', async ({ page }) => {
  await page.goto('http://localhost:5173/demo/calendar', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const missing = await page.evaluate((tokens: string[]) => {
    const probe = document.createElement('div')
    document.body.appendChild(probe)
    const bad: string[] = []
    for (const t of tokens) {
      probe.className = t
      const bg = getComputedStyle(probe).backgroundColor
      if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bad.push(t)
    }
    probe.remove()
    return bad
  }, TOKENS)

  expect(missing, `배경색을 만들지 못하는 토큰: ${missing.join(', ')}`).toEqual([])
})

test('🔴 화면에 실제로 쓰인 bg-line 요소가 투명하지 않다', async ({ page }) => {
  await page.goto('http://localhost:5173/demo/calendar', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const transparent = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[class*="bg-line"]'))
      .filter((e) => {
        const bg = getComputedStyle(e).backgroundColor
        return bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent'
      })
      .map((e) => String(e.className).slice(0, 60)),
  )
  expect(transparent, `투명하게 그려진 요소: ${transparent.join(' / ')}`).toEqual([])
})
