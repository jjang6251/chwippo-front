import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAdminReach } from './adminReach'
import { apiClient } from './client'

/**
 * 🔴 **이 파일이 없어서 실제로 크래시가 났다** (2026-08-06).
 *
 * 화면 테스트는 `getAdminReach` 를 통째로 mock 해서 **봉투 해제 코드가 한 번도 안 돌았고**,
 * e2e 는 `res.body.data ?? res.body` 로 써서 봉투가 있든 없든 통과했다.
 * 결과: 프론트가 `{ data, message }` 봉투를 그대로 화면에 넘겨
 * `undefined.toLocaleString()` 으로 admin 페이지가 통째로 죽었다.
 *
 * 여기서 **HTTP 경계 그 자체**를 검증한다 — mock 은 axios 까지만이다.
 */

vi.mock('./client', () => ({
  apiClient: { get: vi.fn() },
}))

const get = vi.mocked(apiClient.get)

const payload = {
  rows: [],
  truncated: false,
  totalUsers: 3,
  excludedAdmins: 1,
  stageCounts: {
    signup: 3,
    card: 1,
    activity: 0,
    coverletter_question: 0,
    coverletter_answer: 0,
    coverletter_ai: 0,
  },
  desktopAxis: { confirmed: 0, coverletterAnswer: 0, coverletterAi: 0 },
  generatedAt: '2026-08-06T00:00:00Z',
}

beforeEach(() => vi.clearAllMocks())

describe('getAdminReach', () => {
  // 🔴 백엔드는 ResponseTransformInterceptor 로 모든 응답을 { data, message } 로 감싼다
  it('{ data, message } 봉투를 벗겨 payload 를 준다', async () => {
    get.mockResolvedValue({ data: { data: payload, message: 'ok' } })

    const res = await getAdminReach()

    expect(res.totalUsers).toBe(3)
    expect(res).not.toHaveProperty('message')
  })

  describe('응답 형태가 깨지면 에러로 올린다', () => {
    // ⚠️ 0 으로 채우지 않는다 — "모른다" 를 "0명" 이라는 거짓 주장으로 바꾸기 때문
    it.each([
      ['봉투 안이 비었을 때', { data: { data: null, message: 'ok' } }],
      ['totalUsers 누락 (구버전 백엔드)', { data: { data: { ...payload, totalUsers: undefined } } }],
      ['rows 가 배열이 아님', { data: { data: { ...payload, rows: null } } }],
      ['stageCounts 누락', { data: { data: { ...payload, stageCounts: undefined } } }],
      ['desktopAxis 누락', { data: { data: { ...payload, desktopAxis: undefined } } }],
    ])('%s', async (_label, response) => {
      get.mockResolvedValue(response)
      await expect(getAdminReach()).rejects.toThrow(/올바르지 않습니다/)
    })
  })

  it('빈 결과(사용자 0명)는 정상 응답이다 — 에러가 아니다', async () => {
    get.mockResolvedValue({
      data: { data: { ...payload, rows: [], totalUsers: 0 }, message: 'ok' },
    })

    await expect(getAdminReach()).resolves.toMatchObject({ totalUsers: 0 })
  })
})
