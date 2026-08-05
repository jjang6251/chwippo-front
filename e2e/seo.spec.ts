import { test, expect } from '@playwright/test'

/**
 * SEO 자산 회귀 방어 — **조용히 깨지는 것들**을 잡는다.
 *
 * 이 spec 이 없으면 아래가 전부 무성의하게 깨져도 아무도 모른다:
 *  - 랜딩 이미지 경로가 바뀌어 404 (2026-08-06 PNG → WebP 전환에서 실제로 위험했다)
 *  - 구조화 데이터 JSON 이 깨져 파싱 실패 (검색·AI 인용에서 통째로 빠진다)
 *  - `llms.txt` 가 배포에서 누락
 *
 * 🔴 `r.ok()` 를 쓰면 **304 Not Modified 를 실패로 오인**한다 (ok 는 200~299 만 참).
 *    캐시된 재방문이 전부 빨간불이 되므로 `status() >= 400` 으로 판정한다.
 */


test('랜딩 — WebP 이미지가 실제로 로드된다', async ({ page }) => {
  const failed: string[] = []
  page.on('response', (r) => {
    // 304 Not Modified 는 정상 캐시 응답 — ok() 는 200~299 만 참이라 실패로 오인된다
    if (/\.(webp|png)$/.test(r.url()) && r.status() >= 400) failed.push(`${r.status()} ${r.url().split('/').pop()}`)
  })
  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto('/')
    await page.waitForTimeout(2000)
    const r = await page.evaluate(() =>
      [...document.querySelectorAll('img')].map((i) => ({
        src: i.currentSrc.split('/').pop(),
        ok: i.complete && i.naturalWidth > 0,
      })))
    const bad = r.filter((x) => !x.ok)
    console.log(`RESULT ${w}px | ${r.length}장 | 실패 ${bad.length} | ${r.map((x) => x.src).join(', ')}`)
    expect(bad, `${w}px 미로드`).toEqual([])
  }
  expect(failed, '네트워크 실패').toEqual([])
})

test('가이드 — byline·스키마가 렌더된다', async ({ page }) => {
  await page.goto('/guide/dday.html')
  await page.waitForTimeout(800)
  await expect(page.getByText(/취업 준비 중인 개발자가 직접 쓰고 운영합니다/)).toBeVisible()
  const types = await page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')]
      .flatMap((s) => { try { const d = JSON.parse(s.textContent!); return (Array.isArray(d) ? d : [d]).map((x) => x['@type']) } catch { return ['PARSE_FAIL'] } }))
  console.log(`RESULT guide 스키마: ${types.join(' · ')}`)
  expect(types).toContain('BreadcrumbList')
  expect(types).not.toContain('PARSE_FAIL')
})

test('llms.txt 접근 가능', async ({ request }) => {
  const res = await request.get('/llms.txt')
  console.log(`RESULT llms.txt: ${res.status()} · ${(await res.text()).length}자`)
  expect(res.ok()).toBe(true)
})
