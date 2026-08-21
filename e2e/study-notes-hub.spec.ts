import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  doc,
  FOLDER_ALGO,
  FOLDER_CS,
  mockStudyNotesApi,
  NOTE_A,
  NOTE_B,
  para,
  type MockHandle,
} from './helpers/studyNotes'

/**
 * 「공부 노트」 허브 스모크 — 목록·필터·검색·폴더 관리·새 노트 (study-notes Phase 3).
 *
 * 허브는 공부 노트와 **카드 안 준비 노트를 한 화면**에서 본다. 준비 노트 행은 읽기 전용이고
 * 클릭하면 원래 자리(스텝 페이지의 준비 노트 섹션)로 딥링크한다 — 데이터는 한 곳에만 있다.
 */

const NOTE_C = 'note-cccc-3333'

const FIXTURE = {
  folders: [
    { id: FOLDER_CS, name: 'CS 기초' },
    { id: FOLDER_ALGO, name: '알고리즘' },
  ],
  notes: [
    {
      id: NOTE_A,
      title: '네트워크 정리',
      folderId: FOLDER_CS,
      content: doc(para('TCP')),
      updatedAt: '2026-08-18T03:00:00.000Z',
    },
    {
      id: NOTE_C,
      title: '정렬 알고리즘',
      folderId: FOLDER_ALGO,
      content: doc(para('quick sort')),
      updatedAt: '2026-08-18T02:00:00.000Z',
    },
    {
      id: NOTE_B,
      title: '면접 기출 모음',
      folderId: null,
      content: doc(para('기출')),
      updatedAt: '2026-08-18T01:00:00.000Z',
    },
  ],
  preps: [
    {
      applicationId: 'app-1',
      companyName: '삼성전자',
      stepId: 'step-1',
      stepName: '1차 면접',
      sheetCount: 3,
      lastUpdatedAt: '2026-08-17T09:00:00.000Z',
    },
  ],
}

async function gotoHub(page: Page, options = FIXTURE): Promise<MockHandle> {
  const handle = await mockStudyNotesApi(page, options)
  await page.goto('/study-notes', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '공부 노트', level: 1 })).toBeVisible()
  return handle
}

const noteRow = (page: Page, title: string) =>
  page.getByRole('link', { name: new RegExp(title) })

/**
 * 폴더 머리 버튼. `getByRole('button', { name: /CS 기초/ })` 는 옆의 `⋯` 메뉴
 * (`aria-label="'CS 기초' 폴더 메뉴"`) 까지 같이 잡아 strict 위반이 난다.
 * 머리 버튼만 글자를 들고 있으므로 텍스트로 좁힌다.
 */
const folderHeader = (page: Page, name: string) =>
  page.locator('button[aria-expanded]', { hasText: name })

/** 「최근」 칩 — 목록 행의 `⋯` 버튼과 이름이 겹치므로 라벨 옆 묶음으로 좁힌다 */
const recentChips = (page: Page) =>
  page
    .getByText('최근', { exact: true })
    .locator('xpath=following-sibling::div[1]')
    .getByRole('button')

// ─────────────────────────────────────────────────────────────

test('목록 — 폴더·미분류·회사 준비·최근 칩이 한 화면에 그려진다', async ({ page }) => {
  await gotoHub(page)

  // 폴더는 가나다순 (영문·숫자가 한글 앞 — 탐색기·파인더와 같은 순서)
  await expect(page.locator('button[aria-expanded]').filter({ hasText: /기초|알고리즘/ })).toHaveText([
    /CS 기초/,
    /알고리즘/,
  ])

  await expect(noteRow(page, '네트워크 정리')).toBeVisible()
  await expect(noteRow(page, '정렬 알고리즘')).toBeVisible()

  await expect(page.getByText('미분류', { exact: true })).toBeVisible()
  await expect(noteRow(page, '면접 기출 모음')).toBeVisible()

  // 준비 노트는 읽기 전용 행 + 스텝 딥링크
  const prep = page.getByRole('link', { name: '삼성전자 1차 면접 준비 노트로 이동' })
  await expect(prep).toContainText('삼성전자 — 1차 면접')
  await expect(prep).toContainText('3장')
  await expect(prep).toHaveAttribute('href', '/board/app-1/steps/step-1#prep-notes')

  // 최근 = 공부·준비 통합 3개 (어제 하던 공부를 1클릭으로 재개 · 최근 수정순)
  await expect(page.getByText('최근', { exact: true })).toBeVisible()
  await expect(recentChips(page)).toHaveCount(3)
  await expect(recentChips(page).nth(0)).toContainText('네트워크 정리')
  await expect(recentChips(page).nth(1)).toContainText('정렬 알고리즘')
  await expect(recentChips(page).nth(2)).toContainText('면접 기출 모음')
})

test('폴더 접기 — 접으면 안의 노트가 숨고 상태가 기기에 기억된다', async ({ page }) => {
  await gotoHub(page)

  const header = folderHeader(page, 'CS 기초')
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  await header.click()
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await expect(noteRow(page, '네트워크 정리')).toHaveCount(0)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(folderHeader(page, 'CS 기초')).toHaveAttribute('aria-expanded', 'false')
  await expect(noteRow(page, '네트워크 정리')).toHaveCount(0)
})

test('필터 3종 — 전체 · 공부 노트 · 회사 준비', async ({ page }) => {
  await gotoHub(page)
  const tab = (name: string) => page.getByRole('tab', { name, exact: true })
  const prep = page.getByRole('link', { name: '삼성전자 1차 면접 준비 노트로 이동' })

  await expect(tab('전체')).toHaveAttribute('aria-selected', 'true')
  await expect(noteRow(page, '네트워크 정리')).toBeVisible()
  await expect(prep).toBeVisible()

  await tab('공부 노트').click()
  await expect(noteRow(page, '네트워크 정리')).toBeVisible()
  await expect(prep).toHaveCount(0)

  await tab('회사 준비').click()
  await expect(prep).toBeVisible()
  await expect(noteRow(page, '네트워크 정리')).toHaveCount(0)
  await expect(page.getByText('미분류', { exact: true })).toHaveCount(0)

  await tab('전체').click()
  await expect(noteRow(page, '네트워크 정리')).toBeVisible()
  await expect(prep).toBeVisible()
})

test('검색 — 노트 제목 · 폴더 이름 · 회사 이름이 한 칸에서 걸리고, 무결과는 빈 상태', async ({
  page,
}) => {
  await gotoHub(page)
  const search = page.getByLabel('노트 · 폴더 · 회사 검색')

  // ① 노트 제목
  await search.fill('네트워크')
  await expect(noteRow(page, '네트워크 정리')).toBeVisible()
  await expect(noteRow(page, '면접 기출 모음')).toHaveCount(0)

  // ② 폴더 이름 → 안의 노트를 전부 보여 준다
  //    (「알고리즘」을 친 사람이 찾는 건 그 이름의 노트가 아니라 그 폴더의 내용이다)
  await search.fill('알고리즘')
  await expect(noteRow(page, '정렬 알고리즘')).toBeVisible()
  await expect(noteRow(page, '네트워크 정리')).toHaveCount(0)

  // ③ 회사 이름
  await search.fill('삼성')
  await expect(page.getByRole('link', { name: '삼성전자 1차 면접 준비 노트로 이동' })).toBeVisible()
  await expect(noteRow(page, '네트워크 정리')).toHaveCount(0)

  // ④ 무결과 — 빈 상태이지 「첫 노트를 만들어 볼까요」가 아니다
  await search.fill('존재하지않는키워드')
  await expect(page.getByText('검색 결과가 없어요')).toBeVisible()
  await expect(page.getByText('첫 공부 노트를 만들어 볼까요?')).toHaveCount(0)

  await search.fill('')
  await expect(noteRow(page, '네트워크 정리')).toBeVisible()
})

test('폴더 — 인라인 생성 (Enter 확정)', async ({ page }) => {
  const handle = await gotoHub(page)

  await page.getByRole('button', { name: '새 폴더', exact: true }).first().click()
  const input = page.getByLabel('새 폴더 이름')
  await expect(input).toBeFocused()

  await input.fill('자료구조')
  await page.keyboard.press('Enter')

  await expect
    .poll(() => handle.posts.filter((p) => p.path === '/study-notes/folders').length)
    .toBe(1)
  expect(handle.posts.at(-1)?.body).toEqual({ name: '자료구조' })
  await expect(folderHeader(page, '자료구조')).toBeVisible()
})

test('폴더 — 이름 바꾸기는 Enter 로 확정 · ESC 로 취소 (시트 탭과 같은 규약)', async ({
  page,
}) => {
  await gotoHub(page)

  const patched: string[] = []
  await page.route('http://localhost:3000/study-notes/folders/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      patched.push(String((route.request().postDataJSON() as { name: string }).name))
    }
    await route.fallback()
  })

  const openRename = async () => {
    await page.getByRole('button', { name: "'CS 기초' 폴더 메뉴" }).click()
    await page.getByRole('menuitem', { name: '이름 바꾸기' }).click()
    return page.getByLabel('폴더 이름')
  }

  // ── ESC = 취소 (서버로 아무것도 안 나간다)
  let input = await openRename()
  await input.fill('버려질 이름')
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('폴더 이름')).toHaveCount(0)
  await expect(folderHeader(page, 'CS 기초')).toBeVisible()
  expect(patched).toEqual([])

  // ── Enter = 확정
  input = await openRename()
  await input.fill('컴퓨터 기초')
  await page.keyboard.press('Enter')
  await expect.poll(() => patched).toEqual(['컴퓨터 기초'])
  await expect(folderHeader(page, '컴퓨터 기초')).toBeVisible()
})

test('새 노트 — 즉시 생성되고 문서 페이지로 넘어간다', async ({ page }) => {
  const handle = await gotoHub(page)

  await page.getByRole('button', { name: '새 노트', exact: true }).first().click()

  await expect(page).toHaveURL(/\/study-notes\/note-new-9999$/)
  await expect(page.getByLabel('노트 제목')).toBeVisible()
  await expect(page.getByLabel('노트 제목')).toHaveAttribute('placeholder', '제목 없음')
  await expect(page.locator('.chw-prose')).toBeVisible()
  expect(handle.posts.filter((p) => p.path === '/study-notes')).toHaveLength(1)
})

test('빈 상태 — 노트도 폴더도 없으면 템플릿 카드가 온보딩을 대신한다', async ({ page }) => {
  const handle = await gotoHub(page, { folders: [], notes: [], preps: [] })

  await expect(page.getByText('첫 공부 노트를 만들어 볼까요?')).toBeVisible()
  // 2026-08-18 확장 — 7종 (기존 3 + 인성 면접·직무 지식·주간 계획·어학 자격증)
  const templates = page.getByRole('button', {
    name: /CS 정리|면접 기출 모음|오답 노트|인성 면접 답변 스크립트|직무 지식 정리|주간 공부 계획|어학 · 자격증 대비/,
  })
  await expect(templates).toHaveCount(7)

  await templates.first().click()
  await expect(page).toHaveURL(/\/study-notes\/note-new-9999$/)
  // 템플릿은 서식 가이드 겸용 — 본문이 실려 나간다
  const body = handle.posts.find((p) => p.path === '/study-notes')?.body
  expect(typeof body?.content).toBe('string')
  expect(String(body?.content ?? '').length).toBeGreaterThan(0)
})

test('노트 삭제 — ⋯ 메뉴 → 확인 모달 → 목록에서 사라진다', async ({ page }) => {
  await gotoHub(page)

  await page.getByRole('button', { name: "'면접 기출 모음' 노트 메뉴" }).click()
  await page.getByRole('menuitem', { name: '삭제' }).click()

  const modal = page.getByText('노트를 삭제하면 안의 내용도 사라져요. 되돌릴 수 없어요.')
  await expect(modal).toBeVisible()
  await page.getByRole('button', { name: '삭제', exact: true }).click()

  await expect(noteRow(page, '면접 기출 모음')).toHaveCount(0)
})

/**
 * 🔴 **용량 표시는 폭에 따라 자리가 다르다 — 그리고 절대 둘이 같이 보이면 안 된다.**
 *
 * 데스크탑은 헤더 우측(CTA 아래), 모바일은 목록 하단. 두 인스턴스가 각각
 * `hidden lg:flex` / `lg:hidden` 으로 갈리는데, **jsdom 은 미디어 쿼리를 풀지 않아**
 * 클래스 문자열까지만 볼 수 있다 — 클래스가 잘못 바뀌어 둘 다 보이거나 둘 다 사라져도
 * 유닛 테스트는 통과한다. 그래서 이 계약은 실브라우저에서만 잠긴다.
 */
test('용량 표시 — 폭마다 한 곳에만 뜨고 요청은 1회', async ({ page }) => {
  /* 🔴 세는 건 `route` 가 아니라 `request` 이벤트다 — 목이 나중에 등록돼 **먼저** 잡으므로
     여기서 route 를 걸면 영영 0 이 된다 (mock 이 fulfill 하면 fallback 이 안 온다). */
  let usageRequests = 0
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/myinfo/storage-usage') usageRequests += 1
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await gotoHub(page)

  /* 🔴 `getByText` 는 **숨은 요소도 센다** (DOM 기준) — 두 인스턴스가 늘 2로 잡혀 계약을
     검증하지 못한다. role 조회는 `display:none` 을 a11y 트리에서 빼므로 **눈에 보이는
     것만** 남는다 = 스크린리더가 읽는 것과 같은 기준. */
  const bars = page.getByRole('progressbar', { name: /파일 저장 용량/ })
  await expect(bars).toHaveCount(1)
  // 데스크탑 = 헤더 안 (목록보다 위)
  const headerBar = (await bars.boundingBox())!
  const title = (await page.getByRole('heading', { name: '공부 노트', level: 1 }).boundingBox())!
  expect(headerBar.y).toBeGreaterThan(title.y)
  expect(headerBar.y).toBeLessThan(300)

  // 모바일 = 헤더에서 사라지고 하단으로 내려간다
  await page.setViewportSize({ width: 320, height: 720 })
  await expect(bars).toHaveCount(1)
  const mobileBar = (await bars.boundingBox())!
  expect(mobileBar.y).toBeGreaterThan(400)

  // 인스턴스가 둘이어도 서버 요청은 하나 (React Query dedupe)
  expect(usageRequests).toBe(1)
})
