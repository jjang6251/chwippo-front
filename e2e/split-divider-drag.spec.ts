/**
 * 구분선 드래그 — **끌고 놓으면 그 자리에 고정되는가** (2026-08-10 CEO 실기 지적:
 * "고정될 때도 있고 갑자기 면접이 펼쳐진다").
 *
 * 🔴 **왜 jsdom 이 아니라 여기인가.** 원인은 브라우저가 pointerup 뒤에 **자동으로 발행하는
 * `click`** 이다. 손잡이가 커서를 정확히 따라가므로 놓는 지점이 거의 항상 버튼 위이고,
 * 그 버튼의 핸들러는 「한 번 누르면 펼치기」다 — 방금 맞춘 비율이 통째로 날아간다.
 * jsdom 은 그 click 을 스스로 만들지 않으므로 유닛 spec 은 **손으로 흉내낸 대리물**이다.
 * 진짜 이벤트 순서는 실제 브라우저에서만 검증된다.
 *
 * 여러 지점에서 반복한다 — 증상이 "될 때도 있고 안 될 때도" 였다. 비율이 한계(15%·85%)에
 * 걸려 손잡이가 멈추면 커서가 버튼을 벗어나 클릭 대상이 달라지기 때문이고,
 * 한 번만 재보면 **하필 안 걸리는 지점**을 골라 초록불이 뜬다.
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/auth'

const APP_ID = 'app-1', SESS_ID = 'sess-1'
const json = (d: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d }) })
const session = { id: SESS_ID, applicationId: APP_ID, round: '1차 실무 면접', interviewType: 'job_fit', coverletterIds: ['cl-1'], extraLogIds: [], myMemo: null, jobDescription: null, emphasisPoints: null, userResearchNotes: null, generationStatus: 'completed', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' }
const q = (i: number) => ({ id: `q-${i}`, sessionId: SESS_ID, parentQuestionId: null, depth: 0, orderIndex: i, category: 'self_intro', questionText: `${i + 1}. 지원 동기를 말씀해 주세요.`, suggestedAnswer: null, materialGap: null, sourceLogIds: [], myMemo: null, mustPrepare: false, followupBasis: null, children: [] })
const cl = (i: number) => ({ id: `cl-${i}`, applicationId: APP_ID, category: '지원동기', question: `${i}. 지원 동기를 작성해 주세요.`, answer: '경품을 키우는 대신 참여 문턱을 낮췄습니다.', charLimit: 800, orderIndex: i - 1, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' })

/** 목 + 로그인 + 세션 화면 진입 (두 테스트가 공유) */
async function setup(page: import('@playwright/test').Page) {
  await page.route('http://localhost:3000/**', (r) => {
    const u = r.request().url()
    if (u.includes('coin-balance')) return r.fulfill(json({ balance: 100, monthlyCoinLimit: 100, tier: 'free', nextResetAt: '2026-09-01T00:00:00Z' }))
    if (u.includes('streak')) return r.fulfill(json({ streak: { current: 5 } }))
    if (u.includes('unread-count')) return r.fulfill(json({ count: 0 }))
    if (u.includes('/questions')) return r.fulfill(json(Array.from({ length: 20 }, (_, i) => q(i))))
    if (u.includes('/refs')) return r.fulfill(json({ coverletters: [], logs: [] }))
    if (u.includes('/coverletters')) return r.fulfill(json([cl(1), cl(2)]))
    if (u.includes(`/interview-prep-sessions/${SESS_ID}`)) return r.fulfill(json(session))
    if (u.includes(`/applications/${APP_ID}`)) return r.fulfill(json({ id: APP_ID, userId: 'test-user-uuid-1', companyName: '카카오', jobTitle: '백엔드', jobCategory: null, status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex: 0, needsDetail: false, isStarred: false, steps: [], createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' }))
    return r.fulfill(json([]))
  })
  await mockAuth(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/interviews/${SESS_ID}?applicationId=${APP_ID}`, { waitUntil: 'domcontentloaded' })
}

test('끌고 놓으면 그 자리에 고정된다', async ({ page }) => {
  await setup(page)
  const handle = page.getByRole('button', { name: /구분선/ })
  await handle.waitFor({ timeout: 15000 })
  await handle.click() // 누르면 반반
  await page.waitForTimeout(600)

  const cols = async () => page.evaluate(() => {
    const h = document.querySelector('[aria-label^="구분선"]') as HTMLElement
    return (h.parentElement!.parentElement as HTMLElement).style.gridTemplateColumns
  })

  // 여러 지점에서 반복 — "될 때도 있고 안 될 때도" 였으므로 한 번으로는 못 믿는다
  for (const dx of [180, -180, 60, -320, 300]) {
    const b = (await handle.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(b.x + b.width / 2 + (dx * i) / 6, b.y + b.height / 2)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()
    const during = await cols()
    await page.waitForTimeout(400) // 클릭·전환이 다 끝난 뒤
    const after = await cols()
    expect(after).toBe(during) // 놓은 자리 그대로여야 한다
    expect(after).not.toContain('44px') // 접힌 상태(세로 탭)로 튀지 않았다
  }
})

/**
 * 🔴 **손잡이 클릭이 세 상태를 정확히 도는가** (2026-08-10).
 *
 * 전에는 클릭이 전면 스왑이고 반반은 **더블클릭 전용**이었는데, 사람 속도에서 한 번도
 * 도달하지 못했다 — 첫 클릭이 스왑하면서 구분선이 240ms 에 걸쳐 반대편으로 **이동**해
 * 두 번째 클릭이 빗나가기 때문이다. **`dblclick()` 을 쓴 e2e 는 기계 속도라 통과했다.**
 * 그래서 여기서는 **전환이 끝난 뒤** 사람처럼 한 번씩 누른다.
 */
test('사람 속도로 눌러도 세 상태를 정확히 돈다', async ({ page }) => {
  await setup(page)
  const handle = page.getByRole('button', { name: /구분선/ })
  await handle.waitFor({ timeout: 15000 })
  const cols = async () =>
    page.evaluate(() => {
      const h = document.querySelector('[aria-label^="구분선"]') as HTMLElement
      return (h.parentElement!.parentElement as HTMLElement).style.gridTemplateColumns
    })

  // 면접만 → 반반 → 자소서만 → 반반 → 면접만
  for (const want of ['0.5fr', '44px 22px 1fr', '0.5fr', '1fr 22px 44px']) {
    const b = (await handle.boundingBox())!
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(420) // 240ms 전환이 끝난 뒤 다음 클릭
    expect(await cols()).toContain(want)
  }
})

/**
 * 🔴 **스크롤한 다음 반반으로 가도 화면이 비지 않는가** (2026-08-10 CEO 실기 지적:
 * "아래로 좀 스크롤 한 다음에 손잡이를 클릭하면 오류가 발생해").
 *
 * 분할이 되면 페이지 스크롤을 잠그는데, **잠그기만 하고 위치를 안 되돌렸다.**
 * 스크롤이 1200 인 채로 분할 영역이 문서 213px 지점에 651px 로 줄어드니 내용이 전부
 * 화면 위로 밀려나고, 방금 잠근 탓에 되돌릴 수도 없었다 — **빈 배경만 남는 막다른 길.**
 *
 * jsdom 은 레이아웃도 스크롤도 없어 이 조합을 만들 수 없다. 여기서만 검증된다.
 */
test('스크롤한 뒤 반반으로 가도 화면이 비지 않는다', async ({ page }) => {
  await setup(page)
  const handle = page.getByRole('button', { name: /구분선/ })
  await handle.waitFor({ timeout: 15000 })

  await page.mouse.wheel(0, 1200)
  await page.waitForTimeout(400)
  await handle.click()
  await page.waitForTimeout(600)

  const st = await page.evaluate(() => {
    const h = document.querySelector('[aria-label^="구분선"]') as HTMLElement
    const hb = h.getBoundingClientRect()
    const grid = h.parentElement!.parentElement as HTMLElement
    const gb = grid.getBoundingClientRect()
    const col = grid.firstElementChild as HTMLElement
    return {
      scrollY: Math.round(window.scrollY),
      gridTop: Math.round(gb.top),
      handleVisible: hb.top >= 0 && hb.bottom <= window.innerHeight,
      carried: col.scrollTop,
    }
  })
  expect(st.scrollY).toBe(0) // 잠글 땐 위치도 되돌린다
  expect(st.gridTop).toBeGreaterThan(0) // 분할 영역이 화면 안에 있다
  expect(st.handleVisible).toBe(true) // 손잡이도 보인다 = 빠져나갈 수 있다
  expect(st.carried).toBeGreaterThan(500) // 읽던 자리가 열 스크롤로 옮겨졌다
})

/**
 * 🔴 **열을 오가도 답변 칸이 부풀지 않는가** (2026-08-10 CEO 실기 지적:
 * "자소서 갔다가 다시 누르면 답변 input height 가 많이 늘어나 있고, 내용을 쓰면 정상으로 돌아와").
 *
 * 높이는 줄 수에서, 줄 수는 **폭**에서 나온다. 자소서만 → 반반으로 돌아오면 면접 열이 새로
 * 마운트되는데 그 순간 열은 아직 **44px**(세로 탭 폭)이라, 거기서 줄 수를 세면 `max` 까지
 * 부푼다. 폭이 넓어져도 다시 재지 않으면 그대로 남는다.
 *
 * jsdom 은 폭도 줄바꿈도 없어 이 인과를 만들 수 없다 — 여기서만 검증된다.
 */
test('열을 오가도 답변 칸이 부풀지 않는다', async ({ page }) => {
  await setup(page)
  const handle = page.getByRole('button', { name: /구분선/ })
  await handle.waitFor({ timeout: 15000 })

  const h = async () =>
    page.evaluate(() => {
      const ta = document.querySelector(
        'textarea[placeholder*="어떻게 답할지"]',
      ) as HTMLTextAreaElement | null
      return ta ? Math.round(ta.clientHeight) : -1
    })

  const base = await h() // 면접만 — 정상 크기
  expect(base).toBeLessThan(120)

  // CEO 가 밟은 순서 그대로: 반반 → 자소서만 → 반반 → 면접만
  for (const step of ['반반', '자소서만', '반반', '면접만']) {
    await handle.click()
    await page.waitForTimeout(500) // 240ms 전환이 끝난 뒤
    const now = await h()
    if (now < 0) continue // 자소서만 — 면접 열이 없다
    expect(now, `${step} 에서 부풀었다`).toBeLessThanOrEqual(base + 4)
  }
})

/**
 * 🔴 **세로 탭은 이름대로 「펼치기」다** (2026-08-10 CEO: "이거 분할이 아니라
 * 서로 펼치는 걸로 가는 게 나을 것 같아").
 *
 * 버튼에 「자소서 펼치기」라고 쓰여 있으면서 반반이 되면 이름과 결과가 어긋난다.
 * 반반은 손잡이가 맡고, 탭은 그쪽만 펼친다.
 */
test('세로 탭은 그쪽만 펼치고, 반반은 손잡이가 맡는다', async ({ page }) => {
  await setup(page)
  const handle = page.getByRole('button', { name: /구분선/ })
  await handle.waitFor({ timeout: 15000 })
  const cols = async () =>
    page.evaluate(() => {
      const h = document.querySelector('[aria-label^="구분선"]') as HTMLElement
      return (h.parentElement!.parentElement as HTMLElement).style.gridTemplateColumns
    })

  // 면접만 → 「자소서 펼치기」 탭 → 자소서만 (반반 아님)
  await page.getByRole('button', { name: '자소서 펼치기' }).click()
  await page.waitForTimeout(450)
  expect(await cols()).toContain('44px 22px 1fr')

  // 자소서만 → 「면접 펼치기」 탭 → 면접만
  await page.getByRole('button', { name: '면접 펼치기' }).click()
  await page.waitForTimeout(450)
  expect(await cols()).toContain('1fr 22px 44px')

  // 반반은 손잡이
  await handle.click()
  await page.waitForTimeout(450)
  expect(await cols()).toContain('0.5fr')
})
