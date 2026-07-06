/**
 * A7 — 알림센터 타입 필터 (브리핑 아카이브) 시나리오:
 * 1. 기본(전체) → 모든 타입 표시
 * 2. 브리핑 chip 클릭 → briefing 만 표시
 * 3. '?type=briefing' 딥링크 진입 → 필터 초기 적용 (캘린더 배너 경유)
 * 4. 브리핑 필터 + 브리핑 0건 → 전용 빈 상태 문구
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Notifications } from './Notifications'
import type { NotificationItem } from '@/types/notification'

let items: NotificationItem[] = []

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    data: { pages: [{ items, unreadCount: 0 }] },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllRead: () => ({ mutate: vi.fn(), isPending: false }),
}))

const item = (over: Partial<NotificationItem>): NotificationItem => ({
  id: Math.random().toString(36).slice(2),
  type: 'briefing',
  title: '제목',
  body: '내용',
  deepLink: null,
  payload: null,
  read: true,
  createdAt: new Date().toISOString(),
  ...over,
})

function renderPage(initialEntry = '/notifications') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Notifications />
    </MemoryRouter>,
  )
}

describe('Notifications — 타입 필터 (A7)', () => {
  beforeEach(() => {
    items = [
      item({ type: 'briefing', title: '아침 브리핑' }),
      item({ type: 'deadline_urgent', title: '마감 긴급' }),
      item({ type: 'admin', title: '운영 공지' }),
    ]
  })

  it('1) 기본(전체) → 모든 타입 표시', () => {
    renderPage()
    expect(screen.getByText('아침 브리핑')).toBeInTheDocument()
    expect(screen.getByText('마감 긴급')).toBeInTheDocument()
    expect(screen.getByText('운영 공지')).toBeInTheDocument()
  })

  it('2) 브리핑 chip 클릭 → briefing 만 표시', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '📅 브리핑' }))
    expect(screen.getByText('아침 브리핑')).toBeInTheDocument()
    expect(screen.queryByText('마감 긴급')).toBeNull()
    expect(screen.queryByText('운영 공지')).toBeNull()
  })

  it("3) '?type=briefing' 딥링크 → 필터 초기 적용", () => {
    renderPage('/notifications?type=briefing')
    expect(screen.getByText('아침 브리핑')).toBeInTheDocument()
    expect(screen.queryByText('마감 긴급')).toBeNull()
  })

  it('4) 브리핑 필터 + 0건 → 전용 빈 상태 문구', () => {
    items = [item({ type: 'admin', title: '운영 공지' })]
    renderPage('/notifications?type=briefing')
    expect(screen.getByText('아직 받은 브리핑이 없어요')).toBeInTheDocument()
    expect(
      screen.getByText(/매일 아침 8시에 정리해드려요/),
    ).toBeInTheDocument()
  })
})
