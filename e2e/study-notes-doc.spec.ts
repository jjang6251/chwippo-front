import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  doc,
  gotoDoc,
  mockStudyNotesApi,
  NOTE_A,
  para,
  selectAll,
  setTheme,
  tool,
  typeFresh,
} from './helpers/studyNotes'

/**
 * 「공부 노트」 문서 화면 — **모드 · 두 테마 · 모바일** (study-notes Phase 3 · 게이트 2).
 *
 * ## 🔴 색은 두 벌이라 한 테마만 보면 절반만 본 것이다
 *
 * 형광펜과 코드 하이라이팅은 `:root[data-theme]` 아래 다크/라이트 **두 벌**로 정의돼 있다.
 * 다크 값을 라이트에 그대로 얹으면 어두운 알파 틴트가 밝은 종이 위에서 회색으로 죽어
 * 형광펜으로 안 보인다 — 그런데 다크에서만 확인하면 **아무 문제 없어 보인다**.
 * 그래서 여기서는 두 테마를 각각 `getComputedStyle` 로 재고, 같은 값이면 실패로 본다.
 */

const HL_COLORS = ['yellow', 'green', 'blue', 'red', 'purple'] as const

const CODE = doc({
  type: 'codeBlock',
  attrs: { language: 'javascript' },
  content: [{ type: 'text', text: 'const answer = function () { return 1 }' }],
})

const WITH_DETAILS = doc({
  type: 'details',
  attrs: { open: true },
  content: [
    { type: 'detailsSummary', content: [{ type: 'text', text: '질문: TCP 는?' }] },
    { type: 'detailsContent', content: [para('연결 지향 프로토콜')] },
  ],
})

/** 형광펜 5색을 한 테마에서 한 바퀴 재고 색 맵을 돌려준다 */
async function measureHighlights(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const mark = page.locator('.chw-prose mark')
  for (const color of HL_COLORS) {
    await selectAll(page)
    await tool(page, `hl-${color}`).click()
    await expect(mark).toHaveAttribute('data-color', color)
    out[color] = await mark.evaluate((el) => getComputedStyle(el).backgroundColor)
    await tool(page, `hl-${color}`).click()
    await expect(mark).toHaveCount(0)
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// 편집 ↔ 읽기
// ─────────────────────────────────────────────────────────────

test('편집↔읽기 — 읽기에서 편집 불가 · 토글은 살아 있다 · 본문 720px · 모드가 리로드를 넘어간다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '읽기 노트', folderId: null, content: WITH_DETAILS }],
  })
  await gotoDoc(page)

  const body = page.locator('.chw-prose')
  await expect(body).toHaveAttribute('contenteditable', 'true')
  await expect(tool(page, 'bold')).toBeVisible()

  // ── 읽기로
  await page.getByRole('tab', { name: '읽기' }).click()
  await expect(body).toHaveAttribute('contenteditable', 'false')
  await expect(page.locator('[data-tool]')).toHaveCount(0)

  // 편집 불가 — 쳐도 안 들어간다
  const before = (await body.innerText()).trim()
  await body.click()
  await page.keyboard.type('침입 문자열')
  await page.waitForTimeout(300)
  expect((await body.innerText()).trim()).toBe(before)

  /*
    🔴 **토글은 읽기에서도 열고 닫힌다.** 접어 놓고 답을 맞혀 보는 self-test 가 읽기 모드의
    존재 이유라, 「편집 불가」를 이유로 같이 잠기면 이 화면의 절반이 사라진다.
  */
  const content = page.locator('.chw-prose [data-type="detailsContent"]')
  const chevron = page.locator('.chw-prose [data-type="details"] > button')
  await expect(content).not.toHaveAttribute('hidden', /.*/)
  await chevron.click()
  await expect(content).toHaveAttribute('hidden', /.*/)
  await chevron.click()
  await expect(content).not.toHaveAttribute('hidden', /.*/)

  // ── 65자 가독 폭 (읽기 전용)
  const width = await page
    .getByRole('heading', { level: 1, name: '읽기 노트' })
    .evaluate((el) => el.getBoundingClientRect().width)
  expect(width).toBeLessThanOrEqual(720)
  expect(width).toBeGreaterThan(700) // 실제로 720 에 붙어 있어야 한다 (안 걸리면 훨씬 넓다)

  // ── 마지막 모드는 기기 단위로 기억된다
  expect(await page.evaluate(() => localStorage.getItem('study-notes:mode:v1'))).toBe('read')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('tab', { name: '읽기' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.chw-prose')).toHaveAttribute('contenteditable', 'false')

  // 편집으로 되돌리면 그것도 기억한다
  await page.getByRole('tab', { name: '편집' }).click()
  await expect(page.locator('.chw-prose')).toHaveAttribute('contenteditable', 'true')
  expect(await page.evaluate(() => localStorage.getItem('study-notes:mode:v1'))).toBe('edit')
})

// ─────────────────────────────────────────────────────────────
// 양 테마 — 형광펜
// ─────────────────────────────────────────────────────────────

test('양 테마 — 형광펜 5색이 다크·라이트 모두 실제 배경색을 갖고, 두 테마 값이 다르다', async ({
  page,
}) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '형광펜', folderId: null, content: doc(para('형광펜 대상')) }],
  })
  await gotoDoc(page)
  await typeFresh(page, '형광펜 대상 문장')

  await setTheme(page, 'dark')
  const dark = await measureHighlights(page)
  await setTheme(page, 'light')
  const light = await measureHighlights(page)

  const pageBg = async () =>
    page.locator('.chw-prose').evaluate((el) => getComputedStyle(el).backgroundColor)

  await setTheme(page, 'light')
  const lightBg = await pageBg()

  for (const color of HL_COLORS) {
    // 1) 두 테마 모두 색이 **실재**한다 (투명 = 스타일이 안 붙은 것)
    expect(dark[color], `다크 ${color}`).not.toBe('rgba(0, 0, 0, 0)')
    expect(light[color], `라이트 ${color}`).not.toBe('rgba(0, 0, 0, 0)')
    // 2) 배경과 같은 값이면 형광펜이 아니다
    expect(light[color], `라이트 ${color} 가 배경과 같다`).not.toBe(lightBg)
    // 3) 🔴 두 벌이 실제로 갈라져 있다 — 같으면 한 벌이 no-op 이라는 뜻
    expect(light[color], `${color} 가 다크·라이트 같은 값이다`).not.toBe(dark[color])
  }

  // 각 테마 안에서 5색이 서로 구분된다
  expect(new Set(Object.values(dark)).size).toBe(HL_COLORS.length)
  expect(new Set(Object.values(light)).size).toBe(HL_COLORS.length)

  test.info().annotations.push({
    type: '형광펜 실측',
    description: HL_COLORS.map((c) => `${c}: dark ${dark[c]} / light ${light[c]}`).join(' | '),
  })
})

// ─────────────────────────────────────────────────────────────
// 양 테마 — 코드 하이라이팅
// ─────────────────────────────────────────────────────────────

test('양 테마 — hljs 토큰 색이 다크·라이트 모두 본문색과 다르고, 두 테마 값이 다르다', async ({
  page,
}) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '코드', folderId: null, content: CODE }],
  })
  await gotoDoc(page)

  const keyword = page.locator('.chw-prose pre code .hljs-keyword').first()
  const number = page.locator('.chw-prose pre code .hljs-number').first()
  await expect(keyword).toBeVisible()

  const sample = async () =>
    page.evaluate(() => {
      const pre = document.querySelector('.chw-prose pre') as HTMLElement
      const kw = document.querySelector('.chw-prose pre code .hljs-keyword') as HTMLElement
      const num = document.querySelector('.chw-prose pre code .hljs-number') as HTMLElement
      return {
        base: getComputedStyle(pre).color,
        bg: getComputedStyle(pre).backgroundColor,
        keyword: getComputedStyle(kw).color,
        number: getComputedStyle(num).color,
      }
    })

  await setTheme(page, 'dark')
  const dark = await sample()
  await setTheme(page, 'light')
  const light = await sample()

  await expect(number).toBeVisible()

  for (const [label, s] of [
    ['다크', dark],
    ['라이트', light],
  ] as const) {
    expect(s.keyword, `${label} keyword 가 본문색과 같다 — 하이라이팅이 죽었다`).not.toBe(s.base)
    expect(s.number, `${label} number 가 본문색과 같다`).not.toBe(s.base)
    expect(s.keyword, `${label} keyword 가 배경색과 같다`).not.toBe(s.bg)
  }

  // 🔴 라이트 팔레트가 다크 값을 그대로 쓰면 대비가 무너진다 (토큰 두 벌의 존재 이유)
  expect(light.keyword).not.toBe(dark.keyword)
  expect(light.number).not.toBe(dark.number)

  test.info().annotations.push({
    type: 'hljs 실측',
    description: `keyword dark ${dark.keyword} / light ${light.keyword} · number dark ${dark.number} / light ${light.number}`,
  })
})

// ─────────────────────────────────────────────────────────────
// 모바일
// ─────────────────────────────────────────────────────────────

test('모바일 375px — 툴바는 가로로만 스크롤한다 (세로 스크롤 0)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 })
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '모바일', folderId: null, content: doc(para('본문')) }],
  })
  await gotoDoc(page)

  const box = await page.locator('[data-tool="bold"]').evaluate((el) => {
    const scroller = el.closest('.overflow-x-auto') as HTMLElement
    return {
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
    }
  })

  // 툴바는 한 화면에 안 들어간다 → 가로 스크롤이 있어야 나머지 버튼에 닿는다
  expect(box.scrollWidth).toBeGreaterThan(box.clientWidth)
  /*
    🔴 `overflow-x: auto` 는 `overflow-y` 를 강제로 auto 로 만든다. focus ring 이 1~2px
    삐져나오면 툴바가 세로로도 "약간" 스크롤되고, 그 상태로 손가락을 대면 화면이 덜컹인다
    (JobSiteChips 에서 실제로 났던 사고 — `py-1.5 -my-1.5` 가 그걸 품는다).
  */
  expect(box.scrollHeight).toBeLessThanOrEqual(box.clientHeight)

  // 첫 화면에 사용 빈도 높은 버튼이 보인다 (툴바 배치 = 사용 빈도순)
  for (const key of ['bold', 'h2', 'bulletList', 'taskList', 'details']) {
    await expect(tool(page, key)).toBeInViewport()
  }
})

test('모바일 375px — 하단 탭에 「공부 노트」 · 허브에 새 노트 FAB', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 })
  await mockStudyNotesApi(page)
  await page.goto('/study-notes', { waitUntil: 'domcontentloaded' })

  const tab = page.locator('nav[data-nav] a', { hasText: '공부 노트' })
  await expect(tab).toHaveAttribute('href', '/study-notes')
  // 내정보 탭은 설정 안으로 이사했다 (CEO 결정 3)
  await expect(page.locator('nav[data-nav] a', { hasText: '내정보' })).toHaveCount(0)

  // exact — 폴더 헤더 [+]('…폴더에 새 노트')가 부분일치로 걸린다 (2026-08-19)
  const fab = page.getByRole('button', { name: '새 노트', exact: true })
  await expect(fab).toBeVisible()

  // 문서 페이지에서도 탭이 켜져 있어야 한다
  await page.goto(`/study-notes/${NOTE_A}`, { waitUntil: 'domcontentloaded' })
  await expect(tab.locator('span', { hasText: '공부 노트' })).toHaveClass(/text-brand/)
})

test('빈 문서 템플릿 칩 — 갓 만든 노트에 7개 · 타이핑하면 사라진다', async ({ page }) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: 'note-empty-1', title: '', folderId: null, content: null }],
  })
  await page.goto('/study-notes/note-empty-1', { waitUntil: 'domcontentloaded' })

  const chips = page.getByTestId('template-chips')
  await expect(chips).toBeVisible()
  await expect(chips.getByRole('button')).toHaveCount(7)

  // 타이핑 시작 → 칩 소멸 (jsdom 이 못 흉내내는 PM 실입력 — 이 케이스가 유일한 검증처)
  await page.locator('.chw-prose').click()
  await page.keyboard.type('오늘부터 정리 시작')
  await expect(chips).toBeHidden()

  // 전부 지우면 다시 나타난다 (라치는 노트 단위)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Backspace')
  await expect(chips).toBeVisible()
})

test('h2 여백 — 제목 위가 넉넉해야 섹션이 갈린다 (2026-08-18 실기 회귀)', async ({ page }) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: 'note-empty-2', title: '', folderId: null, content: null }],
  })
  await page.goto('/study-notes/note-empty-2', { waitUntil: 'domcontentloaded' })
  await page.locator('.chw-prose').click()
  await page.keyboard.type('첫 문단입니다')
  await page.keyboard.press('Enter')
  await page.keyboard.type('## 섹션 제목')

  const m = await page.locator('.chw-prose h2').first().evaluate((el) => {
    const s = getComputedStyle(el)
    return { top: parseFloat(s.marginTop), bottom: parseFloat(s.marginBottom) }
  })
  // 규칙이 지워지면 0 이 된다 — 실제로 margin 규칙이 통째로 빠진 채 출시 직전까지 갔다
  expect(m.top).toBeGreaterThan(10)
  // 계약: 위는 넉넉히(섹션 경계), 아래는 본문과 붙게
  expect(m.top).toBeGreaterThan(m.bottom)

  /*
    🔴 크기 위계 h1 > h2 > h3 > 본문 — 같은 부류 사고가 두 번째다: 규칙이 없는 제목은
    리셋(1em·보통 굵기)이 이겨서 **h1 이 h2 보다 작게** 렌더됐다 (2026-08-18 실기).
  */
  await page.keyboard.press('Enter')
  await page.keyboard.type('# 큰 제목')
  await page.keyboard.press('Enter')
  await page.keyboard.type('### 작은 제목')
  const size = async (sel: string) =>
    page.locator(sel).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  const [s1, s2, s3, sp] = await Promise.all([
    size('.chw-prose h1'),
    size('.chw-prose h2'),
    size('.chw-prose h3'),
    size('.chw-prose p'),
  ])
  expect(s1).toBeGreaterThan(s2)
  expect(s2).toBeGreaterThan(s3)
  expect(s3).toBeGreaterThan(sp)
})

test('목차 세부 동작 — h1 포함 · 클릭 시 sticky 헤더에 안 가림 · 스크롤 추적 (2026-08-18 검증)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }) // TOC 는 xl(1280px+) 에서만

  const heading = (level: number, text: string) => ({
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  })
  const paras = (n: number, seed: string) =>
    Array.from({ length: n }, (_, i) => para(`${seed} 본문 문단 ${i + 1} — 스크롤 길이 확보용.`))
  const longDoc = JSON.stringify({
    type: 'doc',
    content: [
      heading(1, '운영체제 총정리'),
      ...paras(12, '개요'),
      heading(2, '프로세스와 스레드'),
      ...paras(12, '프로세스'),
      heading(3, '컨텍스트 스위칭'),
      ...paras(12, '스위칭'),
      heading(2, '메모리 관리'),
      ...paras(12, '메모리'),
    ],
  })
  await mockStudyNotesApi(page, {
    notes: [{ id: 'note-toc-1', title: '운영체제', folderId: null, content: longDoc }],
  })
  await page.goto('/study-notes/note-toc-1', { waitUntil: 'domcontentloaded' })

  const toc = page.locator('nav[aria-label="목차"]')
  await expect(toc).toBeVisible()
  const items = toc.getByRole('button')

  // ① h1 챕터가 목차 맨 위에 있다 (예전엔 h2·h3 만 뽑아 챕터 축이 사라졌다)
  await expect(items).toHaveCount(4)
  await expect(items.first()).toHaveText('운영체제 총정리')

  // ①' 위계가 들여쓰기로 보인다 — h1 < h2 < h3, 같은 레벨은 같은 깊이 (2026-08-18 실측 정정:
  //     h1·h2 가 전부 12px 로 같아 챕터·섹션이 구분되지 않았다)
  const pads = await items.evaluateAll((els) =>
    els.map((el) => parseFloat(getComputedStyle(el).paddingLeft)),
  )
  expect(pads[0]).toBeLessThan(pads[1]) // h1 챕터 < h2 섹션
  expect(pads[1]).toBeLessThan(pads[2]) // h2 < h3
  expect(pads[3]).toBe(pads[1]) // 같은 레벨(h2)은 같은 깊이

  // ② 중간 항목 클릭 → 제목이 **화면 중간 살짝 위**(38vh)에 온다 (2026-08-19 CEO —
  //    상단 붙임(72px)에서 변경: 읽는 위치로 내려와야 스크롤 추적 감각과 맞는다)
  //    (양쪽 경계를 다 잰다 — 아래만 재면 「스크롤이 아예 안 됐다」도 통과해 버린다)
  await items.nth(2).click() // 컨텍스트 스위칭 (h3 · 중간이라 착지 보장)
  const vh = await page.evaluate(() => window.innerHeight)
  await expect
    .poll(async () => {
      const h = page.locator('.chw-prose h3', { hasText: '컨텍스트 스위칭' })
      return h.evaluate((el) => Math.round(el.getBoundingClientRect().top))
    })
    .toBeGreaterThanOrEqual(Math.round(vh * 0.3)) // 상단에 붙지 않았다
  await expect
    .poll(async () => {
      const h = page.locator('.chw-prose h3', { hasText: '컨텍스트 스위칭' })
      return h.evaluate((el) => Math.round(el.getBoundingClientRect().top))
    })
    .toBeLessThan(Math.round(vh * 0.45)) // 중간을 넘지 않았다 (착지 38vh ± 여유)
  await expect(items.nth(2)).toHaveClass(/text-brand/)

  // ②' 🔴 마지막 항목 — 짧은 마지막 섹션은 제목이 120px 선을 못 넘는다.
  //    바닥 특례가 없으면 클릭해도 활성이 이전 항목으로 되돌아간다 (실측으로 잡은 결함)
  await items.last().click()
  await expect(items.last()).toHaveClass(/text-brand/)

  // ②'' 목차 레일도 헤더 아래에 온전히 붙어 따라온다 — top-6(24px) 시절엔
  //     헤더(48px) 밑으로 미끄러져 상단이 잘렸다 (2026-08-18 실기).
  //     2026-08-19 레일 개편: sticky 는 래퍼로 옮겨갔고 nav 위에 AI 버튼이 앉는다 —
  //     "따라옴" 판정은 sticky 래퍼 기준 (nav 는 버튼 높이만큼 아래가 정상)
  const railTop = await page
    .locator('nav[aria-label="목차"]')
    .evaluate((el) => Math.round(el.closest('.sticky')!.getBoundingClientRect().top))
  expect(railTop).toBeGreaterThanOrEqual(48)
  expect(railTop).toBeLessThanOrEqual(90)

  // ③ 맨 위로 스크롤 → 첫 항목이 활성으로 돌아온다 (스크롤 추적)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(items.first()).toHaveClass(/text-brand/)
  await expect(items.last()).not.toHaveClass(/text-brand/)

  /*
    ④ 🔴 조상 챕터 하이라이트 — h1 바로 밑에 h2 가 붙으면 h1 이 활성인 순간이 찰나라
    "H1 은 인식이 안 된다"로 보였다 (2026-08-18 실기). 하위 섹션을 읽는 동안
    소속 h1 이 은은하게(text-text-secondary) 함께 켜져야 한다.
  */
  await items.nth(1).click() // 「프로세스와 스레드」(h2) 로 이동
  await expect(items.nth(1)).toHaveClass(/text-brand/)
  await expect(items.first()).toHaveClass(/text-text-secondary/) // h1 = 조상으로 켜짐
  await expect(items.first()).not.toHaveClass(/text-brand/)
})

test('목차 노출 기준 — 읽기 1120px+ · 편집 1280px+ (iPad 가로 구제, 2026-08-18 CEO 확정)', async ({
  page,
}) => {
  const content = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '섹션 하나' }] },
      para('본문'),
    ],
  })
  await mockStudyNotesApi(page, {
    notes: [{ id: 'n-bp', title: '기준', folderId: null, content }],
  })
  const nav = page.locator('nav[aria-label="목차"]')

  // iPad 11" 가로(1194): 편집 = 숨김 · 읽기 = 보임 + 본문이 안 눌린다
  await page.setViewportSize({ width: 1194, height: 834 })
  await page.goto('/study-notes/n-bp', { waitUntil: 'domcontentloaded' })
  await page.locator('.chw-prose').waitFor({ state: 'visible' })
  await page.getByRole('tab', { name: '편집' }).click()
  await expect(nav).toBeHidden()
  await page.getByRole('tab', { name: '읽기' }).click()
  await expect(nav).toBeVisible()
  const bodyW = await page
    .locator('.chw-prose p')
    .first()
    .evaluate((el) => el.getBoundingClientRect().width)
  expect(bodyW).toBeGreaterThanOrEqual(600) // 38자/줄 보장선 아래로 눌리지 않는다

  // 1120 미만(구형·Split View): 읽기여도 숨김 — 어중간하게 눌린 제3의 상태를 만들지 않는다
  await page.setViewportSize({ width: 1100, height: 834 })
  await expect(nav).toBeHidden()

  // 노트북(1280): 두 모드 다 보임 (기존 계약 유지)
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(nav).toBeVisible()
  await page.getByRole('tab', { name: '편집' }).click()
  await expect(nav).toBeVisible()
})

/** 2026-08-19 — VS Code 복사물(HTML 동반)도 마크다운으로 파싱된다 (학습 md 이관 실사용 발견) */
test('코드 에디터 복사물 붙여넣기 — HTML이 있어도 모노스페이스 시그니처면 md 파싱', async ({ page }) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '이관 테스트', content: doc(para('기존 내용')) }],
  })
  await gotoDoc(page)
  const editor = page.locator('.ProseMirror').first()
  await editor.click()
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData(
      'text/html',
      `<meta charset='utf-8'><div style="color: #d4d4d4;background-color: #1e1e1e;font-family: Menlo, Monaco, 'Courier New', monospace;white-space: pre;"><div># 붙임 제목</div><div>| 열A | 열B |</div></div>`,
    )
    dt.setData('text/plain', '# 붙임 제목\n\n| 열A | 열B |\n| --- | --- |\n| 1 | 2 |')
    const target = document.querySelector('.ProseMirror')!
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  // md 로 파싱됐다면 h1 노드와 실제 표가 생긴다 (평문이면 '#'·'|' 문자가 그대로 보인다)
  await expect(editor.locator('h1', { hasText: '붙임 제목' })).toBeVisible()
  await expect(editor.locator('table td', { hasText: '1' })).toBeVisible()
  await expect(editor).not.toContainText('# 붙임')
})

/** 2026-08-19 실사용(학습 문서 이관) — 목차 내부 스크롤·활성 따라오기·depth 증폭 */

function h(level: number, text: string) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}
function p(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text: text.repeat(30) }] }
}
test('목차 — 제목 40개 문서에서 내부 스크롤되고 활성 항목이 따라온다', async ({ page }) => {
  // 제목 40개짜리 긴 문서 — 목차가 뷰포트를 확실히 넘게
  const blocks: unknown[] = []
  for (let c = 1; c <= 8; c++) {
    blocks.push(h(1, `${c}장 챕터`), p('본문 '))
    for (let sIdx = 1; sIdx <= 2; sIdx++) {
      blocks.push(h(2, `${c}-${sIdx} 절`), p('내용 '))
      blocks.push(h(3, `${c}-${sIdx}-a 항`), p('세부 '))
    }
  }
  await mockStudyNotesApi(page, { notes: [{ id: NOTE_A, title: '긴 문서', content: doc(...blocks) }] })
  await page.goto(`/study-notes/${NOTE_A}`, { waitUntil: 'domcontentloaded' })
  const nav = page.locator('[data-toc-nav]')
  await expect(nav).toBeVisible()

  // ① 내부 스크롤 여지가 있다
  const scrollable = await nav.evaluate((el) => el.scrollHeight - el.clientHeight)
  expect(scrollable).toBeGreaterThan(100)

  // ② 본문을 끝까지 내리면 활성 항목이 목차 내부 스크롤로 따라와 보인다
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(600)
  const followed = await nav.evaluate((el) => {
    const active = el.querySelector('.border-brand')
    if (!active) return { ok: false as const }
    const nr = el.getBoundingClientRect(); const ar = active.getBoundingClientRect()
    return { ok: true as const, visible: ar.top >= nr.top - 1 && ar.bottom <= nr.bottom + 1, scrollTop: el.scrollTop }
  })
  expect(followed.ok).toBe(true)
  expect(followed.visible).toBe(true)
  expect(followed.scrollTop).toBeGreaterThan(0)

})
