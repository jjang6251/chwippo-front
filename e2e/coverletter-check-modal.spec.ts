/**
 * 자소서 검사 모달 — 🔴 **버튼이 무엇을 적용하는지 헷갈리면 안 된다.**
 *
 * 이 모달은 2층이다: 형식 정리(규칙·무료) + AI 심층 점검(10코인).
 * 두 번의 실패를 여기서 고정한다 (둘 다 2026-08-23 CEO 실사용 지적):
 *  ① 원래 「정리된 내용으로 바꾸기」가 `onClose()` 로 **모달을 닫아서**, 형식 정리를 한
 *     사람은 아래 AI 층을 **영영 못 봤다** — 정작 형식을 다듬고 내용을 봐 달라는 게
 *     자연스러운 순서인데 배치가 막고 있었다.
 *  ② 그걸 고치려 CTA 를 AI 층 **아래로** 내렸더니, 이번엔 「이게 AI 결과를 적용하는 건가?」
 *     로 읽혔다. **버튼은 자기가 적용할 것 바로 옆에 있어야 한다.**
 * → 답은 「CTA 는 정리 후 바로 밑 + 닫지 않는다」였다. 순서와 생존을 같이 잠근다.
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/auth'

const json = (d: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d }) })
const app = { id: 'a1', userId: 'test-user-uuid-1', companyName: '코스모신소재', jobTitle: '백엔드 개발자',
  jobCategory: null, status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex: 0, needsDetail: false,
  isStarred: false, steps: [], createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' }
const DIRTY = '저는  문제를 감이 아니라 수치로 좁혀 푸는 것이 기본기라고 생각합니다ㅋㅋ 😀\n\n\n\n인턴 시절 큐가 지연되는 문제를 맡았습니다．'
const FEEDBACK = { summary: '경험은 구체적인데 도입부가 늘어집니다.',
  strengths: ['수치가 구체적이라 신뢰가 갑니다'],
  issues: [{ kind: 'ai_tone', quote: '생각합니다', advice: '「생각합니다」는 AI 초안에서 흔한 마무리예요.' }],
  suggestions: [] }
const CL = [{ id: 'c1', applicationId: 'a1', question: '지원 동기를 작성해 주세요.', answer: DIRTY,
  charLimit: 650, category: '지원동기', order: 0, lastFeedback: FEEDBACK, lastFeedbackAt: '2026-08-23T02:00:00Z' }]

async function openModal(page: import('@playwright/test').Page) {
  await mockAuth(page)
  await page.route('**/applications/a1/coverletter/research*', (r) => r.fulfill(json(null)))
  await page.route('**/applications/a1/coverletters*', (r) => r.fulfill(json(CL)))
  await page.route('**/applications/a1', (r) => r.fulfill(json(app)))
  await page.route('**/applications', (r) => r.fulfill(json([app])))
  await page.route('**/coverletters/c1', (r) => r.fulfill(json(CL[0])))
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/board/a1/coverletter')
  await page.waitForTimeout(1800)
  await page.getByRole('button', { name: /자소서 검사/ }).click()
  await page.waitForTimeout(600)
}

test('🔴 CTA 는 정리 결과 바로 밑 — AI 층보다 위에 있다', async ({ page }) => {
  await openModal(page)
  const y = await page.evaluate(`(() => {
    const d = document.querySelector('[role="dialog"]')
    const cta = Array.from(d.querySelectorAll('button')).find(b => /정리된 내용으로 바꾸기/.test(b.textContent||''))
    const ai = Array.from(d.querySelectorAll('*')).find(e => /AI 심층 점검/.test(e.textContent||'') && e.children.length===0)
    return { cta: cta.getBoundingClientRect().top, ai: ai.getBoundingClientRect().top }
  })()`) as { cta: number; ai: number }
  expect(y.cta).toBeLessThan(y.ai)
})

test('🔴 적용해도 모달이 닫히지 않고 AI 층이 남는다', async ({ page }) => {
  await openModal(page)
  await page.getByRole('button', { name: '정리된 내용으로 바꾸기' }).click()
  await page.waitForTimeout(700)
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('정리할 내용이 없어요')
  await expect(dialog).toContainText('AI 심층 점검')
})

/**
 * 🔴 **「취소」가 모달을 닫던 것을 「접기」로 바꿨다** (2026-08-23 CEO).
 * 이름과 동작이 어긋났다 — 무엇을 취소하는지 불분명한데 실제로는 **모달 전체를 닫아
 * AI 점검까지 같이 사라졌다.** ×와 하는 일이 같아 중복이기도 했다.
 * 이제 형식 정리 층만 접히고, 헤더로 다시 편다. 모달을 닫는 건 ×뿐이다.
 */
test('🔴 접기 — 형식 정리 층만 닫히고 모달·AI 층은 남는다', async ({ page }) => {
  await openModal(page)
  const d = page.locator('[role="dialog"]')
  await d.getByRole('button', { name: '접기' }).click()   // 🔴 모달로 범위를 좁힌다 (문항 카드에도 「접기」가 있다)
  await page.waitForTimeout(400)
  await expect(d).toBeVisible()                            // 모달은 살아 있다
  await expect(d).not.toContainText('정리된 내용으로 바꾸기') // 본문은 접혔다
  await expect(d).toContainText('곳 발견')                  // 몇 곳인지는 남는다
  await expect(d).toContainText('AI 심층 점검')             // AI 층은 그대로
})

test('🔴 접은 뒤 헤더로 다시 편다', async ({ page }) => {
  await openModal(page)
  const d = page.locator('[role="dialog"]')
  await d.getByRole('button', { name: '접기' }).click()
  await page.waitForTimeout(300)
  await d.getByRole('button', { name: /형식 정리/ }).click()
  await page.waitForTimeout(300)
  await expect(d).toContainText('정리된 내용으로 바꾸기')
})

test('제목이 버튼과 같은 말을 쓴다', async ({ page }) => {
  await openModal(page)
  await expect(page.locator('[role="dialog"]')).toContainText('자소서 검사')
})
