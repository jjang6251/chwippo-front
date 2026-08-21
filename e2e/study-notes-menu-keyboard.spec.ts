import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  doc,
  FOLDER_ALGO,
  FOLDER_CS,
  gotoDoc,
  mockStudyNotesApi,
  NOTE_A,
  para,
  tool,
} from './helpers/studyNotes'

/**
 * `role="menu"` 드롭다운 **세 곳의 키보드 탐색** — 실제 키 입력으로 (2026-08-21).
 *
 * ## 🔴 왜 jsdom 이 아니라 여기인가
 *
 * jsdom 의 포커스는 실제 브라우저와 어긋나는 구간이 있다:
 *   - jsdom 은 클릭해도 버튼에 **포커스를 주지 않는다** → "마우스로 열면 포커스가 어디에
 *     있나" 를 원리적으로 못 잰다 (거기서는 늘 body 다).
 *   - jsdom 은 `<button>` 의 **Enter·Space 기본 활성화를 구현하지 않는다** → "가로채지
 *     않았다" 까지만 잴 수 있고 "그래서 진짜 실행된다" 는 못 잰다.
 *   - `Escape` 뒤 포커스가 트리거로 돌아왔는지도 실제 focus 이동이 걸린 문제다.
 *
 * 그래서 여기서는 `document.activeElement` 를 직접 읽는다. 단위 계약(항목 순환·Home/End)은
 * `src/test/menuKeyboardContract.ts` 가 세 메뉴에 **같은 단언문**으로 이미 돌고 있고,
 * 이 파일은 그 위에서 **브라우저만 답할 수 있는 것**을 덮는다.
 */

/** 지금 포커스된 요소의 신원 — 역할·접근성 이름·글자 */
async function active(page: Page): Promise<{ role: string; label: string; text: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return {
      role: el?.getAttribute('role') ?? el?.tagName.toLowerCase() ?? 'none',
      label: el?.getAttribute('aria-label') ?? '',
      text: (el?.textContent ?? '').trim(),
    }
  })
}

const menu = (page: Page) => page.getByRole('menu')
const items = (page: Page) => page.getByRole('menuitem')

// ─────────────────────────────────────────────────────────────
// 1. 노트 메뉴 (StudyNoteDocPage 의 DocMenu) — 항목 3개
// ─────────────────────────────────────────────────────────────

test('노트 메뉴 — 키보드로 열면 첫 항목 포커스 · ↓↑ 순환 · ESC 뒤 트리거 복귀', async ({
  page,
}) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '키보드 노트', folderId: null, content: doc(para('본문')) }],
  })
  await gotoDoc(page)

  const trigger = page.getByRole('button', { name: '노트 메뉴' })

  // 키보드로 열기 = 트리거에 포커스를 두고 Enter (진짜 키 입력)
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(menu(page)).toBeVisible()

  const labels = await items(page).allTextContents()
  expect(labels).toEqual(['PDF로 저장', '마크다운으로 내보내기', '노트 삭제'])

  // 🔴 키보드로 열었으면 첫 항목에 포커스가 있어야 한다 — 없으면 조작할 방법이 없다
  expect((await active(page)).text).toBe('PDF로 저장')

  await page.keyboard.press('ArrowDown')
  expect((await active(page)).text).toBe('마크다운으로 내보내기')
  await page.keyboard.press('ArrowDown')
  expect((await active(page)).text).toBe('노트 삭제')

  // 마지막에서 ↓ = 처음으로 (순환)
  await page.keyboard.press('ArrowDown')
  expect((await active(page)).text).toBe('PDF로 저장')
  // 처음에서 ↑ = 마지막으로
  await page.keyboard.press('ArrowUp')
  expect((await active(page)).text).toBe('노트 삭제')

  await page.keyboard.press('Home')
  expect((await active(page)).text).toBe('PDF로 저장')
  await page.keyboard.press('End')
  expect((await active(page)).text).toBe('노트 삭제')

  // 🔴 ESC 뒤 포커스가 트리거로 — 안 하면 body 로 날아가 다음 Tab 이 페이지 맨 앞으로 튄다
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  expect((await active(page)).label).toBe('노트 메뉴')
})

test('노트 메뉴 — 마우스로 열면 포커스를 항목에 강제로 주지 않는다 (↓ 를 눌러야 들어간다)', async ({
  page,
}) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '키보드 노트', folderId: null, content: doc(para('본문')) }],
  })
  await gotoDoc(page)

  await page.getByRole('button', { name: '노트 메뉴' }).click()
  await expect(menu(page)).toBeVisible()

  // 포커스는 트리거(방금 누른 버튼)에 머문다 — 항목으로 뛰지 않는다
  const afterClick = await active(page)
  expect(afterClick.role).not.toBe('menuitem')
  expect(afterClick.label).toBe('노트 메뉴')

  // 그래도 ↓ 한 번이면 바로 들어간다
  await page.keyboard.press('ArrowDown')
  expect((await active(page)).text).toBe('PDF로 저장')
})

test('노트 메뉴 — Enter 는 가로채지 않는다 (네이티브 button 이 실제로 실행한다)', async ({
  page,
}) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '키보드 노트', folderId: null, content: doc(para('본문')) }],
  })
  await gotoDoc(page)

  await page.getByRole('button', { name: '노트 메뉴' }).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('End') // 마지막 항목 = 노트 삭제
  expect((await active(page)).text).toBe('노트 삭제')

  await page.keyboard.press('Enter')
  // 진짜 실행됐다 — 삭제 확인 모달이 떴다 (jsdom 은 이 기본 활성화를 구현하지 않는다)
  await expect(page.getByRole('dialog')).toBeVisible()
})

// ─────────────────────────────────────────────────────────────
// 2. 툴바 「내보내기」 (EditorToolbar) — 항목 2개
// ─────────────────────────────────────────────────────────────

test('툴바 「내보내기」 — 마우스로 열어도 ↓ 로 들어가고 ESC 뒤 트리거로 돌아온다', async ({
  page,
}) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '키보드 노트', folderId: null, content: doc(para('본문')) }],
  })
  await gotoDoc(page)

  await tool(page, 'export').click()
  await expect(menu(page)).toBeVisible()
  expect(await items(page).count()).toBe(2)

  // 🔴 마우스로 열었을 때 강제 포커스가 없어야 ProseMirror 선택 영역이 살아 있다
  expect((await active(page)).role).not.toBe('menuitem')

  await page.keyboard.press('ArrowDown')
  expect((await active(page)).label).toBe('마크다운(.md)')
  await page.keyboard.press('ArrowDown')
  expect((await active(page)).label).toBe('PDF로 저장')
  // 항목 2개짜리 순환도 맞는다
  await page.keyboard.press('ArrowDown')
  expect((await active(page)).label).toBe('마크다운(.md)')
  await page.keyboard.press('ArrowUp')
  expect((await active(page)).label).toBe('PDF로 저장')

  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  expect((await active(page)).label).toBe('내보내기')
})

// ─────────────────────────────────────────────────────────────
// 3. 허브 행 ⋯ (HubRows 의 DotsMenu) — 항목 수 가변
// ─────────────────────────────────────────────────────────────

test('허브 ⋯ — 항목 수가 달라도 순환이 맞고 Enter 가 실제로 폴더를 옮긴다', async ({ page }) => {
  const handle = await mockStudyNotesApi(page, {
    folders: [
      { id: FOLDER_CS, name: 'CS 기초' },
      { id: FOLDER_ALGO, name: '알고리즘' },
    ],
    notes: [
      { id: NOTE_A, title: '네트워크 정리', folderId: FOLDER_CS, content: doc(para('TCP')) },
    ],
  })
  await page.goto('/study-notes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '공부 노트', level: 1 })).toBeVisible()

  const trigger = page.getByRole('button', { name: "'네트워크 정리' 노트 메뉴" })
  await trigger.focus()
  await page.keyboard.press('Enter')

  // 미분류 + 폴더 2 + 삭제 = 4 (폴더 수를 따라 늘어나는 목록)
  await expect(items(page)).toHaveCount(4)
  expect((await active(page)).text).toBe('미분류')

  await page.keyboard.press('End')
  expect((await active(page)).text).toBe('삭제')
  // 마지막에서 ↓ = 처음 (4개짜리 순환)
  await page.keyboard.press('ArrowDown')
  expect((await active(page)).text).toBe('미분류')

  await page.keyboard.press('ArrowDown')
  expect((await active(page)).text).toBe('📁 CS 기초')
  await page.keyboard.press('ArrowDown')
  expect((await active(page)).text).toBe('📁 알고리즘')

  // Enter 는 우리가 가로채지 않는다 — 네이티브 button 이 실제 이동을 낸다
  await page.keyboard.press('Enter')
  await expect(menu(page)).toHaveCount(0)
  await expect.poll(() => handle.patches.map((p) => p.body.folderId)).toContain(FOLDER_ALGO)

  /*
    🔴 여기서는 포커스 복귀를 요구하지 않는다 — 노트가 다른 폴더로 **옮겨가면서 그 행이
    통째로 다시 그려져** 트리거 버튼 자체가 사라진다. 돌아갈 자리가 없는 것이지 복귀가
    깨진 게 아니다 (트리거가 살아남는 경우의 복귀는 아래 「내보내기」 검사가 잠근다).
  */
  await expect(page.getByRole('link', { name: /네트워크 정리/ })).toBeVisible()
})

test('툴바 「내보내기」 — Enter 로 실제 내려받고, 닫힌 뒤 포커스가 트리거로 돌아온다', async ({
  page,
}) => {
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '내보내기 노트', folderId: null, content: doc(para('본문')) }],
  })
  await gotoDoc(page)

  const downloadPromise = page.waitForEvent('download')
  await tool(page, 'export').focus()
  await page.keyboard.press('Enter')
  // 키보드로 열었으니 첫 항목에 포커스가 있다 — 그대로 Enter
  expect((await active(page)).label).toBe('마크다운(.md)')
  await page.keyboard.press('Enter')

  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('내보내기 노트.md')
  await expect(menu(page)).toHaveCount(0)
  // 🔴 항목을 골라 닫혔어도 포커스는 트리거로 (다음 Tab 이 페이지 맨 앞으로 안 튄다)
  expect((await active(page)).label).toBe('내보내기')
})

test('허브 ⋯ — 바깥을 마우스로 누르면 닫히되 포커스를 트리거로 뺏지 않는다', async ({ page }) => {
  await mockStudyNotesApi(page, {
    folders: [{ id: FOLDER_CS, name: 'CS 기초' }],
    notes: [
      { id: NOTE_A, title: '네트워크 정리', folderId: FOLDER_CS, content: doc(para('TCP')) },
    ],
  })
  await page.goto('/study-notes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '공부 노트', level: 1 })).toBeVisible()

  const trigger = page.getByRole('button', { name: "'CS 기초' 폴더 메뉴" })
  await trigger.focus()
  await page.keyboard.press('Enter')
  expect((await active(page)).text).toBe('이름 바꾸기')

  // 마우스로 바깥을 누르는 순간부터는 "마우스로 운전 중" — 포커스를 되돌리지 않는다
  await page.getByRole('heading', { name: '공부 노트', level: 1 }).click()
  await expect(menu(page)).toHaveCount(0)
  expect((await active(page)).label).not.toBe("'CS 기초' 폴더 메뉴")
})
