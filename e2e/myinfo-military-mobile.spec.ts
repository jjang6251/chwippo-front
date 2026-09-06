/**
 * 병역사항 편집 — **모바일에서 두 칸 행이 무너지지 않는가** (2026-09-06).
 *
 * 🔴 실사고: `Field span` 이 조건 없는 `col-span-2` 를 달고 있어서, 1열 그리드
 * (`grid-cols-1`) 안에 **암시 칼럼**이 하나 더 생겼다. 그 칼럼은 `auto` 라 내용 폭을 전부
 * 먹고, 명시 칼럼 `minmax(0,1fr)` 은 **0px** 으로 찌그러졌다
 * (390px 실측 `grid-template-columns: 0px 292px`). 결과는 세 가지로 동시에 터졌다:
 *   · 「군별」·「계급」, 「입대일」·「전역일」 라벨이 같은 줄에 겹쳐 「군계급 별」로 읽혔다
 *   · 「18·21·24개월」 칩이 폭 0 칸에 갇혀 글자가 한 자씩 세로로 찢어졌다
 *   · 0폭 칸의 `.relative` 안에서 `absolute right-4` 인 select chevron 이 **카드 밖**
 *     (섹션 왼쪽 −4px)으로 튀어나가 「✓」 유령처럼 보였다
 *
 * 이번 브랜치가 만든 회귀가 아니라 **운영(v1.30.0)에도 있던 결함**이다 —
 * `fields.tsx` 의 `col-span-2` 와 병역 그리드 래퍼는 `origin/develop` 과 같은 글자였다.
 *
 * jsdom 은 레이아웃을 하지 않아 `grid-template-columns` 도 boundingBox 도 잴 수 없다.
 * **브라우저에서만** 잴 수 있는 계약이라 e2e 로 둔다.
 */
import { test, expect, type Page } from '@playwright/test'
import { mockAuth } from './helpers/auth'

const json = (d: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d }) })

/** 상세 칸이 펴지는 유일한 조건 — 남성 + 병역 상태가 상세 대상(군필) */
const PROFILE = {
  gender: 'MALE',
  military_status: 'completed',
  military_branch: '육군',
  military_rank: '병장',
  military_specialty: '통신',
  military_start: '2020-01-01',
  military_end: '2021-06-30',
  military_discharge: 'honorable',
}

async function openMilitaryEdit(page: Page, width: number) {
  await page.route('http://localhost:3000/**', (r) => {
    const u = new URL(r.request().url()).pathname
    if (u.endsWith('/myinfo/profile')) return r.fulfill(json(PROFILE))
    if (u.includes('coin-balance')) return r.fulfill(json({ balance: 100, monthlyCoinLimit: 100, tier: 'free', nextResetAt: '2026-10-01T00:00:00Z' }))
    if (u.includes('streak')) return r.fulfill(json({ streak: { current: 1 } }))
    if (u.includes('unread-count')) return r.fulfill(json({ count: 0 }))
    if (u.includes('announcement')) return r.fulfill(json(null))
    if (u.includes('field-dictionary')) return r.fulfill(json({ fields: [] }))
    if (u.includes('storage-usage')) return r.fulfill(json({ usedBytes: 0, limitBytes: 104_857_600, usedMB: 0, limitMB: 100, percentage: 0, breakdown: { myinfoBytes: 0, noteImageBytes: 0 } }))
    return r.fulfill(json([]))
  })
  await mockAuth(page)
  await page.setViewportSize({ width, height: 844 })
  await page.goto('http://localhost:5173/myinfo', { waitUntil: 'domcontentloaded' })

  // 섹션은 첫 방문에 모두 접혀 있다 — 헤더 버튼으로 편다
  const header = page.locator('h3 > button', { hasText: '병역사항' }).first()
  await expect(header).toBeVisible({ timeout: 15_000 })
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click()

  const section = page.locator('section#military')
  await section.getByRole('button', { name: '편집' }).click()
  await expect(section.getByLabel('군별')).toBeVisible()
  return section
}

for (const width of [390, 320]) {
  test(`병역 상세 ${width}px — 두 칸 행이 1열로 쌓이고 칩이 한 줄이다`, async ({ page }) => {
    const section = await openMilitaryEdit(page, width)

    // ── 1. 그리드에 0px 트랙이 없다 (암시 칼럼이 생기면 명시 칼럼이 0px 으로 찌그러진다)
    const tracks = await section.locator('div.grid').first().evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns.split(' ').map((t) => Math.round(parseFloat(t))),
    )
    expect(tracks.length, `모바일은 1열이어야 한다 — 실제 트랙 ${tracks.join(' / ')}`).toBe(1)
    expect(Math.min(...tracks), `0px 으로 찌그러진 트랙이 있다 — ${tracks.join(' / ')}`).toBeGreaterThan(100)

    /*
      ── 2. 짝지어 놓은 라벨이 「위아래로 쌓여 있고, 각자 제 폭을 갖는다」.
      🔴 "사각형이 겹치나" 로는 이 사고를 못 잡는다 — 찌그러진 칸의 라벨은 **폭 0** 이라
      사각형 교차가 영원히 false 다. 눈에 보이는 건 0폭 칸에서 넘쳐 그려진 **글자**였다.
      그래서 폭이 살아 있는지와 줄이 갈렸는지를 각각 본다.
    */
    for (const [a, b] of [['군별', '계급'], ['입대일', '전역일']]) {
      const boxA = await section.getByText(a, { exact: true }).boundingBox()
      const boxB = await section.getByText(b, { exact: true }).boundingBox()
      expect(boxA, `「${a}」 라벨이 없다`).not.toBeNull()
      expect(boxB, `「${b}」 라벨이 없다`).not.toBeNull()
      expect(boxA!.width, `「${a}」 칸이 폭 0 으로 찌그러졌다`).toBeGreaterThan(40)
      expect(boxB!.width, `「${b}」 칸이 폭 0 으로 찌그러졌다`).toBeGreaterThan(40)
      expect(boxB!.y, `「${a}」와 「${b}」 가 같은 줄에 있다 (모바일은 1열) — ${boxA!.y} vs ${boxB!.y}`)
        .toBeGreaterThanOrEqual(boxA!.y + boxA!.height)
    }

    // ── 3. 복무 기간 칩 3개가 한 줄이다 (폭 0 칸에 갇히면 글자가 세로로 찢어진다)
    const chips = section.getByRole('group', { name: '복무 기간 자동 계산' })
    const chipBox = await chips.boundingBox()
    expect(chipBox!.height, `칩이 여러 줄로 접혔다 — 높이 ${chipBox!.height}px`).toBeLessThanOrEqual(48)
    const buttons = chips.getByRole('button')
    await expect(buttons).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      const b = await buttons.nth(i).boundingBox()
      // 한 줄짜리 칩은 높이 = 칩 그룹 높이. 글자가 찢어지면 세로로 길어진다
      expect(b!.height, `칩 ${i} 의 글자가 세로로 찢어졌다 — 높이 ${b!.height}px`).toBeLessThanOrEqual(48)
      expect(b!.width, `칩 ${i} 이 찌그러졌다 — 폭 ${b!.width}px`).toBeGreaterThan(40)
    }

    // ── 4. 「✓」 유령 — 0폭 칸의 chevron 이 카드 왼쪽 밖으로 튀어나가지 않는다
    const sectionBox = (await section.boundingBox())!
    // chevron 은 `.relative` 안 `absolute right-4` 라, 그 칸이 0폭이면 x 가 음수로 밀린다
    const chevronX = await section.getByLabel('군별').evaluate((el) => {
      const svg = el.parentElement?.querySelector('svg')
      return svg ? svg.getBoundingClientRect().x : NaN
    })
    expect(chevronX, `select chevron 이 카드 밖(x=${chevronX} < ${sectionBox.x})으로 나갔다`)
      .toBeGreaterThanOrEqual(sectionBox.x)

    // ── 5. 320px 까지 가로 오버플로 없음 (DESIGN.md §9)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `가로 스크롤이 생겼다 — ${overflow}px`).toBeLessThanOrEqual(0)
  })
}
