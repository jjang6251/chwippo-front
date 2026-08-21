import { test, expect, type Page } from '@playwright/test'
import {
  doc,
  gotoDoc,
  mockStudyNotesApi,
  para,
  selectAll,
  NOTE_A,
  type MockHandle,
} from './helpers/studyNotes'

/**
 * 「공부 노트」 본문 이미지 — **실브라우저 게이트** (study-note-media PR-A).
 *
 * ## 여기서만 볼 수 있는 것
 *
 * 압축(canvas)·파일 선택창·데코레이션 렌더는 jsdom 에 아예 없다. 단위 spec 은 「어떤 값이
 * 오갔나」까지만 잠그고, **누르면 실제로 그림이 박히는가**는 이 파일이 본다.
 *
 * 🔴 glob 은 `http://localhost:3000/**` 전체 URL 형식만 쓴다 (`helpers/studyNotes` 주석).
 * R2 PUT 목적지도 **우리가 발급하는 값**이라 같은 호스트로 돌려서 한 라우트 안에서 받는다.
 */

/** 1×1 RGBA png — colorType 6(알파) 이라 「알파는 png 유지」 경로까지 실제로 탄다 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const PUT_URL = 'http://localhost:3000/__r2/put'
const IMAGE_URL = 'http://localhost:3000/__r2/note-image.png'

/** 자리 표시가 눈에 보이는 시간을 만든다 — 즉답이면 스켈레톤을 볼 창이 없다 */
const PRESIGN_DELAY_MS = 1500

/**
 * 🔴 본문 이미지 선택자. `img` 만 쓰면 안 된다 — ProseMirror 가 빈 문단에
 * `<img class="ProseMirror-separator" alt="">` 를 **자기 용도로** 끼워 넣어서,
 * 아무것도 안 올렸는데 이미지가 1개로 세어진다 (2026-08-20 실측). 우리 이미지는 늘 src 가 있다.
 */
const PROSE_IMAGE = '.chw-prose img[src]'

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data }),
})

interface ImageMock {
  puts: number
  registered: { noteId: string; body: Record<string, unknown> }[]
  fileDeletes: string[]
  noteDeletes: string[]
}

/**
 * 업로드 3단(발급·PUT·등록)과 보상 삭제를 받는다.
 * `mockStudyNotesApi` **뒤에** 등록해야 이긴다 (Playwright 는 나중 핸들러를 먼저 본다).
 */
async function mockImageUpload(
  page: Page,
  options: { attachmentFailure?: { status: number; message: string } } = {},
): Promise<ImageMock> {
  const state: ImageMock = { puts: 0, registered: [], fileDeletes: [], noteDeletes: [] }

  await page.route('http://localhost:3000/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname

    if (path === '/files/presigned-url' && method === 'POST') {
      await new Promise((r) => setTimeout(r, PRESIGN_DELAY_MS))
      return route.fulfill(json({ uploadUrl: PUT_URL, fileUrl: IMAGE_URL }))
    }
    if (path === '/__r2/put' && method === 'PUT') {
      state.puts += 1
      return route.fulfill({ status: 200, body: '' })
    }
    if (path === '/__r2/note-image.png') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
    }
    if (path === '/files' && method === 'DELETE') {
      const body = (request.postDataJSON() ?? {}) as { fileUrl?: string }
      state.fileDeletes.push(String(body.fileUrl ?? ''))
      return route.fulfill(json(null))
    }

    const attachments = /^\/study-notes\/([^/]+)\/attachments$/.exec(path)
    if (attachments && method === 'POST') {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>
      state.registered.push({ noteId: attachments[1], body })
      if (options.attachmentFailure) {
        return route.fulfill({
          status: options.attachmentFailure.status,
          contentType: 'application/json',
          body: JSON.stringify({ message: options.attachmentFailure.message }),
        })
      }
      return route.fulfill(json({ id: 'att-e2e-1', fileUrl: IMAGE_URL }))
    }

    // 노트 삭제는 **기록만** 하고 원래 목에 넘긴다 (빈 노트 오삭제 감시)
    if (/^\/study-notes\/[^/]+$/.test(path) && method === 'DELETE') {
      state.noteDeletes.push(path)
    }
    return route.fallback()
  })

  return state
}

/** 툴바 📷 → 파일 선택창 → 파일 전달 */
async function pickImage(page: Page, name = 'diagram.png'): Promise<void> {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('[data-tool="image"]').click(),
  ])
  await chooser.setFiles({ name, mimeType: 'image/png', buffer: PNG })
}

async function openBlankNote(page: Page): Promise<MockHandle> {
  return mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '', folderId: null, content: null }],
  })
}

// ── AI ✕ 이미지 ──────────────────────────────────────────────

const TEXT_ABOVE = '회로 정리를 시작한다'
const TEXT_BELOW = '전압 분배 법칙을 적용한다'

/** 글 · 그림 · 글 — 이미 이미지가 박혀 있는 노트를 연다 (업로드 왕복 없이) */
async function openNoteWithImage(page: Page): Promise<void> {
  await mockStudyNotesApi(page, {
    notes: [
      {
        id: NOTE_A,
        title: '회로 정리',
        folderId: null,
        content: doc(
          para(TEXT_ABOVE),
          { type: 'image', attrs: { src: IMAGE_URL, attachmentId: 'att-e2e-1' } },
          para(TEXT_BELOW),
        ),
      },
    ],
  })
  // 이미지 URL 을 실제로 내려 준다 (깨진 이미지면 클릭할 상자가 없다)
  await mockImageUpload(page)
  await gotoDoc(page)
}

test('🔴 툴바 📷 → 자리 표시 → 업로드 → img 노드 확정', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '회로 정리', folderId: null, content: null }],
  })
  const uploads = await mockImageUpload(page)
  await gotoDoc(page)

  await expect(page.locator('[data-tool="image"]')).toBeVisible()
  await pickImage(page)

  // ── 올라가는 동안: 스켈레톤이 뜨고 img 는 아직 없다.
  //    🔴 `toHaveCount(0)` 은 **재시도 어서션**이라 여기 쓰면 안 된다 — 업로드가 끝날
  //    때까지 기다렸다가 1을 보고 실패한다. 이 순간의 상태는 일회성 count 로 잰다
  await expect(page.locator('.chw-image-uploading')).toBeVisible()
  expect(await page.locator(PROSE_IMAGE).count()).toBe(0)

  // ── 끝나면: 자리 표시가 걷히고 그 자리에 진짜 이미지
  const image = page.locator(PROSE_IMAGE)
  await expect(image).toHaveCount(1, { timeout: 15000 })
  await expect(page.locator('.chw-image-uploading')).toHaveCount(0)
  await expect(image).toHaveAttribute('src', IMAGE_URL)
  await expect(image).toHaveAttribute('data-attachment-id', 'att-e2e-1')

  // 실제로 그려졌는가 — 깨진 이미지면 naturalWidth 가 0 이다
  await expect
    .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0)

  // ── 파이프라인이 한 바퀴 다 돌았다 (발급 → PUT → 등록), 보상 삭제는 없다
  expect(uploads.puts).toBe(1)
  expect(uploads.registered).toHaveLength(1)
  expect(uploads.registered[0].noteId).toBe(NOTE_A)
  expect(uploads.registered[0].body.fileUrl).toBe(IMAGE_URL)
  expect(uploads.registered[0].body.fileSizeBytes).toBeGreaterThan(0)
  expect(uploads.fileDeletes).toEqual([])
})

test('🔴 이미지만 넣은 빈 노트 — 본문에 저장되고, 떠나도 지워지지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const handle = await openBlankNote(page)
  const uploads = await mockImageUpload(page)
  await gotoDoc(page)

  await pickImage(page)
  await expect(page.locator(PROSE_IMAGE)).toHaveCount(1, { timeout: 15000 })

  /*
    🔴 여기가 「글자 0자 = 빈 문서」 판정이 깨지는 자리다. 저장 값이 '' 로 나가면
    화면엔 이미지가 보이는데 서버엔 빈 노트가 남는다 — 새로고침 한 번에 증발한다.
  */
  await expect
    .poll(() => JSON.stringify(handle.lastSavedDoc() ?? {}), { timeout: 10000 })
    .toContain(IMAGE_URL)

  // ── 제목도 본문 글자도 없는 채로 떠난다 — 「빈 노트 자동 정리」가 물면 안 된다
  await page.getByRole('link', { name: '공부 노트' }).first().click()
  await page.waitForURL('**/study-notes')
  await page.waitForTimeout(1200)

  expect(uploads.noteDeletes).toEqual([])
})

test('첨부 등록이 막히면 — 서버 문구 그대로 + 자리 표시 회수 + 보상 삭제', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockStudyNotesApi(page, {
    notes: [{ id: NOTE_A, title: '회로 정리', folderId: null, content: null }],
  })
  const uploads = await mockImageUpload(page, {
    attachmentFailure: {
      status: 400,
      message: '저장 공간(100MB)을 다 썼어요. 쓰지 않는 파일을 지우고 다시 시도해 주세요.',
    },
  })
  await gotoDoc(page)

  await pickImage(page)

  // 🔴 서버가 준 문구가 **그대로** 보여야 한다 (generic 「실패했어요」로 뭉개지지 않는다)
  await expect(page.getByText('저장 공간(100MB)을 다 썼어요.', { exact: false })).toBeVisible({
    timeout: 15000,
  })

  // 자리 표시는 걷히고 문서엔 아무것도 안 남는다
  await expect(page.locator('.chw-image-uploading')).toHaveCount(0)
  await expect(page.locator(PROSE_IMAGE)).toHaveCount(0)

  // 올라간 객체는 보상 삭제된다 (R2 고아 방지)
  await expect.poll(() => uploads.fileDeletes).toEqual([IMAGE_URL])
})

/**
 * 🔴 「AI 는 글자에만 동작한다」 — jsdom 이 못 보는 것: 실제 클릭이 만드는 NodeSelection 과
 * BubbleMenu 의 실좌표 노출. 옛 조건(`from !== to`)에서는 이미지를 클릭하면 AI 버튼이
 * 떴고, 그 상태로 [교체] 하면 사진이 지워졌다.
 */
test('🔴 이미지 클릭·혼합 선택에는 버블 AI 가 뜨지 않는다 (글자만 선택하면 그대로)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openNoteWithImage(page)

  const bubble = page.getByTestId('ai-bubble-button')

  // ① 글자만 드래그 = 기존 동작 (이 픽스처에서 버블이 살아 있다는 증거 — 회귀 대조군)
  await page.locator('.chw-prose p').first().click({ clickCount: 3 })
  await expect(bubble).toBeVisible()

  // ② 이미지 클릭 → NodeSelection 인데 버튼은 없다
  await page.locator(PROSE_IMAGE).click()
  await expect(page.locator('.chw-prose img.ProseMirror-selectednode')).toHaveCount(1)
  await expect(bubble).toBeHidden()

  // ③ 글자+이미지 혼합(전체 선택) = 데이터 손실 경로 — 여기도 안 뜬다
  await selectAll(page)
  await expect(bubble).toBeHidden()
})

/**
 * 🔴 모바일은 툴바가 버블 자리를 대신한다 — 여기가 빠지면 **모바일만 뚫린다**.
 * 진입은 막지 않되(AI 자체는 써야 한다) 이미지는 대상이 되지 않고, 그 이유를 말해 준다.
 */
test('🔴 모바일 툴바 AI 도 같은 판정 — 이미지는 대상이 안 되고 이유가 뜬다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openNoteWithImage(page)

  await page.locator(PROSE_IMAGE).click()
  await page.locator('[data-tool="ai"]').click()

  await expect(page.getByText('사진이 들어간 선택은 대상이 되지 않아요', { exact: false })).toBeVisible()
  // 대상 카드(= 잡힌 범위)는 없다 — 이미지가 AI 로 넘어갈 자리가 애초에 안 생긴다
  await expect(page.getByText('대상 부분')).toHaveCount(0)
})
