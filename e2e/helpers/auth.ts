import type { Page } from '@playwright/test'

const TEST_USER = {
  id: 'test-user-uuid-1',
  nickname: '테스트유저',
  email: 'test@chwippo.com',
  role: 'user' as const,
  // AuthGuard 가 termsAgreedAt falsy 시 /terms-agreement 로 리다이렉트 →
  // 보호 페이지 E2E 가 전부 약관 화면으로 튕기던 원인. 동의 완료 유저로 세팅.
  termsAgreedAt: '2026-01-01T00:00:00.000Z',
  onboardedAt: '2026-01-01T00:00:00.000Z',
}

const TEST_TOKEN = 'mock-access-token'

/**
 * /auth/refresh를 mock해서 인증된 상태로 만든다.
 * AuthGuard가 refresh 호출 결과로 유저를 설정하는 구조를 이용.
 */
export async function mockAuth(page: Page) {
  await page.route('**/auth/refresh', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { accessToken: TEST_TOKEN, user: TEST_USER },
      }),
    })
  })
}

export async function mockAuthAsAdmin(page: Page) {
  await page.route('**/auth/refresh', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: TEST_TOKEN,
          user: { ...TEST_USER, role: 'admin' },
        },
      }),
    })
  })
}

export async function mockAuthFail(page: Page) {
  await page.route('**/auth/refresh', (route) => {
    route.fulfill({ status: 401, body: '{}' })
  })
}

export { TEST_USER }
