/**
 * 노트 AI 패널 — 실브라우저 통합 스모크 (plans/note-ai-panel.md §3 Playwright 축).
 *
 * jsdom 이 원리적으로 못 잡는 것만 여기서: BubbleMenu 실좌표 노출 · 패널 개폐 레이아웃 ·
 * 선택 하이라이트 데코 시각 · 드래그 선택→요청→교체 전체 체인.
 * 서버는 mock — 백엔드 봉투(성공/차단)는 백 e2e 10케이스가 잠근다.
 */
import { test, expect, type Page } from '@playwright/test'
import { doc, para, gotoDoc, mockStudyNotesApi, NOTE_A } from './helpers/studyNotes'
import { TEST_USER } from './helpers/auth'

const AI_RESULT_MD = '**핵심**: 프로세스는 독립된 주소 공간을 가진다.\n\n- 스레드는 공유한다'

const capturedBodies: Array<{ action: string; selectionMd?: string }> = []

async function mockAiAction(page: Page) {
  await page.route(`http://localhost:3000/study-notes/${NOTE_A}/ai-action`, async (route) => {
    const body = route.request().postDataJSON() as { action: string; selectionMd?: string }
    capturedBodies.push(body)
    await route.fulfill({
      json: {
        data: {
          status: 'ok',
          markdown: AI_RESULT_MD,
          cached: false,
          truncated: body.action === 'table', // 표 액션만 잘림 배지 케이스로
          quota: { used: 1, limit: 10000 },
          meta: { callLogId: 'e2e-log-1' },
        },
        message: 'ok',
      },
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: 'CS 정리', content: doc(para('프로세스는 격리된 실행 단위다. 각자 주소 공간을 가진다.')) }],
  })
  await mockAiAction(page)
  // consent 게이트 통과 유저 — TEST_USER 엔 aiConsentAt 이 없어 동의 모달에 걸린다 (나중 등록이 우선 매칭)
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      json: {
        data: {
          accessToken: 'mock-access-token',
          user: { ...TEST_USER, aiConsentAt: '2026-01-01T00:00:00.000Z', aiConsentVersion: 'v1' },
        },
      },
    }),
  )
})

test('드래그 → 버블 AI → 패널 → 요청 → 결과 → [교체] 전체 체인이 실브라우저에서 이어진다', async ({ page }) => {
  await gotoDoc(page)
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor()

  // 본문 드래그 선택 (트리플 클릭 = 문단 전체)
  await editor.locator('p').first().click({ clickCount: 3 })

  // ① BubbleMenu AI 버튼이 선택 근처에 뜬다
  const bubbleAi = page.getByTestId('ai-bubble-button')
  await expect(bubbleAi).toBeVisible()
  await bubbleAi.click()

  // ② 패널이 열리고 선택 미리보기·비저장 안내가 있다 (코인은 토큰 환산 — 정액 표기 없음)
  const panel = page.getByTestId('ai-note-panel-desktop')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('저장되지 않아')

  // ③ 선택 하이라이트 데코가 실제로 칠해져 있다 (등록 누락 회귀 — 조용히 no-op 되는 함정)
  const deco = page.locator('.chw-ai-target')
  await expect(deco.first()).toBeVisible()
  const decoBg = await deco.first().evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(decoBg).not.toBe('rgba(0, 0, 0, 0)')

  // ④ 액션 칩 = 즉시 전송 (프리셋 1클릭 · ai-request 버튼은 자유 지시 전용)
  await panel.getByRole('button', { name: /쉽게/ }).click()
  await expect(panel.locator('strong', { hasText: '핵심' })).toBeVisible({ timeout: 5000 })

  // ⑤ [교체] → 본문이 결과로 바뀐다 + 되돌리기 토스트
  await panel.getByRole('button', { name: /교체/ }).click()
  await expect(editor.locator('strong', { hasText: '핵심' })).toBeVisible()
  await expect(editor).not.toContainText('격리된 실행 단위')
  await expect(page.getByRole('button', { name: /되돌리기/ })).toBeVisible()

  // ⑥ 되돌리기 → 원문 복귀 (undo 1회)
  await page.getByRole('button', { name: /되돌리기/ }).click()
  await expect(editor).toContainText('격리된 실행 단위')
})

test('truncated 응답이면 결과 카드에 잘림 경고 배지가 뜬다', async ({ page }) => {
  await gotoDoc(page)
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor()
  await editor.locator('p').first().click({ clickCount: 3 })
  await page.getByTestId('ai-bubble-button').click()
  const panel = page.getByTestId('ai-note-panel-desktop')
  await panel.getByRole('button', { name: /표로/ }).click()
  await expect(panel).toContainText('잘렸어요', { timeout: 5000 })
})

/** 2026-08-19 CEO 실기 3건 회귀 — 레일 진입·본문 미가림·프리뷰 위 휠 */
test('레일 AI 버튼·밀어내기 레이아웃·프리뷰 휠 — 실기 지적 3건', async ({ page }) => {
  await gotoDoc(page)
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor()

  // ① 데스크탑 진입 = 목차 레일 버튼. 툴바 ✦ 는 lg+ 에서 숨김
  await expect(page.locator('[data-tool="ai"]')).toBeHidden()
  const rail = page.getByTestId('ai-rail-open')
  await expect(rail).toBeVisible()
  await rail.click()
  const panel = page.getByTestId('ai-note-panel-desktop')
  await expect(panel).toBeVisible()

  // ② 패널이 본문을 덮지 않는다 — 본문 우변 ≤ 패널 좌변 (밀어내기)
  await page.waitForTimeout(350) // padding transition 완료
  const editorBox = (await editor.boundingBox())!
  const panelBox = (await panel.boundingBox())!
  expect(editorBox.x + editorBox.width).toBeLessThanOrEqual(panelBox.x + 1)

  // ③ 결과 프리뷰 위에서 세로 휠 → 패널이 스크롤된다 (overscroll 가로축 한정)
  await editor.locator('p').first().click({ clickCount: 3 })
  await panel.getByRole('button', { name: /토글 문답/ }).click()
  const preview = panel.locator('.overflow-x-auto.overscroll-x-contain').first()
  await expect(preview).toBeVisible({ timeout: 5000 })
  // 패널 히스토리를 스크롤 가능하게 — 요청을 한 번 더 쌓는다
  await editor.locator('p').first().click({ clickCount: 3 })
  await panel.getByRole('button', { name: /쉽게/ }).click()
  await expect(panel.locator('.overflow-x-auto.overscroll-x-contain').nth(1)).toBeVisible({ timeout: 5000 })
  const scroller = panel.locator('.overflow-y-auto').first()
  const before = await scroller.evaluate((el) => el.scrollTop)
  await scroller.evaluate((el) => el.scrollTo(0, 0))
  const pv = preview
  const box = (await pv.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(20, box.height / 2))
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(200)
  const after = await scroller.evaluate((el) => el.scrollTop)
  expect(after).toBeGreaterThan(0)
  void before
})


/** 2026-08-19 CEO 실기 — "표에 커서 두고 채워달라" 가 새 표를 지어냄. 커서 블록 = 대상 계약 */
test('드래그 없이 커서만 둔 블록도 대상으로 전송된다 (생성 모드 아님)', async ({ page }) => {
  capturedBodies.length = 0
  await gotoDoc(page)
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor()

  // 드래그 없이 단일 클릭 (커서만)
  await editor.locator('p').first().click()
  await page.getByTestId('ai-rail-open').click()
  const panel = page.getByTestId('ai-note-panel-desktop')
  // 대상 칩이 뜬다 = 생성 모드가 아니다
  await expect(panel).toContainText('대상 부분')
  await panel.getByRole('button', { name: /쉽게/ }).click()
  await expect(panel.locator('strong', { hasText: '핵심' })).toBeVisible({ timeout: 5000 })
  // 요청 body 에 커서 블록의 원문이 실려 나갔다
  const last = capturedBodies[capturedBodies.length - 1]
  expect(last.selectionMd ?? '').toContain('격리된 실행 단위')
})
