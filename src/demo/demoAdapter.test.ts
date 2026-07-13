import { describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { demoAdapter } from './demoAdapter'

const get = (url: string) =>
  demoAdapter({ url, method: 'get' } as InternalAxiosRequestConfig)

describe('demoAdapter', () => {
  it('GET /notifications — 알림 봉투 형태 반환 (2026-07-13 데모 캘린더 백지 회귀 방지)', async () => {
    const res = await get('/notifications')
    // null 이면 useNotifications 의 pages[null].items 에서 렌더 크래시 → 캘린더 전체 백지
    expect(res.data.data).toEqual({ items: [], nextCursor: null, unreadCount: 0 })
  })

  it('GET /notifications?cursor=... — 쿼리스트링 붙어도 동일 경로 매칭', async () => {
    const res = await get('/notifications?cursor=abc&limit=20')
    expect(res.data.data.items).toEqual([])
  })

  it('GET 등록 경로 — 캘린더 이벤트 샘플 반환', async () => {
    const res = await get('/calendar/events?year=2026&month=7')
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  it('GET 미등록 경로 — null 반환 (기존 계약 유지)', async () => {
    const res = await get('/unknown/path')
    expect(res.data.data).toBeNull()
  })
})
