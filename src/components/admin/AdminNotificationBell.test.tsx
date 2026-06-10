/**
 * PR_B2 Phase 4 — AdminNotificationBell spec.
 *
 * 5축 — 정상 / 빈 데이터 / pending / 클릭 동작 / accessibility.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminNotificationBell } from './AdminNotificationBell'
import { adminInquiriesApi } from '@/api/adminInquiries'

vi.mock('@/api/adminInquiries', () => ({
  adminInquiriesApi: {
    getBadges: vi.fn(),
  },
}))

const getBadges = vi.mocked(adminInquiriesApi.getBadges)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(MemoryRouter, null, children),
  )
}

describe('AdminNotificationBell', () => {
  beforeEach(() => {
    getBadges.mockReset()
  })

  it('빈 badge (모두 0) → 빨간 점 표시 X', async () => {
    getBadges.mockResolvedValue({
      inquiriesOpen: 0,
      inquiriesUnassigned: 0,
      slaOverdue: 0,
      adminUnread: 0,
    })
    render(<AdminNotificationBell />, { wrapper })
    await waitFor(() => expect(getBadges).toHaveBeenCalled())

    const bell = screen.getByLabelText(/알림 0건/)
    expect(bell.querySelector('.bg-danger')).toBeNull()
  })

  it('badge 가 있으면 빨간 점 + total 표시', async () => {
    getBadges.mockResolvedValue({
      inquiriesOpen: 5,
      inquiriesUnassigned: 2,
      slaOverdue: 1,
      adminUnread: 3,
    })
    render(<AdminNotificationBell />, { wrapper })
    await waitFor(() =>
      expect(screen.getByLabelText('알림 11건')).toBeInTheDocument(),
    )
  })

  it('종 클릭 → 드롭다운 표시 (4 link)', async () => {
    getBadges.mockResolvedValue({
      inquiriesOpen: 5,
      inquiriesUnassigned: 2,
      slaOverdue: 1,
      adminUnread: 3,
    })
    render(<AdminNotificationBell />, { wrapper })
    await waitFor(() =>
      expect(screen.getByLabelText('알림 11건')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByLabelText('알림 11건'))

    expect(screen.getByText(/처리 대기 문의/)).toBeInTheDocument()
    expect(screen.getByText(/담당 미배정/)).toBeInTheDocument()
    expect(screen.getByText('⏱ 처리 기한 초과')).toBeInTheDocument()
    expect(screen.getByText(/미읽은 응답/)).toBeInTheDocument()
  })

  it('SLA 초과 > 0 → danger 색으로 강조', async () => {
    getBadges.mockResolvedValue({
      inquiriesOpen: 0,
      inquiriesUnassigned: 0,
      slaOverdue: 3,
      adminUnread: 0,
    })
    render(<AdminNotificationBell />, { wrapper })
    await waitFor(() =>
      expect(screen.getByLabelText('알림 3건')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByLabelText('알림 3건'))

    const slaCount = screen.getByText('3')
    expect(slaCount.className).toContain('danger')
  })

  it('각 link 의 href 정확 (filter query param)', async () => {
    getBadges.mockResolvedValue({
      inquiriesOpen: 1,
      inquiriesUnassigned: 1,
      slaOverdue: 1,
      adminUnread: 1,
    })
    render(<AdminNotificationBell />, { wrapper })
    await waitFor(() =>
      expect(screen.getByLabelText('알림 4건')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByLabelText('알림 4건'))

    const unassigned = screen.getByText(/담당 미배정/).closest('a')
    expect(unassigned?.getAttribute('href')).toBe(
      '/ops/inquiries?filter=unassigned',
    )

    const overdue = screen.getByText('⏱ 처리 기한 초과').closest('a')
    expect(overdue?.getAttribute('href')).toBe('/ops/inquiries?filter=overdue')
  })
})
