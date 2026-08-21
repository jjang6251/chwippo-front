import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { doc, gotoDoc, mockStudyNotesApi, NOTE_A, para, preseedTheme } from './helpers/studyNotes'

/**
 * 「PDF로 저장」 = 브라우저 인쇄 (study-note-media PR-B · 게이트).
 *
 * ## 🔴 여기가 **유일한** 게이트인 이유
 *
 * 인쇄물의 절반은 `@media print` 안에서만 존재한다 — 접힌 토글이 펼쳐지는 것도,
 * 사이드바·툴바·목차가 사라지는 것도, 본문이 지면 폭으로 벌어지는 것도 전부 그 안이다.
 * jsdom 은 미디어 쿼리를 풀지 않으니 원리적으로 못 잡는다. 그래서 화면 상태·전역 복원은
 * 단위 spec(`StudyNoteDocPage.test.tsx` 26~37)이 잠그고, **미디어가 실제로 걸리는지**는
 * `emulateMedia({ media: 'print' })` 로 여기서만 확인한다.
 *
 * ## 🔴 토글은 보이기만 해야 한다
 *
 * 접힘/펼침은 **문서에 저장되는 값**이다(`persist: true`). 인쇄하려고 `open` 을 켜면
 * 자동 저장이 그걸 그대로 서버로 보내서, PDF 한 번 뽑았다고 접어 둔 self-test 가 통째로
 * 풀려 버린다. 그래서 펼침은 CSS 로만 하고, 이 spec 이 **PATCH 가 안 나갔음**까지 본다.
 *
 * ## 툴바 「내보내기」 형식 선택 (파일 끝 섹션)
 *
 * 같은 인쇄 경로로 들어가는 **두 번째 손잡이**라 여기에 함께 둔다. 그쪽은 잘림·좁은 화면
 * 좌표처럼 레이아웃이 있어야만 판정되는 것들이 이유다 (섹션 머리말 참조).
 */

/** 1x1 투명 PNG — 외부 요청 없이 `img` 규칙(지면 폭·페이지 넘김)을 태우려는 최소 픽스처 */
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/** 접힌 토글 + 형광펜 + 코드 + 표 + 그림 — 인쇄 규칙이 걸리는 표면을 한 문서에 모은다 */
const PRINTABLE = doc(
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'TCP 와 UDP' }] },
  para('TCP 는 연결 지향 프로토콜이다.'),
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        marks: [{ type: 'highlight', attrs: { color: 'yellow' } }],
        text: '3-way handshake',
      },
    ],
  },
  {
    type: 'codeBlock',
    attrs: { language: 'javascript' },
    content: [{ type: 'text', text: 'const socket = connect()' }],
  },
  {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: [
          { type: 'tableHeader', content: [para('구분')] },
          { type: 'tableHeader', content: [para('특징')] },
        ],
      },
      {
        type: 'tableRow',
        content: [
          { type: 'tableCell', content: [para('TCP')] },
          { type: 'tableCell', content: [para('신뢰성')] },
        ],
      },
    ],
  },
  { type: 'image', attrs: { src: PNG_1X1 } },
  // 🔴 **접힌** 토글 — 화면에서는 안 보이고 종이에서는 보여야 한다
  {
    type: 'details',
    attrs: { open: false },
    content: [
      { type: 'detailsSummary', content: [{ type: 'text', text: 'Q. 3-way handshake 순서는?' }] },
      { type: 'detailsContent', content: [para('SYN → SYN-ACK → ACK')] },
    ],
  },
)

/** 마지막 모드는 기기에 저장된다 — 읽기로 고정해 두고 들어간다 */
async function preseedReadMode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('study-notes:mode:v1', 'read')
    } catch {
      /* ignore */
    }
  })
}

interface PrintProbe {
  calls: number
  /** print() 가 불린 **그 순간**의 값 — 복원 뒤에 재면 아무것도 못 본다 */
  theme: string
  title: string
}

/**
 * 진짜 인쇄 다이얼로그는 테스트를 멈춰 세운다 — `window.print` 를 가로채 호출 순간의
 * 전역만 기록하고, 브라우저가 그러듯 곧바로 `afterprint` 를 낸다.
 */
async function stubPrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = { calls: 0, theme: '', title: '' }
    Object.defineProperty(window, '__printProbe', { value: probe })
    window.print = () => {
      probe.calls += 1
      probe.theme = document.documentElement.getAttribute('data-theme') ?? ''
      probe.title = document.title
      window.dispatchEvent(new Event('afterprint'))
    }
  })
}

function readProbe(page: Page): Promise<PrintProbe> {
  return page.evaluate(() => {
    const w = window as Window & { __printProbe?: PrintProbe }
    return w.__printProbe ?? { calls: 0, theme: '', title: '' }
  })
}

// ─────────────────────────────────────────────────────────────
// @media print — 여기서만 볼 수 있는 것들
// ─────────────────────────────────────────────────────────────

test('인쇄 미디어 — 접힌 토글이 펼쳐지고 셰브론은 사라진다 · 🔴 문서는 그대로다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await preseedReadMode(page)
  const handle = await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  const answer = page.getByText('SYN → SYN-ACK → ACK')
  const chevron = page.locator(".chw-prose [data-type='details'] > button")
  const contentPatches = () =>
    handle.patches.filter((p) => typeof p.body.content === 'string').length

  // 화면 — 접혀 있다 (self-test 가 성립하는 상태)
  await expect(answer).toBeHidden()
  await expect(chevron).toBeVisible()

  /*
    🔴 기준선을 **여기서** 잡는다 — 문서를 열면 tiptap 이 스키마 기본값을 채워 넣고
    (표 셀 attrs·끝 빈 문단) 그게 자동 저장 debounce(1.5s)를 타고 한 번 나간다.
    인쇄와 무관한 그 저장을 「토글이 저장됐다」로 오해하면 안 된다.
  */
  await page.waitForTimeout(2000)
  const before = contentPatches()

  await page.emulateMedia({ media: 'print' })

  // 종이 — 답이 보이고, 누를 수 없는 셰브론은 없다
  await expect(answer).toBeVisible()
  await expect(chevron).toBeHidden()

  // 🔴 debounce 를 넘겨도 **새 본문 저장이 없다** — CSS 로만 펼쳤다는 증거
  await page.waitForTimeout(2000)
  expect(contentPatches()).toBe(before)
  // 저장돼 있는 문서에서도 토글은 여전히 접혀 있다
  const saved = handle.lastSavedDoc()
  const details = saved?.content?.find(
    (n): n is { type: string; attrs: { open: boolean } } =>
      typeof n === 'object' && n !== null && (n as { type?: string }).type === 'details',
  )
  expect(details?.attrs.open).toBe(false)

  // 화면으로 돌아오면 다시 접혀 있다 (문서 상태를 만진 적이 없으니 당연해야 한다)
  await page.emulateMedia({ media: 'screen' })
  await expect(answer).toBeHidden()
})

test('인쇄 미디어 — 앱 크롬이 전부 사라진다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await preseedReadMode(page)
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  const chrome = {
    사이드바: page.locator('aside[data-nav]'),
    모바일탭: page.locator('nav[data-nav]'),
    목차: page.getByRole('navigation', { name: '목차' }),
    모드탭: page.getByRole('tablist', { name: '보기 모드' }),
    문서메뉴: page.getByRole('button', { name: '노트 메뉴' }),
    글자수: page.getByText(/\/ 100,000/),
  }

  // 화면에서는 살아 있다 (숨김이 print 때문이라는 걸 대조로 못 박는다).
  // 모바일탭은 데스크탑 폭에서 이미 없으므로 대조 대상에서 뺀다.
  await expect(chrome.사이드바).toBeVisible()
  await expect(chrome.목차).toBeVisible()
  await expect(chrome.모드탭).toBeVisible()
  await expect(chrome.문서메뉴).toBeVisible()
  await expect(chrome.글자수).toBeVisible()

  await page.emulateMedia({ media: 'print' })

  for (const [name, locator] of Object.entries(chrome)) {
    await expect(locator, `${name} 가 인쇄에 남아 있다`).toBeHidden()
  }

  // 본문은 남는다 — 크롬만 지운 것이지 문서를 지운 게 아니다
  await expect(page.getByText('TCP 는 연결 지향 프로토콜이다.')).toBeVisible()
})

test('인쇄 미디어 — 편집 툴바·AI 진입도 사라진다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  // 편집 모드로 들어왔다 (툴바는 읽기 모드에서는 아예 렌더되지 않는다)
  const bold = page.locator('[data-tool="bold"]')
  await expect(bold).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  await expect(bold).toBeHidden()
})

test('인쇄 미디어 — 본문 폭 제한이 풀리고 색 보존이 켜진다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await preseedReadMode(page)
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  const body = page.locator('.chw-prose')
  const screenWidth = (await body.boundingBox())?.width ?? 0
  // 읽기 폭 = 720px 상한
  expect(screenWidth).toBeLessThanOrEqual(720)

  await page.emulateMedia({ media: 'print' })

  const printWidth = (await body.boundingBox())?.width ?? 0
  expect(printWidth).toBeGreaterThan(screenWidth + 100)

  // 🔴 형광펜·코드블록 배경·표 헤더는 문서의 일부다 — 브라우저의 「배경 안 찍기」를 껐다
  expect(await body.evaluate((el) => getComputedStyle(el).printColorAdjust)).toBe('exact')
  const markBg = await page
    .locator('.chw-prose mark[data-color="yellow"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(markBg).not.toBe('rgba(0, 0, 0, 0)')

  // 그림은 지면을 넘지 않는다
  const img = page.locator('.chw-prose img')
  expect(await img.evaluate((el) => getComputedStyle(el).maxWidth)).toBe('100%')
  expect(await img.evaluate((el) => getComputedStyle(el).maxHeight)).not.toBe('none')
})

// ─────────────────────────────────────────────────────────────
// 메뉴 → 인쇄 (전역 스왑·복원은 실브라우저에서도 한 번 본다)
// ─────────────────────────────────────────────────────────────

test('「PDF로 저장」 — 다크 사용자도 라이트로 찍히고 파일명은 노트 제목이다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await preseedTheme(page, 'dark')
  await preseedReadMode(page)
  await stubPrint(page)
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  const tabTitle = await page.title()
  expect(await page.getAttribute('html', 'data-theme')).toBe('dark')

  await page.getByRole('button', { name: '노트 메뉴' }).click()
  await page.getByRole('menuitem', { name: 'PDF로 저장' }).click()

  await expect.poll(async () => (await readProbe(page)).calls).toBe(1)
  const probe = await readProbe(page)
  expect(probe.theme).toBe('light')
  expect(probe.title).toBe('네트워크 정리')

  // afterprint 뒤 — 빌린 전역 둘 다 돌아왔다
  await expect.poll(() => page.getAttribute('html', 'data-theme')).toBe('dark')
  expect(await page.title()).toBe(tabTitle)
})

test('「PDF로 저장」 — 편집 중에 눌러도 읽기 모드로 찍힌다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await stubPrint(page)
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  // 편집 모드 — 제목이 입력 필드고 툴바가 떠 있다
  await expect(page.getByLabel('노트 제목')).toBeVisible()

  await page.getByRole('button', { name: '노트 메뉴' }).click()
  await page.getByRole('menuitem', { name: 'PDF로 저장' }).click()

  await expect.poll(async () => (await readProbe(page)).calls).toBe(1)
  // 인쇄가 끝난 시점의 화면은 읽기 모드 — 제목이 h1 이고 툴바가 없다
  await expect(page.getByRole('heading', { name: '네트워크 정리', level: 1 })).toBeVisible()
  await expect(page.locator('[data-tool="bold"]')).toHaveCount(0)
})

/**
 * 🔴 **바탕은 라이트일 때만 비운다 — 「읽을 수 있는 쪽으로 실패」.**
 *
 * `print-color-adjust: exact` 는 상속이라 바탕(`bg-bg`)까지 찍으라고 시킨다 = 한 장을 통째로
 * 토너가 덮는다. 라이트 강제의 목적이 잉크 절약이었으므로 바탕은 비운다.
 *
 * 그런데 라이트 강제는 `beforeprint`(JS)가 한다. **그게 안 걸린 채 다크로 인쇄되면** 글자색은
 * 밝은 톤인데 바탕만 비어 **흰 종이에 흰 글씨** = 백지가 된다. 그래서 비우는 규칙을
 * `[data-theme='light']` 안에 가둔다 — 다크가 남으면 배경이 그대로 찍힌다(잉크는 먹지만 읽힌다).
 *
 * 이 두 케이스는 **실브라우저에서만** 판정된다 (미디어 쿼리 + 조상 선택자 조합).
 */
test('인쇄 바탕 — 라이트면 비우고, 다크가 남으면 살린다', async ({ page }) => {
  const surfaces = () =>
    page.evaluate(() => {
      const paint = (el: Element | null) =>
        el ? getComputedStyle(el).backgroundColor : 'none'
      return {
        html: paint(document.documentElement),
        shell: paint(document.querySelector('.chw-app-surface')),
      }
    })

  await preseedTheme(page, 'dark')
  await mockStudyNotesApi(page)
  await gotoDoc(page)
  await page.emulateMedia({ media: 'print' })

  // ① 전환 실패 시나리오 — 다크가 남아 있으면 바탕을 살려야 읽힌다
  const darkLeft = await surfaces()
  expect(darkLeft.shell).not.toBe('rgba(0, 0, 0, 0)')

  // ② 정상 — beforeprint 가 하는 일을 그대로 재현하면 바탕이 비워진다
  await page.evaluate(() =>
    document.documentElement.setAttribute('data-theme', 'light'),
  )
  const lightOn = await surfaces()
  expect(lightOn.html).toBe('rgba(0, 0, 0, 0)')
  expect(lightOn.shell).toBe('rgba(0, 0, 0, 0)')
})

// ─────────────────────────────────────────────────────────────
// 툴바 「내보내기」 → 형식 선택 메뉴 (2026-08-21)
// ─────────────────────────────────────────────────────────────

/**
 * 🔴 **여기서만 판정되는 것: 메뉴가 잘리는가.**
 *
 * 툴바 행은 `overflow-x-auto` 라 CSS 규칙상 `overflow-y` 도 auto 가 된다 — 그 안에 absolute
 * 로 띄운 메뉴는 화면에 **없는 것처럼** 잘린다. jsdom 은 레이아웃도 overflow 도 모르니
 * 원리적으로 못 잡는다(단위 spec 은 「스크롤 행 밖에 산다」는 구조만 고정한다).
 * 그래서 실제 좌표와 **hit target** 으로 여기서 본다 — 잘려 있으면 클릭이 못 닿는다.
 */
const TOOLBAR_ROW = '[data-tool="bold"]'

/** 툴바 가로 스크롤 컨테이너 (버튼의 조상) */
function toolbarRow(page: Page) {
  return page.locator(TOOLBAR_ROW).locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")]')
}

test('툴바 「내보내기」 — 메뉴가 스크롤 행 밖으로 나가고도 잘리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await stubPrint(page)
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  await page.getByRole('button', { name: '내보내기' }).click()
  const menu = page.getByTestId('export-menu')
  await expect(menu).toBeVisible()

  // 메뉴는 툴바 행 **아래**로 완전히 빠져나와 있다 — 안에 있었다면 여기서 잘린다
  const row = (await toolbarRow(page).boundingBox())!
  const box = (await menu.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(row.y + row.height - 1)
  expect(box.height).toBeGreaterThan(40)

  /* 🔴 hit target — 잘려 있으면 Playwright 의 클릭 가능성 검사가 통과하지 못한다.
     맨 아래 항목(가장 많이 삐져나온 쪽)으로 확인한다 */
  await page.getByRole('menuitem', { name: 'PDF로 저장' }).click()
  await expect.poll(async () => (await readProbe(page)).calls).toBe(1)
  await expect(menu).toBeHidden()
})

test('툴바 「내보내기」 — 375px 에서 열리고 화면 밖으로 안 나간다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  // 「내보내기」는 툴바 맨 끝 — 실제 사용자처럼 먼저 툴바를 끝까지 민다
  const row = toolbarRow(page)
  await row.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  await page.getByRole('button', { name: '내보내기' }).click()

  const menu = page.getByTestId('export-menu')
  await expect(menu).toBeVisible()
  const box = (await menu.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(375)

  // 두 항목 모두 실제로 눌 수 있다 (모바일에서 pointer-events 를 죽인 툴팁을 베끼지 않았다)
  await expect(page.getByRole('menuitem', { name: '마크다운(.md)' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'PDF로 저장' })).toBeVisible()
})

test('툴바 가로 스크롤 회귀 — 메뉴가 생겨도 툴바는 여전히 밀린다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '네트워크 정리', folderId: null, content: PRINTABLE }],
  })
  await gotoDoc(page)

  const row = toolbarRow(page)
  const metrics = await row.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }))
  // 좁은 화면에서는 가로로 넘친다 (넘치지 않으면 이 검증이 무의미해진다)
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
  // 🔴 세로로는 안 넘친다 — 넘치면 툴바가 위아래로 미끄러진다 (JobSiteChips 회귀 패턴)
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight)

  const moved = await row.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
    return el.scrollLeft
  })
  expect(moved).toBeGreaterThan(0)
})
