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

// `bg-accent-fill` — 2026-08-29 신규(NEW 알약). tailwind.config 등록을 빠뜨리면 알약이 투명해진다
const TOKENS = [
  'bg-line',
  'bg-line-strong',
  'bg-surface-2',
  'bg-card-solid',
  'bg-accent-fill',
]

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

/**
 * 🔴 **새 색은 다크·라이트 두 값을 동시에 정의한다** (DESIGN.md 규칙).
 *
 * 한쪽만 정의하면 그 테마에서 `rgb(var(--x))` 가 무효 색이 되어 요소가 **투명하게** 그려진다 —
 * 에러도 경고도 없다. 2026-08-17 에 활동 태그 16색이 테마 무관 고정값이라 라이트에서 2.06:1 이었고,
 * 그 종류의 침묵을 여기서 막는다. jsdom 은 CSS 를 적용하지 않아 유닛으로는 못 잡는다.
 */
const THEME_PAIRS = ['bg-accent-fill', 'bg-brand', 'bg-accent', 'bg-surface-2']

test('테마를 바꿔도 색 토큰이 살아 있다 (한쪽만 정의 금지)', async ({ page }) => {
  await page.goto('http://localhost:5173/demo/calendar', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const result = await page.evaluate((tokens: string[]) => {
    const probe = document.createElement('div')
    document.body.appendChild(probe)
    const read = (theme: string) => {
      document.documentElement.dataset.theme = theme
      const out: Record<string, string> = {}
      for (const t of tokens) {
        probe.className = t
        out[t] = getComputedStyle(probe).backgroundColor
      }
      return out
    }
    const dark = read('dark')
    const light = read('light')
    probe.remove()
    return { dark, light }
  }, THEME_PAIRS)

  const transparent = (v: string) => v === 'rgba(0, 0, 0, 0)' || v === 'transparent'
  for (const t of THEME_PAIRS) {
    expect(transparent(result.dark[t]), `다크에서 ${t} 이 투명`).toBe(false)
    expect(transparent(result.light[t]), `라이트에서 ${t} 이 투명`).toBe(false)
    // 같은 값이면 한쪽 테마에서 반드시 대비가 깨진다 (위 주석 · DESIGN.md 실측)
    expect(result.dark[t], `${t} 이 양 테마에서 같은 값`).not.toBe(result.light[t])
  }
})
