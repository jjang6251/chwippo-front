/**
 * 종 배지 ↔ 알림센터 목록 동기화 (묶음 4 실기 조사 후속):
 * 1. 목록 fetch 시 응답 unreadCount 가 종 배지 캐시(['notifications','unread-count'])에 즉시 반영
 * 2. type 필터가 걸려 있어도 동일 동기화 (unreadCount 는 전체값)
 */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { useNotifications } from './useNotifications'

vi.mock('@/api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue({
    items: [],
    nextCursor: null,
    unreadCount: 7,
  }),
  getAlarmConfig: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  updateAlarmConfig: vi.fn(),
}))

vi.mock('@/utils/nativeBridge', () => ({ postToNative: vi.fn() }))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

describe('useNotifications — 종 배지 캐시 동기화', () => {
  it('1) 목록 fetch → unread-count 캐시에 unreadCount 반영', async () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useNotifications(), { wrapper })
    await waitFor(() =>
      expect(qc.getQueryData(['notifications', 'unread-count'])).toBe(7),
    )
  })

  it('2) type 필터 상태에서도 동일 동기화 (unreadCount 는 전체값)', async () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useNotifications('briefing'), { wrapper })
    await waitFor(() =>
      expect(qc.getQueryData(['notifications', 'unread-count'])).toBe(7),
    )
  })
})
