/**
 * 시험 일정 관리 E2E
 *
 * 시나리오 케이스:
 * 1. /myinfo#exam-schedules 진입 → "+ 시험 일정 추가" 버튼 노출
 * 2. 모달 — 어학 타입 → cert_type 드롭다운(TOEIC 등) + 자유 입력 폼 없음
 * 3. 모달 — 자격증 타입 → 자유 입력 폼
 * 4. 시험명·날짜 미입력 시 추가 버튼 disabled
 * 5. 정상 등록 → POST 호출 with 정확한 payload
 * 6. 과거 일정 카드 → "결과 입력 → 자격증 이관" 버튼 노출
 * 7. 미래 일정 카드 → 이관 버튼 없음
 * 8. 어학 이관 모달 → 점수 입력란 노출, 입력 후 convert API 호출
 * 9. 자격증 이관 모달 → 점수 입력란 없음, 바로 이관
 */
import { test, expect } from '@playwright/test'
import { mockAuth, TEST_USER } from './helpers/auth'

async function mockMyinfoApis(page: Parameters<typeof mockAuth>[0], opts: {
  educations?: any[]
  examSchedules?: any[]
} = {}) {
  await mockAuth(page)
  const empty = { body: JSON.stringify({ data: [] }), status: 200, contentType: 'application/json' }
  const nullData = { body: JSON.stringify({ data: null }), status: 200, contentType: 'application/json' }
  await page.route('**/myinfo/profile', (r) => r.fulfill(nullData))
  await page.route('**/myinfo/language-certs', (r) => r.fulfill(empty))
  await page.route('**/myinfo/certs', (r) => r.fulfill(empty))
  await page.route('**/myinfo/awards', (r) => r.fulfill(empty))
  await page.route('**/myinfo/experiences', (r) => r.fulfill(empty))
  await page.route('**/myinfo/documents', (r) => r.fulfill(empty))
  await page.route('**/myinfo/coverletter', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: { coverletter: {}, custom: [] } }),
  }))
  await page.route('**/myinfo/educations', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: opts.educations ?? [] }) })
    } else {
      route.continue()
    }
  })
  await page.route('**/myinfo/exam-schedules', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: opts.examSchedules ?? [] }) })
    } else {
      route.continue()
    }
  })
}

test.describe('시험 일정 관리', () => {
  test('myinfo 진입 후 시험 일정 섹션 노출 + 추가 버튼', async ({ page }) => {
    await mockMyinfoApis(page)

    await page.goto('/myinfo#exam-schedules')

    await expect(page.getByRole('button', { name: '시험 일정 추가' })).toBeVisible()
  })

  test('어학 타입 선택 시 cert_type 드롭다운 노출 (TOEIC·OPIC 등)', async ({ page }) => {
    await mockMyinfoApis(page)

    await page.goto('/myinfo#exam-schedules')
    await page.getByRole('button', { name: '시험 일정 추가' }).click()

    const dialog = page.getByRole('dialog', { name: '시험 일정 추가' })
    await expect(dialog).toBeVisible()
    // 어학 토글이 디폴트 활성
    const selectEl = dialog.locator('select').first()
    const options = await selectEl.locator('option').allTextContents()
    expect(options).toContain('TOEIC')
    expect(options).toContain('OPIC')
  })

  test('자격증 타입 선택 시 시험명 자유 입력 폼 노출', async ({ page }) => {
    await mockMyinfoApis(page)

    await page.goto('/myinfo#exam-schedules')
    await page.getByRole('button', { name: '시험 일정 추가' }).click()

    const dialog = page.getByRole('dialog', { name: '시험 일정 추가' })
    await dialog.getByRole('button', { name: '자격증', exact: true }).click()

    await expect(dialog.getByPlaceholder('예: 정보처리기사 필기')).toBeVisible()
  })

  test('자격증 시험명 미입력 시 "추가" 버튼 disabled', async ({ page }) => {
    await mockMyinfoApis(page)

    await page.goto('/myinfo#exam-schedules')
    await page.getByRole('button', { name: '시험 일정 추가' }).click()

    const dialog = page.getByRole('dialog', { name: '시험 일정 추가' })
    await dialog.getByRole('button', { name: '자격증', exact: true }).click()

    await expect(dialog.getByRole('button', { name: '추가', exact: true })).toBeDisabled()
  })

  test('어학 시험 정상 등록 → POST 호출 with 정확한 payload', async ({ page }) => {
    await mockMyinfoApis(page)

    let postBody: any = null
    await page.route('**/myinfo/exam-schedules', (route) => {
      if (route.request().method() === 'POST') {
        postBody = JSON.parse(route.request().postData() ?? '{}')
        route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ data: { id: 'x1', ...postBody } }),
        })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: [] }) })
      }
    })

    await page.goto('/myinfo#exam-schedules')
    await page.getByRole('button', { name: '시험 일정 추가' }).click()

    const dialog = page.getByRole('dialog', { name: '시험 일정 추가' })
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    await dialog.locator('input[type="date"]').fill(futureDate)
    await dialog.getByRole('button', { name: '추가', exact: true }).click()

    await expect.poll(() => postBody).not.toBeNull()
    expect(postBody.exam_type).toBe('language')
    expect(postBody.cert_type).toBe('TOEIC')
    expect(postBody.name).toBe('TOEIC')
  })

  test('과거 시험 카드 → "결과 입력 → 자격증 이관" 버튼 노출', async ({ page }) => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    await mockMyinfoApis(page, {
      examSchedules: [{
        id: 'x1', user_id: TEST_USER.id,
        exam_type: 'language', cert_type: 'TOEIC', name: 'TOEIC',
        exam_date: pastDate, location: null, memo: null,
        created_at: pastDate, updated_at: pastDate,
      }],
    })

    await page.goto('/myinfo#exam-schedules')

    await expect(page.getByRole('button', { name: /결과 입력.*자격증 이관/ })).toBeVisible()
  })

  test('미래 시험 카드 → 이관 버튼 노출 안 됨', async ({ page }) => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString()
    await mockMyinfoApis(page, {
      examSchedules: [{
        id: 'x1', user_id: TEST_USER.id,
        exam_type: 'cert', cert_type: null, name: '정보처리기사',
        exam_date: futureDate, location: null, memo: null,
        created_at: futureDate, updated_at: futureDate,
      }],
    })

    await page.goto('/myinfo#exam-schedules')

    await expect(page.getByText('정보처리기사')).toBeVisible()
    await expect(page.getByRole('button', { name: /결과 입력/ })).toHaveCount(0)
  })

  test('어학 이관 모달 → 점수 입력란 노출 + 빈 점수일 때 이관 disabled', async ({ page }) => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    await mockMyinfoApis(page, {
      examSchedules: [{
        id: 'x1', user_id: TEST_USER.id,
        exam_type: 'language', cert_type: 'TOEIC', name: 'TOEIC',
        exam_date: pastDate, location: null, memo: null,
        created_at: pastDate, updated_at: pastDate,
      }],
    })

    await page.goto('/myinfo#exam-schedules')
    await page.getByRole('button', { name: /결과 입력.*자격증 이관/ }).click()

    const dialog = page.getByRole('dialog', { name: /TOEIC 결과 입력/ })
    await expect(dialog.getByPlaceholder(/850/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: '이관', exact: true })).toBeDisabled()
  })

  test('자격증 이관 모달 → 점수 입력란 없이 바로 이관 가능', async ({ page }) => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    await mockMyinfoApis(page, {
      examSchedules: [{
        id: 'x1', user_id: TEST_USER.id,
        exam_type: 'cert', cert_type: null, name: '정보처리기사',
        exam_date: pastDate, location: null, memo: null,
        created_at: pastDate, updated_at: pastDate,
      }],
    })

    let convertCalled = false
    await page.route('**/myinfo/exam-schedules/x1/convert-to-cert', (route) => {
      convertCalled = true
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/myinfo#exam-schedules')
    await page.getByRole('button', { name: /결과 입력.*자격증 이관/ }).click()

    const dialog = page.getByRole('dialog', { name: /정보처리기사 결과 입력/ })
    await expect(dialog.getByPlaceholder(/850/)).toHaveCount(0)
    const convertBtn = dialog.getByRole('button', { name: '이관', exact: true })
    await expect(convertBtn).toBeEnabled()
    await convertBtn.click()

    await expect.poll(() => convertCalled).toBe(true)
  })
})
