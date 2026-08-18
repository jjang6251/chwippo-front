import { test, expect } from '@playwright/test'

/**
 * 준비 노트(스텝 페이지) 툴바 — 카드 안 sticky (2026-08-19 CEO 실기).
 *
 * 🔴 왜 e2e 인가: 원래 sticky 클래스는 있었는데 카드 래퍼의 `overflow-hidden` 이
 * 이 카드를 스크롤 컨테이너로 만들어 **sticky 를 조용히 죽였다** — 에러도 경고도 없고,
 * jsdom 은 레이아웃이 없어 원리적으로 못 잡는다. 실브라우저 좌표 실측만이 증거다.
 * (같은 이유로 클래스 문자열 단언은 이 회귀를 못 막는다 — 클래스는 그때도 있었다)
 *
 * 데모 라우트를 쓴다 — 로그인·API mock 없이 실제 StepPage 트리가 그대로 선다.
 */
test('준비 노트 툴바 — 길게 쓴 노트를 스크롤하면 따라온다 (카드색 배경)', async ({ page }) => {
  await page.goto('/demo/board/demo-a1/steps/demo-a1-s2')
  const bold = page.locator('[data-tool="bold"]')
  await expect(bold).toBeVisible()

  // 노트를 길게 만들어 sticky 가 걸릴 스크롤 구간 확보
  await page.locator('.ProseMirror').first().click()
  await page.keyboard.press('ControlOrMeta+ArrowDown')
  for (let i = 0; i < 40; i++) {
    await page.keyboard.type(`스크롤 확보용 줄 ${i}`)
    await page.keyboard.press('Enter')
  }

  // 카드 상단이 헤더를 훌쩍 지나도록 스크롤
  await page.evaluate(() => {
    const card = document
      .querySelector('[data-tool="bold"]')!
      .closest('.rounded-xl') as HTMLElement
    window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY + 400)
  })

  // 툴바가 화면에 남아 있다 — overflow-hidden 회귀면 카드와 함께 위로 사라져 음수가 된다
  const probe = await bold.evaluate((el) => {
    const toolbar = el.closest('.sticky') as HTMLElement
    const card = toolbar.closest('.rounded-xl') as HTMLElement
    return {
      top: Math.round(toolbar.getBoundingClientRect().top),
      cardTop: Math.round(card.getBoundingClientRect().top),
      toolbarBg: getComputedStyle(toolbar).backgroundColor,
      cardBg: getComputedStyle(card).backgroundColor,
    }
  })
  expect(probe.cardTop).toBeLessThan(-300) // 전제: 카드는 정말 지나갔다
  expect(probe.top).toBeGreaterThanOrEqual(0)
  expect(probe.top).toBeLessThanOrEqual(48) // 헤더(있으면 48px) 아래
  // 카드 안 변형 — 페이지색(bg/95) 띠가 아니라 카드와 같은 색이어야 한다
  expect(probe.toolbarBg).toBe(probe.cardBg)
})

/**
 * 시트 탭 줄 — 세로 스크롤 여지 0 (2026-08-19 CEO 실기).
 *
 * 탭들의 `-mb-px`(카드 윗선 1px 겹침)가 overflow-x-auto 컨테이너 밖으로 삐져나오면
 * 세로 1px 스크롤 여지가 생기고, overscroll-contain 과 만나 **탭 줄 위에서 페이지 휠이
 * 통째로 먹혔다** (실측: scrollY 무반응). 역시 jsdom 은 레이아웃이 없어 못 잡는다.
 */
test('시트 탭 줄 — 세로로 흔들리지 않고, 그 위에서 휠을 굴리면 페이지가 스크롤된다', async ({
  page,
}) => {
  await page.goto('/demo/board/demo-a1/steps/demo-a1-s2')
  const tablist = page.locator('[role="tablist"]')
  await expect(tablist).toBeVisible()

  const slack = await tablist.evaluate((el) => {
    const box = el.parentElement!
    return box.scrollHeight - box.clientHeight
  })
  expect(slack).toBe(0)

  const box = (await tablist.boundingBox())!
  await page.mouse.move(box.x + 60, box.y + Math.min(10, box.height / 2))
  const before = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 240)
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 })
    .toBeGreaterThan(before)
})
