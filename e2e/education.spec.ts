/**
 * 학력 섹션 E2E
 *
 * 시나리오 케이스:
 * 1. /myinfo#education 진입 + 학력 0개 → 빈 row 1개 자동 생성 (POST 호출)
 * 2. 이미 학력 있는 상태로 진입 → 자동 생성 안 됨
 * 3. 학교명 입력 후 blur → 자동 저장 (PATCH 호출)
 * 4. 학교 단계 드롭다운 변경 → 즉시 저장 (PATCH)
 * 5. 복수전공/부전공 칩 추가 → PATCH minors 호출
 * 6. + 학력 추가 클릭 → 새 빈 row 생성 (POST 추가 호출)
 * 7. × 삭제 버튼 → 삭제 확인 모달 → 확인 시 DELETE 호출
 * 8. 학교 단계 옵션에 고졸이 아닌 "고등학교" 라벨 노출
 */
import { test, expect } from '@playwright/test'
import { mockAuth, TEST_USER } from './helpers/auth'

async function mockMyinfoBaseApis(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page)
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
}

test.describe('학력 섹션', () => {
  test('학력 0개 진입 → 빈 row 1개 자동 생성 (POST 호출)', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    let postCalled = false
    let postBody: any = null
    let educationsState: any[] = []
    await page.route('**/myinfo/educations', (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: educationsState }) })
      } else if (req.method() === 'POST') {
        postCalled = true
        postBody = JSON.parse(req.postData() ?? '{}')
        const created = { id: 'e-new', user_id: TEST_USER.id, ...postBody }
        educationsState = [created]
        route.fulfill({ status: 201, contentType: 'application/json',
          body: JSON.stringify({ data: created }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')

    await expect.poll(() => postCalled, { timeout: 5000 }).toBe(true)
    expect(postBody.school_name).toBe('')
  })

  test('이미 학력 있는 상태로 진입 → 자동 생성 안 됨', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = { id: 'e-1', user_id: TEST_USER.id, school_name: '서울대학교', degree: '대학교 (학사)' }
    let postCalled = false
    await page.route('**/myinfo/educations', (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: [existingEdu] }) })
      } else if (req.method() === 'POST') {
        postCalled = true
        route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.waitForTimeout(1000)  // useEffect 실행 시간 보장
    expect(postCalled).toBe(false)
  })

  test('학교명 blur → PATCH 자동 저장', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = { id: 'e-1', user_id: TEST_USER.id, school_name: '', degree: '대학교 (학사)', status: '재학중' }
    let patchBody: any = null
    await page.route('**/myinfo/educations**', (route) => {
      const req = route.request()
      const url = req.url()
      if (req.method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: [existingEdu] }) })
      } else if (req.method() === 'PATCH' && url.includes('/e-1')) {
        patchBody = JSON.parse(req.postData() ?? '{}')
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: { ...existingEdu, ...patchBody } }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')

    const input = page.getByPlaceholder(/서울대학교/)
    await input.fill('연세대학교')
    await input.blur()

    await expect.poll(() => patchBody, { timeout: 3000 }).not.toBeNull()
    expect(patchBody.school_name).toBe('연세대학교')
  })

  test('학교 단계 드롭다운에 "고등학교" 옵션 존재 (고졸 단어 사용 안 함)', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = { id: 'e-1', user_id: TEST_USER.id, school_name: '', degree: '대학교 (학사)' }
    await page.route('**/myinfo/educations**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: [existingEdu] }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')

    const degreeSelect = page.locator('#education select').first()
    const options = await degreeSelect.locator('option').allTextContents()
    expect(options).toContain('고등학교')
    expect(options).toContain('대학교 (학사)')
    expect(options).toContain('대학원 (석사)')
    expect(options).toContain('대학원 (박사)')
    expect(options).not.toContain('고졸')  // 거시기한 단어 사용 금지
  })

  test('복수전공 칩 추가 → PATCH minors 호출', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = {
      id: 'e-1', user_id: TEST_USER.id,
      school_name: '서울대', degree: '대학교 (학사)', minors: null,
    }
    let minorsPatch: any = null
    await page.route('**/myinfo/educations**', (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: [existingEdu] }) })
      } else if (req.method() === 'PATCH') {
        const body = JSON.parse(req.postData() ?? '{}')
        if (body.minors !== undefined) minorsPatch = body
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: { ...existingEdu, ...body } }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')

    // 복수·부전공 영역 scope — "복수·부전공" 헤더 부모 안에서
    const minorSection = page.locator('text=복수·부전공').locator('..')
    await minorSection.getByRole('button', { name: '추가', exact: true }).click()
    // Enter 키로 submit (✓ 버튼도 동일 aria-label 사용해서 충돌 회피)
    const nameInput = page.getByPlaceholder('전공명')
    await nameInput.fill('경제학')
    await nameInput.press('Enter')

    await expect.poll(() => minorsPatch, { timeout: 5000 }).not.toBeNull()
    expect(Array.isArray(minorsPatch.minors)).toBe(true)
    expect(minorsPatch.minors[0]).toMatchObject({ type: '복수전공', name: '경제학' })
  })

  test('+ 학력 추가 클릭 → POST 호출 (수동 추가)', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = { id: 'e-1', user_id: TEST_USER.id, school_name: '서울대', degree: '대학교 (학사)' }
    let postCalledCount = 0
    let educationsState = [existingEdu]
    await page.route('**/myinfo/educations', (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: educationsState }) })
      } else if (req.method() === 'POST') {
        postCalledCount++
        const body = JSON.parse(req.postData() ?? '{}')
        const created = { id: `e-${postCalledCount + 1}`, user_id: TEST_USER.id, ...body }
        educationsState = [...educationsState, created]
        route.fulfill({ status: 201, contentType: 'application/json',
          body: JSON.stringify({ data: created }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')
    await page.waitForTimeout(500)  // 초기 fetch 완료
    expect(postCalledCount).toBe(0)  // 자동 생성 X (이미 1개 있음)

    await page.getByRole('button', { name: '학력 추가' }).click()
    await expect.poll(() => postCalledCount).toBeGreaterThan(0)
  })

  test('× 버튼 클릭 → 삭제 확인 모달 → 확인 → DELETE 호출', async ({ page }) => {
    await mockMyinfoBaseApis(page)

    const existingEdu = { id: 'e-1', user_id: TEST_USER.id, school_name: '서울대', degree: '대학교 (학사)' }
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
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: [existingEdu] }) })
      } else {
        route.continue()
      }
    })

    await page.goto('/myinfo#education')

    await page.getByRole('button', { name: '학력 삭제' }).click()
    // DeleteModal 확인 버튼 — 보통 "삭제" 또는 "확인"
    await page.getByRole('button', { name: /^삭제$/ }).click()

    await expect.poll(() => deleteCalled).toBe(true)
  })
})
