/**
 * 자소서 펼침 상태 기억 — 🔴 **새로고침·재진입은 실브라우저에서만 검증된다.**
 *
 * 예전엔 첫 문항을 **무조건** 펼쳤다. 사용자가 접어도 새로고침하면 다시 펼쳐졌고,
 * "접겠다"는 의사가 매번 무시됐다 (2026-08-23 CEO 실사용 지적).
 * 자동 펼침의 목적은 **처음 온 사람을 돕는 것**이지 매번 강제하는 게 아니다.
 *
 * 판정의 핵심은 「기록 없음」과 「전부 접음」을 가르는 것이다 — 전자만 자동 펼침.
 * jsdom 은 새로고침이 없어 이 구분을 원리적으로 못 잡는다.
 */
import { test, expect, type Page } from '@playwright/test'
import { mockAuth } from './helpers/auth'

const json = (d: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d }) })
const JP = { responsibilities: '백엔드 API 를 설계·개발합니다.', requirements: ['서버 개발 3년 이상'],
  preferred: [], techStack: [], qualifications: [], keywords: [], parsedAt: '2026-08-21T02:00:00Z' }
const R = { status: 'ok', isCached: true, cachedAt: '2026-08-19T15:30:00Z', research: {
  businessSummary: '이차전지 양극재를 만드는 소재 기업이에요.',
  coreValues: '인재제일(사람이 기업이다), 최고지향(세계 최고), 상생추구(공동 번영)',
  interviewKeywords: [{ keyword: '분산 시스템', category: 'tech' }] } }
const app = { id: 'a1', userId: 'test-user-uuid-1', companyName: '코스모신소재', jobTitle: '백엔드 개발자',
  jobPosting: JP, jobCategory: null, status: 'IN_PROGRESS', jobUrl: null, memo: null, currentStepIndex: 0,
  needsDetail: false, isStarred: false, steps: [], createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' }
const CL = [
  { id: 'c1', applicationId: 'a1', question: '1번 문항이에요.', answer: '첫 답변입니다.', charLimit: 650, category: '지원동기', order: 0 },
  { id: 'c2', applicationId: 'a1', question: '2번 문항이에요.', answer: '둘째 답변입니다.', charLimit: 600, category: '직무역량', order: 1 },
]

async function setup(page: Page) {
  await mockAuth(page)
  await page.route('**/applications/a1/coverletter/research*', (r) => r.fulfill(json(R)))
  await page.route('**/applications/a1/coverletters*', (r) => r.fulfill(json(CL)))
  await page.route('**/applications/a1', (r) => r.fulfill(json(app)))
  await page.route('**/applications', (r) => r.fulfill(json([app])))
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/board/a1/coverletter')
  await page.waitForTimeout(1600)
}
const openCount = (page: Page) => page.getByRole('button', { name: '카드 접기' }).count()

test('처음 온 사람에게만 첫 문항이 자동으로 펼쳐진다', async ({ page }) => {
  await setup(page)
  expect(await openCount(page)).toBe(1)
})

test('🔴 접은 상태가 새로고침을 넘어 유지된다', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: '카드 접기' }).first().click()
  await page.waitForTimeout(300)
  await page.reload()
  await page.waitForTimeout(1800)
  // 「전부 접음」을 「기록 없음」으로 오해하면 여기서 1 이 된다
  expect(await openCount(page)).toBe(0)
})

test('🔴 어느 문항을 펼쳤는지까지 기억한다', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: '카드 접기' }).first().click()
  await page.getByRole('button', { name: /2번 문항이에요. 펼치기/ }).click()
  await page.waitForTimeout(300)
  await page.reload()
  await page.waitForTimeout(1800)
  expect(await openCount(page)).toBe(1)
  await expect(page.getByRole('button', { name: /1번 문항이에요. 펼치기/ })).toBeVisible()
})

test('🔴 배너 둘도 접힘을 기억한다 (카드 상세와 키 공유)', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: '회사 조사 펼치기/접기' }).first().click()
  await page.getByRole('button', { name: /공고 요건/ }).first().click()
  await page.waitForTimeout(300)
  await page.reload()
  await page.waitForTimeout(1800)
  await expect(page.getByText('핵심 가치')).toBeVisible()
  await expect(page.getByText('담당업무')).toBeVisible()
})
