import type { Page } from '@playwright/test'

const TEST_USER = {
  id: 'test-user-uuid-1',
  nickname: '테스트유저',
  email: 'test@chwippo.com',
  role: 'user' as const,
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
