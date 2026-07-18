/**
 * 알림센터 — 타입 필터(A7 → U23 서버사이드) + 미읽음 행 구분감(U30) 시나리오:
 * 1. 기본(전체) → 모든 타입 표시
 * 2. 브리핑 chip 클릭 → useNotifications 가 type='briefing' 으로 재조회 (서버 필터)
 * 3. '?type=briefing' 딥링크 진입 → 필터 초기 적용 (캘린더 배너 경유)
 * 4. 브리핑 필터 + 브리핑 0건 → 전용 빈 상태 문구
 * 5. (U30) 미읽음 행 = card-solid + 유형색 좌측 스트라이프 / 읽음 행 = surface-2
 *
 * U23: 클라이언트 필터 제거 → useNotifications(type) 가 서버 필터. 여기선 mock 이
 * type 인자로 서버 필터를 시뮬레이션 (컴포넌트가 올바른 type 을 넘기는지 검증).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Notifications } from './Notifications'
import type { NotificationItem } from '@/types/notification'

let items: NotificationItem[] = []
const useNotificationsSpy = vi.fn()

vi.mock('@/hooks/useNotifications', () => ({
  // 서버 필터 시뮬레이션 — 컴포넌트가 넘긴 type 으로 실제 필터링
  useNotifications: (type?: string) => {
    useNotificationsSpy(type)
    return {
      data: {
        pages: [
          {
            items: type ? items.filter((i) => i.type === type) : items,
            unreadCount: 0,
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    }
  },
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

describe('Notifications — 타입 필터 (U23 서버사이드)', () => {
  beforeEach(() => {
    useNotificationsSpy.mockClear()
    items = [
      item({ type: 'briefing', title: '아침 브리핑' }),
      item({ type: 'deadline_urgent', title: '마감 긴급' }),
      item({ type: 'admin', title: '운영 공지' }),
    ]
  })

  it('1) 기본(전체) → 모든 타입 표시 · useNotifications(undefined)', () => {
    renderPage()
    expect(screen.getByText('아침 브리핑')).toBeInTheDocument()
    expect(screen.getByText('마감 긴급')).toBeInTheDocument()
    expect(screen.getByText('운영 공지')).toBeInTheDocument()
    expect(useNotificationsSpy).toHaveBeenLastCalledWith(undefined)
  })

  it('2) 브리핑 chip 클릭 → type="briefing" 로 재조회 (쿼리 인자)', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '📅 브리핑' }))
    expect(useNotificationsSpy).toHaveBeenLastCalledWith('briefing')
    expect(screen.getByText('아침 브리핑')).toBeInTheDocument()
    expect(screen.queryByText('마감 긴급')).toBeNull()
    expect(screen.queryByText('운영 공지')).toBeNull()
  })

  it("3) '?type=briefing' 딥링크 → 필터 초기 적용", () => {
    renderPage('/notifications?type=briefing')
    expect(useNotificationsSpy).toHaveBeenLastCalledWith('briefing')
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

describe('Notifications — 미읽음 행 구분감 (U30)', () => {
  beforeEach(() => {
    useNotificationsSpy.mockClear()
    items = [
      item({ type: 'briefing', title: '안읽음 브리핑', read: false }),
      item({ type: 'admin', title: '읽음 운영', read: true }),
    ]
  })

  it('미읽음 행 = card-solid + 유형색 좌측 스트라이프 + shadow', () => {
    renderPage()
    const row = screen.getByText('안읽음 브리핑').closest('button')
    expect(row).not.toBeNull()
    expect(row!.className).toContain('bg-card-solid')
    expect(row!.className).toContain('border-l-[3px]')
    expect(row!.className).toContain('border-l-brand')
    expect(row!.className).toContain('shadow-sm')
    // 저알파 틴트 잔재 없음
    expect(row!.className).not.toContain('bg-brand/10')
  })

  it('읽음 행 = surface-2 (스트라이프·틴트 없음)', () => {
    renderPage()
    const row = screen.getByText('읽음 운영').closest('button')
    expect(row).not.toBeNull()
    expect(row!.className).toContain('bg-surface-2')
    expect(row!.className).not.toContain('border-l-[3px]')
    expect(row!.className).not.toContain('bg-card-solid')
  })
})
