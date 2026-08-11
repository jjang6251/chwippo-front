/**
 * 「면접 보기」 — **설정에서 시작해 요약까지 한 바퀴가 실제로 도는가** (질문 은행 D3).
 *
 * 🔴 **왜 jsdom 이 아니라 여기인가.** 유닛 spec 은 컴포넌트를 하나씩 떼어 확인한다 —
 * 설정 화면이 `onStart` 를 부르는가, 루프가 집계를 맞게 내놓는가. 그런데 사용자가 밟는
 * 것은 **주소 → 세션·질문 조회 → 산출(`buildExamQuestions`) → 루프 → 요약** 이 통째로
 * 이어진 한 줄이고, 그 사이 어디가 끊겨도 각 조각의 초록불은 그대로다.
 *
 * 60문항으로 목을 잡는 이유 — 상한(10개)이 실제로 걸리는 구간이어야 "설정이 산출을
 * 바꾼다" 를 확인할 수 있다. 20문항이면 상한을 골라도 안 걸리는 경우가 생긴다.
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockAuth } from './helpers/auth'

const APP_ID = 'app-1'
const SESS_ID = 'sess-1'
const TOTAL = 60
/** 이번 시험 문항 수 — 설정에서 「10개」를 고른다 */
const PICKED = 10

const json = (d: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data: d }),
})

const session = {
  id: SESS_ID,
  applicationId: APP_ID,
  round: '1차 실무 면접',
  interviewType: 'job_fit',
  coverletterIds: [],
  extraLogIds: [],
  myMemo: null,
  jobDescription: null,
  emphasisPoints: null,
  userResearchNotes: null,
  generationStatus: 'completed',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
}

/** 전부 같은 카테고리 → 「차례」 순서가 `orderIndex` 그대로다 (앞에서 10개) */
const q = (i: number) => ({
  id: `q-${i}`,
  sessionId: SESS_ID,
  parentQuestionId: null,
  depth: 0,
  orderIndex: i,
  category: 'self_intro',
  questionText: `${i + 1}번째 질문입니다. 답변해 주세요.`,
  suggestedAnswer: null,
  materialGap: null,
  sourceLogIds: [],
  myMemo: `내가 적어둔 답 ${i}`,
  mustPrepare: false,
  followupBasis: null,
  source: 'ai',
  lastPracticedAt: null,
  lastPracticeResult: null,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  children: [],
})

/** 라우트 목 — 두 시나리오가 같은 세션·질문을 본다 */
const mockApi = async (page: Page, graded: string[]) => {
  await page.route('http://localhost:3000/**', (r) => {
    const u = r.request().url()
    if (u.includes('/practice')) {
      const body = r.request().postDataJSON() as { result: string }
      graded.push(body.result)
      return r.fulfill(json({ ...q(0), lastPracticeResult: body.result }))
    }
    if (u.includes('coin-balance'))
      return r.fulfill(
        json({
          balance: 100,
          monthlyCoinLimit: 100,
          tier: 'free',
          nextResetAt: '2026-09-01T00:00:00Z',
        }),
      )
    if (u.includes('streak')) return r.fulfill(json({ streak: { current: 5 } }))
    if (u.includes('unread-count')) return r.fulfill(json({ count: 0 }))
    if (u.includes('/questions'))
      return r.fulfill(json(Array.from({ length: TOTAL }, (_, i) => q(i))))
    if (u.includes('/refs')) return r.fulfill(json({ coverletters: [], logs: [] }))
    if (u.includes(`/interview-prep-sessions/${SESS_ID}`))
      return r.fulfill(json(session))
    return r.fulfill(json([]))
  })
  await mockAuth(page)
  await page.goto(`/interviews/${SESS_ID}/practice`, {
    waitUntil: 'domcontentloaded',
  })
}

test('설정 → 루프 한 바퀴 → 요약', async ({ page }) => {
  /** 채점이 실제로 서버로 나갔는지 — 화면만 넘어가고 저장이 안 되면 「다시 볼 것만」이 빈다 */
  const graded: string[] = []
  await mockApi(page, graded)

  // ── 설정 — 상한을 걸면 산출 숫자가 즉시 따라온다
  const startBtn = page.getByRole('button', { name: /개로 시작하기/ })
  await expect(startBtn).toHaveText(`▶ ${TOTAL}개로 시작하기`, { timeout: 15000 })
  await page
    .getByRole('group', { name: '문항 수' })
    .getByRole('button', { name: '10개' })
    .click()
  await expect(startBtn).toHaveText(`▶ ${PICKED}개로 시작하기`)
  await startBtn.click()

  // ── 루프 — 진행 카운터가 오르고, 답은 누른 뒤에만 보인다
  const progress = page.locator('p').filter({ hasText: /^\d+ \/ \d+$/ }).first()
  for (let i = 1; i <= PICKED; i++) {
    await expect(progress).toHaveText(`${i} / ${PICKED}`)
    await expect(page.getByRole('heading', { name: `${i}번째 질문입니다.` })).toBeVisible()
    // 열기 전에는 답이 화면에 없다
    await expect(page.getByText(`내가 적어둔 답 ${i - 1}`)).toHaveCount(0)

    await page.getByRole('button', { name: '내 답변 보기' }).click()
    await expect(page.getByText(`내가 적어둔 답 ${i - 1}`)).toBeVisible()

    const label = i === PICKED ? '다시' : i === PICKED - 1 ? '애매' : '잘함'
    await page.getByRole('button', { name: label, exact: true }).click()
  }

  // ── 요약
  await expect(page.getByRole('heading', { name: '연습 끝!' })).toBeVisible()
  const count = (label: string) =>
    page.getByText(label, { exact: true }).locator('xpath=preceding-sibling::p[1]')
  await expect(count('잘함')).toHaveText(String(PICKED - 2))
  await expect(count('애매')).toHaveText('1')
  await expect(count('다시')).toHaveText('1')

  // 「다시」가 있으면 그것만 한 번 더 — 요약이 곧 다음 회차의 입구다
  const retry = page.getByRole('button', { name: '다시 볼 것만 한 번 더 (1개)' })
  await expect(retry).toBeVisible()
  await retry.click()
  await expect(progress).toHaveText(`1 / 1`)
  await expect(
    page.getByRole('heading', { name: `${PICKED}번째 질문입니다.` }),
  ).toBeVisible()

  // 채점은 문항마다 실제로 저장됐다
  expect(graded).toEqual([
    ...Array(PICKED - 2).fill('good'),
    'soso',
    'again',
  ])
})

/**
 * ⏱ **스톱워치 — 「이 답에 내가 몇 초를 썼나」.**
 *
 * 🔴 **jsdom 으로는 이 계약을 못 잡는다.** 유닛 spec 은 fake timer 를 밀어 초를 만들지만,
 * 여기서 흐르는 것은 진짜 `setInterval` 이고 그 사이 React 는 실제로 리렌더한다 —
 * effect 의존성 하나만 어긋나도 (예: `running` 이 매 tick 마다 새 interval 을 걸면)
 * fake timer 에선 안 보이고 실기에서만 숫자가 튄다.
 *
 * 잠그는 것 셋: **올라간다 · 답을 펴면 멈춘다 · 접어도 안 되살아난다.**
 */
test('⏱ 스톱워치 — 카운트업 · 답변 공개에서 정지 · 접어도 재개 없음', async ({
  page,
}) => {
  await mockApi(page, [])

  const startBtn = page.getByRole('button', { name: /개로 시작하기/ })
  await expect(startBtn).toHaveText(`▶ ${TOTAL}개로 시작하기`, { timeout: 15000 })

  const timerRow = page.getByRole('group', { name: '타이머' })
  await timerRow.getByRole('button', { name: '⏱ 스톱워치' }).click()
  await expect(
    page.getByText('질문이 나오면 시간이 흘러요 — 제한은 없어요'),
  ).toBeVisible()
  await startBtn.click()

  /*
    🔴 **특정 초를 스치는 순간을 노리지 않는다.** `toHaveText('0:02')` 는 폴링이 그 1초를
    비껴가면 실패하는 시한폭탄이다 — 「구간」으로 단언한다.
  */
  const clock = page.getByLabel(/경과 시간/)
  await expect(clock).toHaveText(/^0:0[01]$/)
  await page.waitForTimeout(2400)
  await expect(clock).toHaveText(/^0:0[23]$/)

  // ── 답을 펴는 순간 멈춘다 — 그 숫자가 곧 「답변에 쓴 시간」이다
  await page.getByRole('button', { name: '내 답변 보기' }).click()
  const stoppedAt = await clock.textContent()
  await expect(page.getByText('내가 적어둔 답 0')).toBeVisible()
  await page.waitForTimeout(2200)
  await expect(clock).toHaveText(stoppedAt!)

  // ── 접어도 되살아나지 않는다 (한 번 멈춘 시계는 그 문항에서 끝)
  await page.getByRole('button', { name: '답변 접기' }).click()
  await expect(page.getByText('내가 적어둔 답 0')).toHaveCount(0)
  await page.waitForTimeout(2200)
  await expect(clock).toHaveText(stoppedAt!)

  // ── 답을 펴지 않고도 채점이 가능하다 → 다음 문항에서 0 부터 다시 흐른다
  await page.getByRole('button', { name: '잘함', exact: true }).click()
  await expect(page.getByRole('heading', { name: '2번째 질문입니다.' })).toBeVisible()
  await expect(clock).toHaveText(/^0:0[01]$/)
  await page.waitForTimeout(2400)
  await expect(clock).toHaveText(/^0:0[23]$/)
})
