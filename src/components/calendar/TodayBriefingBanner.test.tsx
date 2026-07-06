/**
 * A7 — 오늘 브리핑 배너 시나리오:
 * 1. 오늘(KST) 브리핑 있음 → 배너 렌더 + 알림센터 브리핑 필터 링크
 * 2. 어제 브리핑만 → 미렌더 ("없으면 침묵")
 * 3. 오늘 알림이 브리핑 타입 아님 → 미렌더
 * 4. 알림 없음(로딩·빈) → 미렌더
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayBriefingBanner } from './TodayBriefingBanner'
import type { NotificationItem } from '@/types/notification'

let pages: Array<{ items: NotificationItem[]; unreadCount: number }> | undefined

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({ data: pages ? { pages } : undefined }),
}))

const item = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n-1',
  type: 'briefing',
  title: '오늘 마감 2건 · 면접 1건',
  body: '카카오 서류 마감 D-day\n네이버 면접 D-1',
  deepLink: null,
  payload: null,
  read: false,
  createdAt: new Date().toISOString(),
  ...over,
})

function renderBanner() {
  return render(
    <MemoryRouter>
      <TodayBriefingBanner />
    </MemoryRouter>,
  )
}

describe('TodayBriefingBanner', () => {
  beforeEach(() => {
    pages = undefined
  })

  it('1) 오늘 브리핑 있음 → 배너 + 브리핑 필터 링크', () => {
    pages = [{ items: [item()], unreadCount: 1 }]
    renderBanner()
    expect(screen.getByText('오늘 마감 2건 · 면접 1건')).toBeInTheDocument()
    // body 첫 줄만 노출
    expect(screen.getByText('카카오 서류 마감 D-day')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/notifications?type=briefing',
    )
  })

  it('2) 어제 브리핑만 → 미렌더', () => {
    pages = [
      {
        items: [
          item({
            createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
          }),
        ],
        unreadCount: 0,
      },
    ]
    const { container } = renderBanner()
    expect(container.firstChild).toBeNull()
  })

  it('3) 오늘 알림이 브리핑 타입 아님 → 미렌더', () => {
    pages = [{ items: [item({ type: 'deadline_urgent' })], unreadCount: 1 }]
    const { container } = renderBanner()
    expect(container.firstChild).toBeNull()
  })

  it('4) 알림 데이터 없음 → 미렌더', () => {
    const { container } = renderBanner()
    expect(container.firstChild).toBeNull()
  })
})
