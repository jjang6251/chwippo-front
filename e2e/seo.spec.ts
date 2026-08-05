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

/**
 * 🔴 unit spec(`RouteMeta.test.tsx`)은 **`RouteMeta` 만 단독 렌더**한다 — 실제 앱에서 배선이
 * 빠졌거나 다른 코드가 head 를 되돌려도 통과한다. 실제 브라우저에서 라우터를 통째로 태워
 * "그 화면을 열었을 때 head 가 그 페이지 것인가" 를 확인한다.
 */
test('SPA — 라우트별 canonical·title 이 자기 주소로 갱신된다', async ({ page }) => {
  const cases = [
    { path: '/demo/board', canonical: 'https://chwippo.com/demo/board' },
    { path: '/privacy', canonical: 'https://chwippo.com/privacy' },
    { path: '/', canonical: 'https://chwippo.com/' },
  ]
  for (const c of cases) {
    await page.goto(c.path)
    await page.waitForTimeout(500)
    const head = await page.evaluate(() => ({
      title: document.title,
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
    }))
    console.log(`RESULT ${c.path} | ${head.canonical} | ${head.title}`)
    expect(head.canonical, `${c.path} canonical`).toBe(c.canonical)
    expect(head.ogUrl, `${c.path} og:url`).toBe(c.canonical)
  }

  // 🔴 진짜 위험한 건 이쪽 — **전체 리로드 없는 클라이언트 이동**이다.
  // 홈에서 링크로 들어가면 head 가 홈 그대로 남을 수 있다 (index.html 은 다시 안 읽힌다).
  await page.goto('/')
  await page.getByRole('link', { name: /둘러보기|체험/ }).first().click()
  await page.waitForURL(/\/demo/)
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => ({
    url: location.pathname,
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    title: document.title,
  }))
  console.log(`RESULT 클라이언트 이동 → ${after.url} | ${after.canonical}`)
  expect(after.canonical, '클라이언트 이동 후 canonical 이 홈에 머무름').toBe(
    `https://chwippo.com${after.url}`,
  )
})

/**
 * 가이드는 정적 HTML 이라 SPA 의 `initClarity()` 가 안 돈다 — `analytics.js` 가 대신 붙는다.
 * 🔴 그 파일은 ID 가 상수라 **호스트 가드가 유일한 방어선**이다. 가드가 빠지면 로컬·CI·프리뷰
 *    트래픽이 전부 운영 Clarity 로 들어간다. 로컬에서 검증 가능한 건 "안 켜지는 것" 쪽이다.
 */
test('가이드 — analytics.js 는 로드되지만 로컬에서는 Clarity 를 켜지 않는다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('clarity.ms')) requests.push(r.url())
  })
  const res = await page.goto('/guide/dday.html')
  await page.waitForTimeout(1200)

  // 🔴 `status === 200` 만 보면 **파일이 없어도 통과한다.** SPA catch-all rewrite 가 없는 경로에
  //    index.html 을 200 으로 돌려주기 때문이다(2026-08-06 운영에서 실측: 200 text/html).
  //    그 HTML 에는 'chwippo.com' 도 들어 있어 문자열 가드 검사까지 통과한다 —
  //    **content-type 과 파일 고유 마커로 판정해야** 실패 모드를 걸러낸다.
  const loaded = await page.evaluate(async () => {
    const r = await fetch('/guide/analytics.js')
    return { status: r.status, type: r.headers.get('content-type') ?? '', body: await r.text() }
  })
  console.log(
    `RESULT guide analytics.js: ${loaded.status} ${loaded.type.split(';')[0]} · clarity 요청 ${requests.length}`,
  )

  expect(res?.status()).toBe(200)
  expect(loaded.status).toBe(200)
  expect(loaded.type, 'JS 가 아님 = 파일 없음(catch-all 이 HTML 을 대신 줌)').toContain('javascript')
  expect(loaded.body, 'analytics.js 내용이 아님').toContain('PROJECT_ID')
  expect(loaded.body).toContain('clarity.ms')
  expect(loaded.body, '운영 도메인 가드 없음').toContain('chwippo.com')
  expect(requests, '로컬에서 운영 Clarity 로 전송됨').toEqual([])
  expect(await page.evaluate(() => !!document.getElementById('clarity-script'))).toBe(false)
})

test('llms.txt 접근 가능', async ({ request }) => {
  const res = await request.get('/llms.txt')
  console.log(`RESULT llms.txt: ${res.status()} · ${(await res.text()).length}자`)
  expect(res.ok()).toBe(true)
})
