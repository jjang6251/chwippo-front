/**
 * starred(즐겨찾기) E2E
 *
 * 시나리오 케이스:
 * 1. 보드 카드에 별 토글 버튼 노출 — OFF 상태(outline)
 * 2. 별 토글 클릭 → updateApplication PATCH 호출 (isStarred: true)
 * 3. starred=true 카드는 정렬상 비-starred 카드보다 위
 * 4. PASSED + starred 카드는 일반 IN_PROGRESS·PLANNED 카드보다 아래 (4그룹 분리)
 * 5. BoardDetail 페이지에도 별 토글 노출
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/auth'

function makeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-x',
    userId: 'test-user-uuid-1',
    companyName: '회사',
    jobTitle: '백엔드',
    jobCategory: null,
    status: 'IN_PROGRESS',
    deadline: '2026-06-15',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [],
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

async function mockBoardApis(page: Parameters<typeof mockAuth>[0], applications: any[]) {
  await mockAuth(page)
  await page.route('**/applications', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: applications }),
    })
  })
}

test.describe('보드 카드 starred', () => {
  test('카드 별 토글 OFF → 클릭 시 PATCH isStarred=true 호출', async ({ page }) => {
    const app = makeApplication({ id: 'app-1', companyName: '네이버', isStarred: false })
    await mockBoardApis(page, [app])

    let patchCalled = false
    let patchBody: any = null
    await page.route('**/applications/app-1', (route) => {
      const request = route.request()
      if (request.method() === 'PATCH') {
        patchCalled = true
        patchBody = JSON.parse(request.postData() ?? '{}')
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...app, isStarred: true } }),
        })
        return
      }
      route.continue()
    })

    await page.goto('/board')
    const card = page.getByText('네이버').first()
    await expect(card).toBeVisible()

    // 별 토글 버튼 — aria-label 기반
    const starToggle = page.getByRole('button', { name: /즐겨찾기 추가/ })
    await expect(starToggle).toBeVisible()
    await starToggle.click()

    // PATCH 호출 확인
    await expect.poll(() => patchCalled).toBe(true)
    expect(patchBody).toEqual({ isStarred: true })
  })

  test('starred 카드 → outline 별이 아닌 채워진(filled) 상태로 표시', async ({ page }) => {
    const app = makeApplication({ id: 'app-1', companyName: '카카오', isStarred: true })
    await mockBoardApis(page, [app])

    await page.goto('/board')

    // 별 토글의 aria-label은 starred 상태에 따라 다름
    const starOff = page.getByRole('button', { name: /즐겨찾기 해제/ })
    await expect(starOff).toBeVisible()
  })

  test('starred 카드는 보드 상단 (비-starred 카드보다 위)', async ({ page }) => {
    const normalCard = makeApplication({
      id: 'normal',
      companyName: '일반회사',
      isStarred: false,
      deadline: '2026-06-01',
      currentStepIndex: 0,
      steps: [{
        id: 's1', applicationId: 'normal', orderIndex: 0, name: '서류 제출',
        scheduledDate: '2026-06-01', location: null, notes: null, pinnedContent: null,
      }],
    })
    const starredCard = makeApplication({
      id: 'starred',
      companyName: '즐겨찾기회사',
      isStarred: true,
      deadline: '2026-12-31',  // 더 먼 미래
      currentStepIndex: 0,
      steps: [{
        id: 's2', applicationId: 'starred', orderIndex: 0, name: '서류 제출',
        scheduledDate: '2026-12-31', location: null, notes: null, pinnedContent: null,
      }],
    })

    // deadline 기준이라면 일반회사가 위, 하지만 starred 우선이라 즐겨찾기회사가 상단
    await mockBoardApis(page, [normalCard, starredCard])

    await page.goto('/board')

    await expect(page.getByText('즐겨찾기회사')).toBeVisible()
    await expect(page.getByText('일반회사')).toBeVisible()

    // DOM 순서로 검증 (grid 레이아웃에서도 정확)
    const cardTitles = await page.locator('h3').allTextContents()
    const starredIdx = cardTitles.indexOf('즐겨찾기회사')
    const normalIdx = cardTitles.indexOf('일반회사')
    expect(starredIdx).toBeGreaterThanOrEqual(0)
    expect(normalIdx).toBeGreaterThanOrEqual(0)
    expect(starredIdx).toBeLessThan(normalIdx)
  })

  test('PASSED + starred 카드는 IN_PROGRESS 일반 카드보다 아래 (4그룹 분리)', async ({ page }) => {
    const inProgress = makeApplication({
      id: 'ip',
      companyName: '진행중회사',
      status: 'IN_PROGRESS',
      isStarred: false,
      deadline: '2026-12-31',
      currentStepIndex: 0,
      steps: [{
        id: 's1', applicationId: 'ip', orderIndex: 0, name: '서류',
        scheduledDate: '2026-12-31', location: null, notes: null, pinnedContent: null,
      }],
    })
    const passedStarred = makeApplication({
      id: 'ps',
      companyName: '합격즐겨찾기회사',
      status: 'PASSED',
      isStarred: true,
      deadline: '2026-05-01',
    })

    await mockBoardApis(page, [inProgress, passedStarred])

    await page.goto('/board')

    await expect(page.getByText('진행중회사')).toBeVisible()
    await expect(page.getByText('합격즐겨찾기회사')).toBeVisible()

    const cardTitles = await page.locator('h3').allTextContents()
    const ipIdx = cardTitles.indexOf('진행중회사')
    const psIdx = cardTitles.indexOf('합격즐겨찾기회사')
    expect(ipIdx).toBeLessThan(psIdx)
  })

  test('BoardDetail 페이지에서도 별 토글 노출', async ({ page }) => {
    const app = makeApplication({ id: 'app-1', companyName: '카카오', isStarred: false })
    await mockBoardApis(page, [app])
    await page.route('**/applications/app-1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: app }),
      })
    })

    await page.goto('/board/app-1')
    const starToggle = page.getByRole('button', { name: /즐겨찾기 추가/ })
    await expect(starToggle).toBeVisible()
  })
})
