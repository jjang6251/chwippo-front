import type { Page, Request } from '@playwright/test'
import { mockAuth } from './auth'

/**
 * 공부 노트 e2e 공용 목 — **백엔드 무의존**.
 *
 * 🔴 glob 은 `http://localhost:3000/**` 전체 URL 형식만 쓴다. `**\/api\/**` 같은 상대 glob 은
 * Vite 가 내려주는 소스 모듈(`/src/pages/StudyNotes/...`)까지 매칭돼 모듈 로딩이 통째로
 * 깨진다 (qa.md 명시). 그래서 라우트 하나에 모아 두고 URL 을 직접 갈라 본다.
 *
 * 목 등록 순서 = **덜 구체적인 것 먼저**. Playwright 는 나중에 등록된 핸들러를 먼저 보므로
 * 마지막의 `mockAuth('**\/auth/refresh')` 가 catch-all 을 이긴다 (interview-practice 관례).
 */

export const NOTE_A = 'note-aaaa-1111'
export const NOTE_B = 'note-bbbb-2222'
export const FOLDER_CS = 'folder-cs-1'
export const FOLDER_ALGO = 'folder-algo-1'

/** tiptap doc JSON 문자열 — 서버가 `content` 에 담아 주는 것과 같은 형태 */
export function doc(...content: unknown[]): string {
  return JSON.stringify({ type: 'doc', content })
}

export function para(text: string) {
  return { type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }
}

export interface StudyNoteFixture {
  id: string
  title: string
  folderId: string | null
  content: string | null
  updatedAt?: string
}

export interface MockOptions {
  notes?: StudyNoteFixture[]
  folders?: { id: string; name: string }[]
  preps?: {
    applicationId: string
    companyName: string
    stepId: string
    stepName: string
    sheetCount: number
    lastUpdatedAt: string
  }[]
  backlinks?: unknown[]
  /** 노트 생성 응답 id (허브 「새 노트」 → 문서 이동 검증용) */
  createdNoteId?: string
}

export interface MockHandle {
  /** PATCH /study-notes/:id 로 나간 본문들 — 저장이 실제로 나갔는지 확인용 */
  patches: { id: string; body: Record<string, unknown> }[]
  /** POST /study-notes · /study-notes/folders 요청 본문 */
  posts: { path: string; body: Record<string, unknown> }[]
  /** 마지막으로 저장된 content 를 tiptap doc 으로 파싱 (없으면 null) */
  lastSavedDoc(): { type: string; content?: unknown[] } | null
}

const ISO = '2026-08-18T01:00:00.000Z'

const DEFAULT_NOTES: StudyNoteFixture[] = [
  {
    id: NOTE_A,
    title: '네트워크 정리',
    folderId: FOLDER_CS,
    content: doc(para('TCP 는 연결 지향 프로토콜이다.')),
  },
  {
    id: NOTE_B,
    title: '운영체제 정리',
    folderId: null,
    content: doc(para('프로세스와 스레드의 차이.')),
  },
]

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data }),
})

function bodyOf(request: Request): Record<string, unknown> {
  try {
    return (request.postDataJSON() as Record<string, unknown>) ?? {}
  } catch {
    return {}
  }
}

export async function mockStudyNotesApi(
  page: Page,
  options: MockOptions = {},
): Promise<MockHandle> {
  const notes = (options.notes ?? DEFAULT_NOTES).map((n) => ({
    updatedAt: ISO,
    ...n,
  }))
  const folders = (options.folders ?? [{ id: FOLDER_CS, name: 'CS 기초' }]).map((f, i) => ({
    parentId: null,
    sortOrder: i,
    createdAt: ISO,
    updatedAt: ISO,
    ...f,
  }))
  const preps = options.preps ?? []
  const backlinks = options.backlinks ?? []
  const createdNoteId = options.createdNoteId ?? 'note-new-9999'

  const handle: MockHandle = {
    patches: [],
    posts: [],
    lastSavedDoc() {
      for (let i = handle.patches.length - 1; i >= 0; i--) {
        const raw = handle.patches[i].body.content
        if (typeof raw !== 'string' || raw === '') continue
        try {
          return JSON.parse(raw) as { type: string; content?: unknown[] }
        } catch {
          return null
        }
      }
      return null
    },
  }

  const listRow = (n: (typeof notes)[number]) => ({
    id: n.id,
    title: n.title,
    folderId: n.folderId,
    updatedAt: n.updatedAt,
    backlinkCount: 0,
  })

  await page.route('http://localhost:3000/**', (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname

    // ── 공부 노트 ──────────────────────────────────────────
    if (path === '/study-notes/folders' && method === 'GET') return route.fulfill(json(folders))
    if (path === '/study-notes/folders' && method === 'POST') {
      const body = bodyOf(request)
      handle.posts.push({ path, body })
      const created = {
        id: `folder-new-${folders.length}`,
        name: String(body.name ?? ''),
        parentId: null,
        sortOrder: folders.length,
        createdAt: ISO,
        updatedAt: ISO,
      }
      folders.push(created)
      return route.fulfill(json(created))
    }
    if (path.startsWith('/study-notes/folders/')) {
      const id = path.split('/').pop()!
      if (method === 'PATCH') {
        const body = bodyOf(request)
        const target = folders.find((f) => f.id === id)
        if (target) target.name = String(body.name ?? target.name)
        return route.fulfill(json(target ?? {}))
      }
      if (method === 'DELETE') return route.fulfill(json(null))
    }
    if (path === '/study-notes/hub/prep' && method === 'GET') return route.fulfill(json(preps))

    if (path === '/study-notes' && method === 'GET') return route.fulfill(json(notes.map(listRow)))
    if (path === '/study-notes' && method === 'POST') {
      const body = bodyOf(request)
      handle.posts.push({ path, body })
      const created = {
        id: createdNoteId,
        title: String(body.title ?? ''),
        folderId: null,
        content: (body.content as string | undefined) ?? null,
        updatedAt: ISO,
        createdAt: ISO,
        backlinkCount: 0,
      }
      notes.push(created)
      return route.fulfill(json(created))
    }

    const backlinkMatch = /^\/study-notes\/([^/]+)\/backlinks$/.exec(path)
    if (backlinkMatch) return route.fulfill(json(backlinks))

    const noteMatch = /^\/study-notes\/([^/]+)$/.exec(path)
    if (noteMatch) {
      const id = noteMatch[1]
      const target = notes.find((n) => n.id === id)
      if (method === 'GET') {
        if (!target) return route.fulfill({ status: 404, body: '{}' })
        return route.fulfill(json({ ...target, createdAt: ISO, backlinkCount: 0 }))
      }
      if (method === 'PATCH') {
        const body = bodyOf(request)
        handle.patches.push({ id, body })
        if (target) Object.assign(target, body)
        return route.fulfill(
          json({ ...(target ?? { id }), createdAt: ISO, updatedAt: ISO, backlinkCount: 0 }),
        )
      }
      if (method === 'DELETE') return route.fulfill(json(null))
    }

    // ── 셸이 켜질 때 같이 뜨는 것들 ─────────────────────────
    // 종 배지는 목록 응답의 `unreadCount` 를 읽는다 — 배열을 주면 undefined 라 react-query 가 던진다
    if (path === '/notifications')
      return route.fulfill(json({ items: [], unreadCount: 0, nextCursor: null }))
    if (path.includes('coin-balance'))
      return route.fulfill(
        json({
          balance: 100,
          monthlyCoinLimit: 100,
          tier: 'free',
          nextResetAt: '2026-09-01T00:00:00Z',
        }),
      )
    if (path.includes('streak')) return route.fulfill(json({ streak: { current: 3 } }))
    // 허브 하단 저장 용량 바 — 안 주면 fallback `[]` 이 흘러들어 「undefined / undefinedMB」가 뜬다
    if (path === '/myinfo/storage-usage')
      return route.fulfill(
        json({
          usedBytes: 3_355_443,
          limitBytes: 104_857_600,
          usedMB: 3.2,
          limitMB: 100,
          percentage: 3,
          breakdown: { myinfoBytes: 2_097_152, noteImageBytes: 1_258_291 },
        }),
      )

    return route.fulfill(json([]))
  })

  await mockAuth(page)
  return handle
}

/** 테마 강제 — 형광펜·hljs 색은 `:root[data-theme]` 두 벌이라 명시적으로 세운다 */
export async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t)
  }, theme)
}

/** 로드 시점부터 테마 고정 (리로드 왕복 검증용) */
export async function preseedTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('chwippo-theme', t)
    } catch {
      /* ignore */
    }
  }, theme)
}

/** 문서 페이지 진입 — 에디터가 붙을 때까지 기다린다 */
export async function gotoDoc(page: Page, id: string = NOTE_A): Promise<void> {
  await page.goto(`/study-notes/${id}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.chw-prose').waitFor({ state: 'visible', timeout: 20000 })
}

/**
 * 본문을 비우고 새로 친다 — 서식 검증은 늘 알려진 한 문단에서 시작한다.
 *
 * 🔴 전체 선택 후 지워도 **블록 종류는 남는다** (제목 안에서 지우면 여전히 제목).
 * 그래서 문단으로 되돌리는 단축키를 한 번 밟고 시작한다.
 */
export async function typeFresh(page: Page, text: string): Promise<void> {
  const body = page.locator('.chw-prose')
  await body.click()
  /*
    🔴 첫 전체 선택이 **가끔 빈다** — 클릭 직후 아직 포커스가 안 앉은 프레임이 있어서
    `Mod-a` 가 통째로 흘러가고, 그 다음 Backspace 가 글자 하나만 지운 채로 이어진다
    (실제로 「본문 한 줄」이 「본문 한 」이 되어 검증이 엉뚱한 문장을 보게 됐다).
    성공을 눈으로 확인할 때까지 반복한다.
  */
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    if (await body.evaluate((el) => (el.textContent ?? '').trim() === '')) break
  }
  await page.keyboard.press('ControlOrMeta+Alt+0')
  if (text) await page.keyboard.type(text)
}

/**
 * 클립보드 붙여넣기 — 평문만 실어 보낸다.
 *
 * `text/html` 이 같이 오면 에디터가 tiptap 기본 경로로 넘기므로(마크다운 게이트를 안 탄다)
 * 여기서는 **평문 한 종류만** 넣는다. 실제 「AI 답변 복사 → 붙여넣기」와 같은 모양.
 */
export async function pasteText(page: Page, text: string): Promise<void> {
  await page.locator('.chw-prose').click()
  await page.evaluate((value) => {
    const el = document.querySelector('.chw-prose')
    if (!el) throw new Error('.chw-prose 를 찾지 못했다')
    const dt = new DataTransfer()
    dt.setData('text/plain', value)
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, text)
}

/**
 * 본문 전체 선택 (마크·형광펜은 선택 영역이 있어야 걸린다).
 *
 * 선택이 비면 명령은 **성공하고도** 아무 글자에 안 걸린다(다음 입력용 stored mark 만 남는다).
 * 그러면 "형광펜이 안 칠해졌다" 를 툴바 탓으로 오진하게 되므로 선택 자체를 확인한다.
 */
export async function selectAll(page: Page): Promise<void> {
  await page.locator('.chw-prose').click()
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ControlOrMeta+a')
    const picked = await page.evaluate(() => (window.getSelection()?.toString() ?? '').trim() !== '')
    if (picked) return
  }
  throw new Error('본문 전체 선택에 실패했다 — 에디터가 포커스를 못 받았다')
}

/** 툴바 버튼 — `data-tool` 키로 (배열 순서·라벨 변경에 안 흔들린다) */
export function tool(page: Page, key: string) {
  return page.locator(`[data-tool="${key}"]`)
}
