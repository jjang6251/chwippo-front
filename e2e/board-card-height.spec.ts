/**
 * A11+ — 카드 뷰 높이 통일 회귀 방어 (CEO 실기 지적).
 *
 * 시나리오: 직무 유/무 · 태그 유/무 · PLANNED/IN_PROGRESS/PASSED · 결과 대기 배지 유/무 혼재.
 * 단언: 보드 카드 offsetHeight 전부 동일(±1px). 어떤 상태 조합이어도 카드 크기가 같아야 한다.
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/auth'

const FUTURE = '2099-12-31'
const PAST = '2020-01-01'

function step(applicationId: string, orderIndex: number, name: string, date: string | null) {
  return { id: `${applicationId}-s${orderIndex}`, applicationId, orderIndex, name, scheduledDate: date, location: null, notes: null, pinnedContent: null }
}

function makeApp(over: Record<string, unknown> = {}) {
  return {
    id: 'app-x',
    userId: 'test-user-uuid-1',
    companyName: '회사',
    jobTitle: null as string | null,
    jobCategory: null as string | null,
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [] as unknown[],
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...over,
  }
}

// 변이 매트릭스 — 각 카드가 다른 조건이지만 높이는 모두 같아야 함
const APPS = [
  // 1) PLANNED — 직무·태그·스텝 전부 없음 → 지원 시작 버튼
  makeApp({ id: 'a1', companyName: '지원예정회사', status: 'PLANNED' }),
  // 2) IN_PROGRESS — 직무 O + 태그 2개 + 스텝
  makeApp({ id: 'a2', companyName: '풀정보회사', jobTitle: '백엔드 개발자', jobCategory: '개발,백엔드', steps: [step('a2', 0, '서류', FUTURE)] }),
  // 3) IN_PROGRESS — 직무 X + 태그 X + 스텝
  makeApp({ id: 'a3', companyName: '최소정보회사', steps: [step('a3', 0, '서류', FUTURE)] }),
  // 4) PASSED — 직무 없음
  makeApp({ id: 'a4', companyName: '합격회사', status: 'PASSED', jobTitle: '데이터 엔지니어' }),
  // 5) IN_PROGRESS — 결과 대기(마지막 스텝 날짜 경과) → 하단 배지
  makeApp({ id: 'a5', companyName: '결과대기회사', jobTitle: '서버 개발', steps: [step('a5', 0, '최종 면접', PAST)], currentStepIndex: 0 }),
  // 6) IN_PROGRESS — 직무 O + 태그 1개 + 다중 스텝 (중간 진행)
  makeApp({ id: 'a6', companyName: '진행중회사', jobTitle: '플랫폼 개발', jobCategory: '개발', steps: [step('a6', 0, '서류', PAST), step('a6', 1, '1차 면접', FUTURE), step('a6', 2, '최종', FUTURE)], currentStepIndex: 1 }),
]

async function mockBoard(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page)
  await page.route('**/applications', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: APPS }) })
  })
}

async function collectHeights(page: Parameters<typeof mockAuth>[0]): Promise<number[]> {
  await page.goto('/board')
  await expect(page.getByText('풀정보회사')).toBeVisible()
  await expect(page.getByText('합격회사')).toBeVisible()
  return page.$$eval('[data-tour-card-id]', (els) => els.map((el) => (el as HTMLElement).offsetHeight))
}

test.describe('보드 카드 높이 통일', () => {
  test('데스크탑(2열) — 모든 카드 높이 동일(±1px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockBoard(page)
    const heights = await collectHeights(page)
    console.log('[card-height desktop]', heights)
    expect(heights.length).toBe(APPS.length)
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
  })

  test('모바일 320px(1열) — 모든 카드 높이 동일(±1px), 가로 오버플로 없음', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await mockBoard(page)
    const heights = await collectHeights(page)
    console.log('[card-height mobile]', heights)
    expect(heights.length).toBe(APPS.length)
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
    // 320px 가로 오버플로 없음
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })
})
