/**
 * api/notifications.ts — getNotifications 쿼리 파라미터 (U23 서버사이드 type 필터).
 *
 * 시나리오:
 * 1. 인자 없음 → params 빈 객체 (첫 페이지 · 전체)
 * 2. type 만 → params.type 전송
 * 3. cursor 만 → params.cursor 전송
 * 4. cursor + type → 둘 다 전송 ("더 보기"가 필터 상태 유지)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getNotifications } from './notifications'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

const mockedGet = vi.mocked(apiClient.get)

beforeEach(() => {
  vi.clearAllMocks()
  mockedGet.mockResolvedValue({
    data: { data: { items: [], nextCursor: null, unreadCount: 0 } },
  } as never)
})

describe('getNotifications — 쿼리 파라미터', () => {
  it('1. 인자 없음 → 빈 params', async () => {
    await getNotifications()
    expect(mockedGet).toHaveBeenCalledWith('/notifications', { params: {} })
  })

  it('2. type 만 → params.type', async () => {
    await getNotifications(undefined, 'briefing')
    expect(mockedGet).toHaveBeenCalledWith('/notifications', {
      params: { type: 'briefing' },
    })
  })

  it('3. cursor 만 → params.cursor', async () => {
    await getNotifications('2026-07-01T00:00:00.000Z')
    expect(mockedGet).toHaveBeenCalledWith('/notifications', {
      params: { cursor: '2026-07-01T00:00:00.000Z' },
    })
  })

  it('4. cursor + type → 둘 다 (필터 상태 페이지네이션)', async () => {
    await getNotifications('2026-07-01T00:00:00.000Z', 'deadline_urgent')
    expect(mockedGet).toHaveBeenCalledWith('/notifications', {
      params: {
        cursor: '2026-07-01T00:00:00.000Z',
        type: 'deadline_urgent',
      },
    })
  })
})
