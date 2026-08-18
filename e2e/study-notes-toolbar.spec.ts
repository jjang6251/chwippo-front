import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import fs from 'node:fs'
import {
  doc,
  gotoDoc,
  mockStudyNotesApi,
  NOTE_A,
  NOTE_B,
  para,
  pasteText,
  selectAll,
  setTheme,
  tool,
  typeFresh,
  type MockHandle,
} from './helpers/studyNotes'

/**
 * 「공부 노트」 툴바 — **모든 버튼이 진짜로 문서를 바꾸는가** (study-notes Phase 3 · 게이트 2).
 *
 * ## 🔴 왜 jsdom 이 아니라 여기인가
 *
 * 데모에서 형광펜이 **CDN 로드 실패로 조용히 죽어 있었다**. 버튼은 눌렸고, 명령은 돌았고,
 * 문서 JSON 에는 mark 가 남았다 — 화면만 아무 변화가 없었다. jsdom 은 스타일시트를 적용하지
 * 않으므로 이런 사고를 **원리적으로** 못 잡는다. 그래서 여기서는 명령의 성공이 아니라
 * **DOM 과 computed style** 을 본다: `mark[data-color]` 가 실제로 배경색을 갖는가,
 * `.hljs-keyword` 가 실제로 색을 갖는가.
 *
 * ## 상태 격리
 *
 * 블록 변환은 한 번 하면 되돌리기 어렵다 (전체 선택 후 지워도 블록 종류가 남는다).
 * 그래서 검사 하나에 페이지 하나 — 각 test 가 자기 픽스처로 새로 진입한다.
 */

const PLAIN = {
  notes: [{ id: NOTE_A, title: '검증 노트', folderId: null, content: doc(para('본문 한 줄')) }],
}

/** 저장된 doc 안의 details 노드들 (`open` 상태 확인용) */
function detailsStates(node: unknown): boolean[] {
  const out: boolean[] = []
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return
    const obj = n as { type?: string; attrs?: { open?: boolean }; content?: unknown[] }
    if (obj.type === 'details') out.push(obj.attrs?.open === true)
    obj.content?.forEach(walk)
  }
  walk(node)
  return out
}

/** 자동 저장(1.5s debounce)이 실제로 나갈 때까지 */
async function waitForSave(handle: MockHandle, page: Page): Promise<void> {
  await expect.poll(() => handle.patches.length, { timeout: 8000 }).toBeGreaterThan(0)
  await page.waitForTimeout(100)
}

// ─────────────────────────────────────────────────────────────
// 인라인 마크 — B · I · U · S
// ─────────────────────────────────────────────────────────────

test('B·I·U·S — 선택 → 클릭 → 마크 DOM + 버튼 active, 재클릭 해제', async ({ page }) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '강조할 문장')

  const cases = [
    { key: 'bold', tag: 'strong' },
    { key: 'italic', tag: 'em' },
    { key: 'underline', tag: 'u' },
    { key: 'strike', tag: 's' },
  ] as const

  for (const { key, tag } of cases) {
    await selectAll(page)
    const button = tool(page, key)
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await button.click()
    await expect(page.locator(`.chw-prose ${tag}`)).toHaveText('강조할 문장')
    await expect(button).toHaveAttribute('aria-pressed', 'true')

    // 같은 버튼을 다시 = 해제 (켜지기만 하고 안 꺼지면 형광펜 사고와 같은 종류의 반쪽 동작)
    await button.click()
    await expect(page.locator(`.chw-prose ${tag}`)).toHaveCount(0)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
  }
})

// ─────────────────────────────────────────────────────────────
// 제목 — H1 · H2 · H3 + TOC
// ─────────────────────────────────────────────────────────────

test('H1·H2·H3 — 변환 + 목차 반영 (h1 포함 — 2026-08-18 정정)', async ({ page }) => {
  // 목차는 xl(1280px) 이상에서만 그려진다 — 사이드바까지 든 실폭에서 본다
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '섹션 제목')

  const toc = page.locator('nav[aria-label="목차"] button')

  await tool(page, 'h2').click()
  await expect(page.locator('.chw-prose h2')).toHaveText('섹션 제목')
  await expect(tool(page, 'h2')).toHaveAttribute('aria-pressed', 'true')
  await expect(toc).toHaveText(['섹션 제목'])

  await tool(page, 'h3').click()
  await expect(page.locator('.chw-prose h3')).toHaveText('섹션 제목')
  await expect(toc).toHaveText(['섹션 제목'])

  // h1 도 목차에 오른다 — 툴바·마크다운이 h1 을 만드는 이상 챕터 축이 빠지면
  // 긴 문서에서 "지금 어디쯤"을 잃는다 (2026-08-18 목차 세부 검증에서 정정)
  await tool(page, 'h1').click()
  await expect(page.locator('.chw-prose h1')).toHaveText('섹션 제목')
  await expect(toc).toHaveText(['섹션 제목'])
})

// ─────────────────────────────────────────────────────────────
// 목록 세 종류
// ─────────────────────────────────────────────────────────────

test('글머리 목록 — 툴바 변환 + 해제', async ({ page }) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '첫 항목')

  await tool(page, 'bulletList').click()
  await expect(page.locator('.chw-prose ul:not([data-type]) li')).toHaveText(['첫 항목'])
  await expect(tool(page, 'bulletList')).toHaveAttribute('aria-pressed', 'true')

  await tool(page, 'bulletList').click()
  await expect(page.locator('.chw-prose ul:not([data-type])')).toHaveCount(0)
})

test('번호 목록 — 입력 규칙(`1. `)으로 만들어진다 (툴바 버튼은 없음 = mockup 대로)', async ({
  page,
}) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '')

  /*
    🔴 툴바에 번호 목록 버튼이 **없다** — mockup 툴바에도 없어서 의도된 생략으로 본다.
    다만 스키마에는 살아 있고 사용자는 `1. ` 로 만든다. 버튼이 없다는 이유로 기능까지 죽어
    있으면 마크다운 붙여넣기로 들어온 번호 목록도 손으로 못 만든다 — 그래서 여기서 잠근다.
  */
  await expect(tool(page, 'orderedList')).toHaveCount(0)

  await page.keyboard.type('1. 첫째')
  await page.keyboard.press('Enter')
  await page.keyboard.type('둘째')
  await expect(page.locator('.chw-prose ol li')).toHaveText(['첫째', '둘째'])
})

test('체크리스트 — 툴바 변환 + 박스 클릭으로 checked 토글', async ({ page }) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '복습 항목')

  await tool(page, 'taskList').click()
  const item = page.locator('.chw-prose ul[data-type="taskList"] li')
  await expect(item).toHaveText('복습 항목')
  await expect(item).toHaveAttribute('data-checked', 'false')
  await expect(tool(page, 'taskList')).toHaveAttribute('aria-pressed', 'true')

  await item.locator('input[type="checkbox"]').click()
  await expect(item).toHaveAttribute('data-checked', 'true')
  await item.locator('input[type="checkbox"]').click()
  await expect(item).toHaveAttribute('data-checked', 'false')
})

// ─────────────────────────────────────────────────────────────
// 토글 (details)
// ─────────────────────────────────────────────────────────────

test('토글 — 삽입 · 개별 접기/펼치기 · 「모두 접기」 일괄 · open 이 저장 JSON 에 남는다', async ({
  page,
}) => {
  const handle = await mockStudyNotesApi(page, {
    notes: [
      {
        id: NOTE_A,
        title: '토글 노트',
        folderId: null,
        content: doc(para('답 하나: 3-way handshake'), para('답 둘: 비연결 지향')),
      },
    ],
  })
  await gotoDoc(page)

  const details = page.locator('.chw-prose [data-type="details"]')
  const content = page.locator('.chw-prose [data-type="detailsContent"]')

  // ── 삽입 — 문단 두 개를 각각 토글로 감싼다
  await page.locator('.chw-prose p', { hasText: '답 하나' }).click()
  await tool(page, 'details').click()
  await expect(details).toHaveCount(1)
  await page.keyboard.type('질문 1')
  await expect(page.locator('.chw-prose summary').first()).toHaveText('질문 1')

  await page.locator('.chw-prose p', { hasText: '답 둘' }).click()
  await tool(page, 'details').click()
  await expect(details).toHaveCount(2)

  // 새로 만든 토글은 접힌 채로 시작한다 (self-test 기본값)
  await expect(content.first()).toHaveAttribute('hidden', /.*/)

  // ── 개별 펼치기/접기 — 셰브론 버튼
  const chevron = details.first().locator('button')
  await chevron.click()
  await expect(content.first()).not.toHaveAttribute('hidden', /.*/)
  await chevron.click()
  await expect(content.first()).toHaveAttribute('hidden', /.*/)

  // ── 「모두 …」 일괄 (읽기 모드 전용)
  await page.getByRole('tab', { name: '읽기' }).click()
  const bulk = page.getByRole('button', { name: /모두 (접기|펼치기)/ })
  await expect(bulk).toHaveText('🙈 모두 펼치기')

  await bulk.click()
  await expect(content.first()).not.toHaveAttribute('hidden', /.*/)
  await expect(content.nth(1)).not.toHaveAttribute('hidden', /.*/)
  await expect(bulk).toHaveText('🙈 모두 접기')

  // ── open 이 문서에 저장된다 (접고 저장하면 다음에도 접힘 = plan §3)
  await waitForSave(handle, page)
  await expect
    .poll(() => detailsStates(handle.lastSavedDoc()), { timeout: 8000 })
    .toEqual([true, true])

  await bulk.click()
  await expect(content.first()).toHaveAttribute('hidden', /.*/)
  await expect
    .poll(() => detailsStates(handle.lastSavedDoc()), { timeout: 8000 })
    .toEqual([false, false])
})

// ─────────────────────────────────────────────────────────────
// 코드 블록 — 데모 사고의 직접 재발 방지
// ─────────────────────────────────────────────────────────────

test('코드 블록 — 삽입 + hljs 하이라이트 클래스가 실제로 붙는다', async ({ page }) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '')

  await tool(page, 'codeBlock').click()
  await expect(page.locator('.chw-prose pre code')).toHaveCount(1)
  await expect(tool(page, 'codeBlock')).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.type('const answer = function () { return 1 }')

  /*
    🔴 이것이 데모 사고의 재발 방지선이다 — lowlight 가 안 붙어 있으면 코드는 여전히
    `<pre><code>` 로 보이고 **아무 에러도 안 난다**. 토큰 span 이 실제로 생기는지만이 증거다.
  */
  await expect(page.locator('.chw-prose pre code .hljs-keyword').first()).toBeVisible()
  await expect(page.locator('.chw-prose pre code .hljs-keyword')).toHaveCount(3) // const · function · return
  await expect(page.locator('.chw-prose pre code .hljs-number')).toHaveCount(1)
})

// ─────────────────────────────────────────────────────────────
// 표
// ─────────────────────────────────────────────────────────────

test('표 — 3×3 삽입 · 행/열 추가·삭제 · 표 삭제', async ({ page }) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '')

  await tool(page, 'table').click()
  const rows = page.locator('.chw-prose table tr')
  const headerCells = page.locator('.chw-prose table th')
  const bodyCells = page.locator('.chw-prose table td')
  await expect(rows).toHaveCount(3)
  await expect(headerCells).toHaveCount(3)
  await expect(bodyCells).toHaveCount(6)

  // 행·열 조작 줄은 표 안에 커서가 있을 때만 나온다
  const action = (key: string) => page.locator(`[data-table-action="${key}"]`)
  await expect(action('addRowAfter')).toBeVisible()

  /*
    삽입 직후 커서는 **머리글 칸**에 있다 — 거기서 「행 삭제」를 누르면 머리글이 통째로
    날아간다. 사용자가 실제로 행을 늘리는 자리는 본문 칸이므로 그리로 옮겨 놓고 잰다.
  */
  await bodyCells.first().click()
  await action('addRowAfter').click()
  await expect(rows).toHaveCount(4)
  await expect(bodyCells).toHaveCount(9)

  await action('deleteRow').click()
  await expect(rows).toHaveCount(3)
  await expect(headerCells).toHaveCount(3)

  await action('addColumnAfter').click()
  await expect(headerCells).toHaveCount(4)
  await action('deleteColumn').click()
  await expect(headerCells).toHaveCount(3)

  /*
    데스크탑에서는 래퍼가 있어도 **아무 것도 달라 보이지 않아야** 한다 — 표가 컨테이너를
    가득 채우고 가로 스크롤이 안 생긴다 (320px 보호가 넓은 화면을 건드리지 않는다는 확인).
  */
  const desktop = await page.locator('.chw-prose .tableWrapper').evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    tableWidth: (el.querySelector('table') as HTMLElement).getBoundingClientRect().width,
  }))
  expect(desktop.scrollWidth).toBe(desktop.clientWidth)
  expect(Math.round(desktop.tableWidth)).toBe(desktop.clientWidth)

  await action('deleteTable').click()
  await expect(page.locator('.chw-prose table')).toHaveCount(0)
})

test('표 — 320px 에서 자기 래퍼 안에서 가로 스크롤 (페이지는 안 밀린다 · 세로 스크롤 0)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '')
  await tool(page, 'table').click()
  await expect(page.locator('.chw-prose table')).toHaveCount(1)

  /*
    🔴 래퍼가 없으면 `table-layout: fixed; width: 100%` 가 열을 320px 안으로 **찌그러뜨린다**.
    페이지는 안 밀리니 겉으로는 멀쩡해 보이지만 3열이 84px 씩(한글 4~5자) 되어 표를 읽을 수
    없다. "넘치는 표는 자기 래퍼 안에서 가로 스크롤한다" 가 실제로 사는지 여기서 잰다.
  */
  const wrapper = page.locator('.chw-prose .tableWrapper')
  await expect(wrapper).toHaveCount(1)

  const box = await wrapper.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }))
  expect(box.scrollWidth).toBeGreaterThan(box.clientWidth)
  // 가로 스크롤 컨테이너가 세로 스크롤까지 부르면 안 된다 (JobSiteChips 회귀 패턴)
  expect(box.scrollHeight).toBeLessThanOrEqual(box.clientHeight)

  // 페이지 자체는 가로로 안 밀린다
  const doc320 = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(doc320.scrollWidth).toBeLessThanOrEqual(doc320.clientWidth)
})

// ─────────────────────────────────────────────────────────────
// 형광펜 5색
// ─────────────────────────────────────────────────────────────

const HL_COLORS = ['yellow', 'green', 'blue', 'red', 'purple'] as const

test('형광펜 5색 — 적용 시 computed 배경이 실재 · 같은 색 재클릭 해제 · 다른 색은 덮어쓰기(중첩 0)', async ({
  page,
}) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await setTheme(page, 'dark')
  await typeFresh(page, '형광펜 대상 문장')

  const mark = page.locator('.chw-prose mark')
  const seen = new Map<string, string>()

  for (const color of HL_COLORS) {
    await selectAll(page)
    await tool(page, `hl-${color}`).click()

    await expect(mark).toHaveCount(1)
    await expect(mark).toHaveAttribute('data-color', color)
    await expect(tool(page, `hl-${color}`)).toHaveAttribute('aria-pressed', 'true')

    // 🔴 실측 — 명령이 돌았다는 것과 화면에 색이 칠해졌다는 것은 다른 사실이다
    const bg = await mark.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg, `${color} 배경이 투명하다 — 스타일이 안 붙었다`).not.toBe('rgba(0, 0, 0, 0)')
    expect(bg).not.toBe('transparent')
    seen.set(color, bg)

    // 같은 색 재클릭 = 해제
    await tool(page, `hl-${color}`).click()
    await expect(mark).toHaveCount(0)
  }

  // 5색이 서로 다른 색이어야 5색이다
  expect(new Set(seen.values()).size).toBe(HL_COLORS.length)

  // ── 다른 색 = 교체 (중첩 mark 0)
  await selectAll(page)
  await tool(page, 'hl-yellow').click()
  await expect(mark).toHaveAttribute('data-color', 'yellow')
  await selectAll(page)
  await tool(page, 'hl-blue').click()
  await expect(mark).toHaveCount(1)
  await expect(mark).toHaveAttribute('data-color', 'blue')
  await expect(page.locator('.chw-prose mark mark')).toHaveCount(0)

  // ── 지우개
  await selectAll(page)
  await tool(page, 'hl-clear').click()
  await expect(mark).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────
// 링크
// ─────────────────────────────────────────────────────────────

test('링크 — 정상 URL 삽입 · javascript: 는 실행 가능한 링크가 되지 않는다', async ({ page }) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)

  await typeFresh(page, '치뽀 홈')
  await selectAll(page)
  page.once('dialog', (d) => void d.accept('https://chwippo.com'))
  await tool(page, 'link').click()
  await expect(page.locator('.chw-prose a')).toHaveAttribute('href', 'https://chwippo.com')

  await typeFresh(page, '위험한 링크')
  await selectAll(page)
  page.once('dialog', (d) => void d.accept('javascript:alert(1)'))
  await tool(page, 'link').click()

  const href = await page.locator('.chw-prose a').getAttribute('href')
  expect(href ?? '', 'javascript: 스킴이 href 로 살아 있으면 클릭 한 번이 곧 실행이다').not.toMatch(
    /^\s*javascript:/i,
  )
})

// ─────────────────────────────────────────────────────────────
// 멘션
// ─────────────────────────────────────────────────────────────

test('멘션 — [[ → 팝오버 → 키보드 선택 → 칩 렌더 → 클릭 이동', async ({ page }) => {
  await mockStudyNotesApi(page, {
    notes: [
      { id: NOTE_A, title: '검증 노트', folderId: null, content: doc(para('본문')) },
      { id: NOTE_B, title: '운영체제 정리', folderId: null, content: doc(para('os')) },
      { id: 'note-cccc-3333', title: '자료구조 정리', folderId: null, content: doc(para('ds')) },
    ],
  })
  await gotoDoc(page)
  await typeFresh(page, '참고 ')
  await page.keyboard.type('[[')

  const popover = page.locator('[data-testid="mention-suggestion"]')
  await expect(popover).toBeVisible()

  // 자기 자신은 후보에서 빠진다
  const options = page.locator('[data-testid="mention-option"]')
  await expect(options).toHaveCount(2)
  await expect(options.first()).toContainText('운영체제 정리')

  // 키보드 탐색 — 이 팝오버는 타이핑 중에 뜨므로 손이 이미 키보드에 있다
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowUp')
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  await expect(popover).toHaveCount(0)
  const chip = page.locator('[data-testid="study-note-mention"]')
  await expect(chip).toContainText('자료구조 정리')
  await expect(chip).toHaveAttribute('data-note-id', 'note-cccc-3333')

  // 칩 클릭 = SPA 이동 (풀 리로드가 아니라 onNavigate 경로)
  await chip.click()
  await expect(page).toHaveURL(/\/study-notes\/note-cccc-3333$/)
  await expect(page.getByLabel('노트 제목')).toHaveValue('자료구조 정리')
})

test('멘션 — ESC 로 팝오버를 닫으면 칩이 안 생긴다', async ({ page }) => {
  await mockStudyNotesApi(page, {
    notes: [
      { id: NOTE_A, title: '검증 노트', folderId: null, content: doc(para('본문')) },
      { id: NOTE_B, title: '운영체제 정리', folderId: null, content: doc(para('os')) },
    ],
  })
  await gotoDoc(page)
  await typeFresh(page, '')
  await page.keyboard.type('[[')
  await expect(page.locator('[data-testid="mention-suggestion"]')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('[data-testid="mention-suggestion"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="study-note-mention"]')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────
// 마크다운 붙여넣기
// ─────────────────────────────────────────────────────────────

const MARKDOWN_CHUNK = [
  '## 네트워크 3-way handshake',
  '',
  '- [ ] SYN 복습',
  '- [x] ACK 복습',
  '',
  '| 단계 | 플래그 |',
  '| --- | --- |',
  '| 1 | SYN |',
  '',
  '```javascript',
  'const socket = connect()',
  '```',
  '',
  '1. 첫째',
  '2. 둘째',
].join('\n')

test('마크다운 붙여넣기 — 제목·체크리스트·표·코드·번호목록이 서식으로 들어온다', async ({
  page,
}) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '')
  await pasteText(page, MARKDOWN_CHUNK)

  await expect(page.locator('.chw-prose h2')).toHaveText('네트워크 3-way handshake')

  const tasks = page.locator('.chw-prose ul[data-type="taskList"] li')
  await expect(tasks).toHaveCount(2)
  await expect(tasks.nth(0)).toHaveAttribute('data-checked', 'false')
  await expect(tasks.nth(1)).toHaveAttribute('data-checked', 'true')

  await expect(page.locator('.chw-prose table th')).toHaveText(['단계', '플래그'])
  await expect(page.locator('.chw-prose table td')).toHaveText(['1', 'SYN'])

  // 코드 언어까지 보존 → 하이라이팅이 실제로 붙는다
  await expect(page.locator('.chw-prose pre code')).toHaveClass(/language-javascript/)
  await expect(page.locator('.chw-prose pre code .hljs-keyword')).toHaveCount(1)

  await expect(page.locator('.chw-prose ol li')).toHaveText(['첫째', '둘째'])
})

test('마크다운 붙여넣기 — 신호가 한 종류뿐인 평문은 평문 그대로 (오탐 방지)', async ({ page }) => {
  await mockStudyNotesApi(page, PLAIN)
  await gotoDoc(page)
  await typeFresh(page, '')

  // `- ` 로 시작하는 줄만 있다 = 신호 한 종류 → 파싱하지 않는다
  await pasteText(page, '- 면접 복장 준비\n- 포트폴리오 인쇄\n- 교통편 확인')

  await expect(page.locator('.chw-prose ul')).toHaveCount(0)
  await expect(page.locator('.chw-prose')).toContainText('- 면접 복장 준비')
})

// ─────────────────────────────────────────────────────────────
// md 내보내기
// ─────────────────────────────────────────────────────────────

test('md 내보내기 — 다운로드가 실제로 떨어지고 내용이 마크다운 구조를 갖는다', async ({
  page,
}) => {
  await mockStudyNotesApi(page, {
    notes: [
      {
        id: NOTE_A,
        title: '내보내기 노트',
        folderId: null,
        content: doc(
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '큰 제목' }] },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [para('첫 항목')] },
              { type: 'listItem', content: [para('둘째 항목')] },
            ],
          },
          para('평범한 문단'),
        ),
      },
    ],
  })
  await gotoDoc(page)

  const downloadPromise = page.waitForEvent('download')
  await tool(page, 'export').click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('내보내기 노트.md')

  const filePath = await download.path()
  expect(filePath).toBeTruthy()
  const markdown = fs.readFileSync(filePath!, 'utf-8')
  expect(markdown).toContain('## 큰 제목')
  expect(markdown).toMatch(/^[-*] 첫 항목$/m)
  expect(markdown).toContain('평범한 문단')

  // 열화 명세를 사용자에게 알린다 (형광펜 색·토글 접힘은 마크다운에 없다)
  await expect(page.getByText(/마크다운으로 내보냈어요/)).toBeVisible()
})

test('툴바 sticky — 깊게 스크롤해도 상단 헤더 아래 붙어서 동작한다 (2026-08-18 실기)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const longDoc = JSON.stringify({
    type: 'doc',
    content: Array.from({ length: 80 }, (_, i) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: `긴 문서 문단 ${i + 1} — 스크롤 깊이 확보.` }],
    })),
  })
  await mockStudyNotesApi(page, {
    notes: [{ id: 'note-long-1', title: '긴 노트', folderId: null, content: longDoc }],
  })
  await page.goto('/study-notes/note-long-1', { waitUntil: 'domcontentloaded' })
  await page.locator('.chw-prose').waitFor({ state: 'visible' })

  // 맨 아래 문단까지 스크롤
  await page.locator('.chw-prose p').last().scrollIntoViewIfNeeded()

  // 툴바가 헤더(48px) 바로 아래 붙어 있다 — sticky 가 없으면 화면 밖(음수/-수백 px)
  const bar = page.locator('[data-tool="bold"]').locator('..').locator('..').locator('..')
  const top = await page
    .locator('[data-tool="bold"]')
    .evaluate((el) => Math.round(el.closest('.sticky')?.getBoundingClientRect().top ?? -9999))
  expect(top).toBeGreaterThanOrEqual(44)
  expect(top).toBeLessThanOrEqual(56)
  void bar

  // 그 자리에서 실제로 동작한다 — 마지막 문단 선택 → Bold
  await page.locator('.chw-prose p').last().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  // 전체 선택은 문서 전체를 잡으므로 마지막 줄만 다시 — Home 후 Shift+End
  await page.keyboard.press('End')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+ArrowLeft' : 'Shift+Home')
  await tool(page, 'bold').click()
  await expect(tool(page, 'bold')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.chw-prose strong').last()).toContainText('문단 80')
})

/**
 * 코드 블록 헤더 — 언어 select + 복사 (mockup `paste-demo`·`detail-desktop` 스펙).
 *
 * ## 🔴 왜 여기여야 하는가
 *
 * 이 헤더의 두 기능은 **jsdom 이 원리적으로 못 보는 것**에 걸려 있다.
 * ① 언어를 바꾸면 lowlight 가 다시 칠하는데, 그 결과는 `.hljs-*` 스팬과 **computed color**
 *    로만 확인된다 (유닛은 attr 이 바뀐 것까지만 안다).
 * ② 클립보드는 브라우저 권한과 실제 시스템 클립보드가 필요하다.
 *
 * 시나리오:
 *   ① 언어가 박힌 코드 블록 → 헤더 select 가 그 값을 보여 준다
 *   ② select 변경 → 저장 JSON 의 `attrs.language` 가 바뀌고 하이라이팅이 살아 있다
 *   ③ 복사 → 시스템 클립보드에 **코드 원문** · 라벨이 「복사됨」
 *   ④ 읽기 모드 → 언어는 잠기고(비활성) 복사는 그대로 동작한다
 */
test.describe('코드 블록 헤더', () => {
  const CODE = 'const answer = function () { return 1 }'
  const codeDoc = (language: string | null) =>
    doc({
      type: 'codeBlock',
      attrs: { language },
      content: [{ type: 'text', text: CODE }],
    })

  const langSelect = (page: Page) => page.locator('.chw-codeblock-lang select')
  const copyBtn = (page: Page) => page.locator('.chw-codeblock-copy')

  async function gotoCode(page: Page, language: string | null = 'javascript') {
    const handle = await mockStudyNotesApi(page, {
      notes: [{ id: NOTE_A, title: '코드 노트', folderId: null, content: codeDoc(language) }],
    })
    await gotoDoc(page, NOTE_A)
    await page.locator('.chw-codeblock').waitFor({ state: 'visible' })
    return handle
  }

  test('① 언어가 박힌 코드 블록 — 헤더 select 가 그 값을 보여 준다', async ({ page }) => {
    await gotoCode(page, 'c')
    await expect(langSelect(page)).toHaveValue('c')
    // auto 를 포함한 선택지가 실제로 열린다 (라벨이 아니라 고를 수 있는 UI 여야 한다)
    await expect(langSelect(page).locator('option')).toHaveCount(17)
  })

  test('② select 변경 → 저장 JSON 의 language 가 바뀌고 하이라이팅이 산다', async ({ page }) => {
    const handle = await gotoCode(page, 'javascript')
    // 바꾸기 전에도 색이 칠해져 있다 (비교 기준)
    await expect(page.locator('.chw-prose .hljs-keyword').first()).toBeVisible()

    await langSelect(page).selectOption('sql')

    // 자동 저장(1.5s debounce)이 끝나면 문서에 남는다
    await expect
      .poll(
        () => {
          const saved = handle.lastSavedDoc() as
            | { content?: { attrs?: { language?: string } }[] }
            | null
          return saved?.content?.[0]?.attrs?.language ?? null
        },
        { timeout: 8000 },
      )
      .toBe('sql')

    await expect(langSelect(page)).toHaveValue('sql')
    // 🔴 재하이라이팅 — 스팬이 사라지면 언어만 바뀌고 색은 죽은 것이다
    const highlighted = page.locator('.chw-prose [class*="hljs-"]')
    await expect(highlighted.first()).toBeVisible()
    const color = await highlighted
      .first()
      .evaluate((el) => getComputedStyle(el).color)
    expect(color).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('③ 복사 → 클립보드에 코드 원문 · 라벨이 「복사됨」', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await gotoCode(page, 'javascript')

    await copyBtn(page).click()
    await expect(copyBtn(page)).toContainText('복사됨')

    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe(CODE)

    // 1.5초 뒤 원래 라벨로 돌아온다 — 「복사됨」이 남아 있으면 다음 복사가 됐는지 알 수 없다
    await expect(copyBtn(page)).toContainText('복사', { timeout: 4000 })
    await expect(copyBtn(page)).not.toContainText('복사됨', { timeout: 4000 })
  })

  test('④ 읽기 모드 — 언어는 잠기고 복사는 동작한다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await gotoCode(page, 'javascript')

    await page.getByRole('tab', { name: '읽기' }).click()
    await expect(langSelect(page)).toBeDisabled()

    // 복사는 읽기 모드가 주 무대다 — 여기서 죽으면 기능의 절반이 없는 것이다
    await copyBtn(page).click()
    await expect(copyBtn(page)).toContainText('복사됨')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE)
  })
})
