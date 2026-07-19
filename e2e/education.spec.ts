/**
 * 학력 섹션 E2E
 *
 * 내정보 개편 이후 학력은 인라인 자동저장 → **모달(EducationModal) 기반 CRUD** 로 전환됐다.
 *  - 섹션은 첫 방문 시 접힘 → 대상 섹션만 펼친 상태로 진입 (localStorage preseed)
 *  - 0건: "첫 학력 추가하기" → 학력 추가 모달
 *  - 기존 항목: 행의 "편집" 아이콘 → 학력 편집 모달
 *  - 저장 버튼: 추가(create) / 수정(edit) · 삭제는 모달 내 삭제 → 삭제 확인 모달
 *  - 학교명 미입력 시 저장 차단(토스트)
 *
 * 시나리오 케이스:
 * 1. 0건 진입 → "첫 학력 추가하기" → 학력 추가 모달
 * 2. 학교 단계 select 옵션에 "고등학교" 존재 · "고졸" 없음
 * 3. 학교명 입력 후 "추가" → POST 호출 (school_name 포함)
 * 4. 학교명 미입력 시 "추가" → POST 미호출 (validation)
 * 5. 기존 학력 "편집" → 학력 편집 모달 prefilled
 * 6. 복수전공 칩 추가 → 저장 시 minors 포함 (PATCH)
 * 7. 편집 모달 삭제 → 삭제 확인 → DELETE 호출
 */
import { test, expect } from '@playwright/test'
import { mockAuth, TEST_USER } from './helpers/auth'

const ALL_SECTIONS = [
  'profile', 'education', 'military', 'coverletter', 'experiences', 'awards',
  'language-certs', 'certs', 'exam-schedules', 'goals', 'files',
]
const expandOnly = (id: string) => ALL_SECTIONS.filter((s) => s !== id)

async function mockMyinfoBaseApis(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page)
  // 학력 섹션만 펼친 채 진입
  await page.addInitScript((collapsed) => {
    try { localStorage.setItem('myinfo:collapsed:v2', JSON.stringify(collapsed)) } catch { /* ignore */ }
  }, expandOnly('education'))

  const empty = { body: JSON.stringify({ data: [] }), status: 200, contentType: 'application/json' }
  const nullData = { body: JSON.stringify({ data: null }), status: 200, contentType: 'application/json' }
  await page.route('**/myinfo/profile', (r) => r.fulfill(nullData))
  await page.route('**/myinfo/language-certs', (r) => r.fulfill(empty))
  await page.route('**/myinfo/certs', (r) => r.fulfill(empty))
  await page.route('**/myinfo/awards', (r) => r.fulfill(empty))
  await page.route('**/myinfo/experiences', (r) => r.fulfill(empty))
  await page.route('**/myinfo/documents', (r) => r.fulfill(empty))
  await page.route('**/myinfo/exam-schedules', (r) => r.fulfill(empty))
  await page.route('**/myinfo/coverletter', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: { coverletter: {}, custom: [] } }),
  }))
  // 학교 자동완성 GET 은 빈 결과로 (백엔드 히트·콘솔 노이즈 차단)
  await page.route('**/schools/autocomplete**', (r) => r.fulfill(empty))
}

const SCHOOL_PLACEHOLDER = '대학교명 입력...'

test.describe('학력 섹션', () => {
  test('0건 진입 → "첫 학력 추가하기" → 학력 추가 모달', async ({ page }) => {
    await mockMyinfoBaseApis(page)
    await page.route('**/myinfo/educations', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.getByRole('button', { name: /첫 학력 추가하기/ }).click()

    await expect(page.getByRole('dialog', { name: '학력 추가' })).toBeVisible()
  })

  test('학교 단계 select 옵션에 "고등학교" 존재 (고졸 단어 사용 안 함)', async ({ page }) => {
    await mockMyinfoBaseApis(page)
    await page.route('**/myinfo/educations', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.getByRole('button', { name: /첫 학력 추가하기/ }).click()

    const dialog = page.getByRole('dialog', { name: '학력 추가' })
    const degreeSelect = dialog.locator('select').first()
    const options = await degreeSelect.locator('option').allTextContents()
    expect(options).toContain('고등학교')
    expect(options).toContain('대학교 (학사)')
    expect(options).toContain('대학원 (석사)')
    expect(options).toContain('대학원 (박사)')
    expect(options).not.toContain('고졸')  // 거시기한 단어 사용 금지
  })

  test('학교명 입력 후 "추가" → POST 호출 (school_name 포함)', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    let postBody: Record<string, unknown> | null = null
    await page.route('**/myinfo/educations', (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      } else if (req.method() === 'POST') {
        postBody = JSON.parse(req.postData() ?? '{}')
        route.fulfill({ status: 201, contentType: 'application/json',
          body: JSON.stringify({ data: { id: 'e-new', user_id: TEST_USER.id, ...postBody } }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.getByRole('button', { name: /첫 학력 추가하기/ }).click()

    const dialog = page.getByRole('dialog', { name: '학력 추가' })
    await dialog.getByPlaceholder(SCHOOL_PLACEHOLDER).fill('연세대학교')
    // body 의 minor "추가" 칩과 구분 — footer 저장 버튼은 마지막 "추가"
    await dialog.getByRole('button', { name: '추가', exact: true }).last().click()

    await expect.poll(() => postBody, { timeout: 3000 }).not.toBeNull()
    expect(postBody!.school_name).toBe('연세대학교')
  })

  test('학교명 미입력 시 "추가" → POST 미호출 (validation)', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    let postCalled = false
    await page.route('**/myinfo/educations', (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      } else if (req.method() === 'POST') {
        postCalled = true
        route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.getByRole('button', { name: /첫 학력 추가하기/ }).click()

    const dialog = page.getByRole('dialog', { name: '학력 추가' })
    await dialog.getByRole('button', { name: '추가', exact: true }).last().click()

    // 학교명 미입력 → 저장 차단 (토스트) + 모달 유지 + POST 없음
    await expect(page.getByText('학교명을 입력해주세요.')).toBeVisible()
    await page.waitForTimeout(500)
    expect(postCalled).toBe(false)
  })

  test('기존 학력 "편집" → 학력 편집 모달 prefilled', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = { id: 'e-1', user_id: TEST_USER.id, school_name: '서울대학교', degree: '대학교 (학사)', status: '재학중' }
    await page.route('**/myinfo/educations', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [existingEdu] }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.getByRole('button', { name: '편집', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: '학력 편집' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByPlaceholder(SCHOOL_PLACEHOLDER)).toHaveValue('서울대학교')
  })

  test('복수전공 칩 추가 → 저장 시 minors 포함 (PATCH)', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = { id: 'e-1', user_id: TEST_USER.id, school_name: '서울대', degree: '대학교 (학사)', status: '재학중', minors: null }
    let patchBody: Record<string, unknown> | null = null
    await page.route('**/myinfo/educations/e-1', (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: { ...existingEdu, ...patchBody } }) })
      } else {
        route.continue()
      }
    })
    await page.route('**/myinfo/educations', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [existingEdu] }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.getByRole('button', { name: '편집', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: '학력 편집' })
    // 편집 모달의 저장 버튼은 "수정" → body 의 "추가"는 minor 칩 뿐 (명확)
    await dialog.getByRole('button', { name: '추가', exact: true }).click()
    const nameInput = dialog.getByPlaceholder('전공명')
    await nameInput.fill('경제학')
    await nameInput.press('Enter')

    await dialog.getByRole('button', { name: '수정', exact: true }).click()

    await expect.poll(() => patchBody, { timeout: 3000 }).not.toBeNull()
    expect(Array.isArray(patchBody!.minors)).toBe(true)
    expect((patchBody!.minors as unknown[])[0]).toMatchObject({ type: '복수전공', name: '경제학' })
  })

  test('편집 모달 삭제 → 삭제 확인 → DELETE 호출', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = { id: 'e-1', user_id: TEST_USER.id, school_name: '서울대', degree: '대학교 (학사)', status: '재학중' }
    let deleteCalled = false
    await page.route('**/myinfo/educations/e-1', (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      } else {
        route.continue()
      }
    })
    await page.route('**/myinfo/educations', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [existingEdu] }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.getByRole('button', { name: '편집', exact: true }).click()

    const editDialog = page.getByRole('dialog', { name: '학력 편집' })
    await editDialog.getByRole('button', { name: '삭제' }).click()

    // 삭제 확인 모달의 "삭제" 확정 버튼
    await page.getByRole('dialog', { name: /삭제 확인/ }).getByRole('button', { name: '삭제', exact: true }).click()

    await expect.poll(() => deleteCalled).toBe(true)
  })
})
