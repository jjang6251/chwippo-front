/**
 * F6 PR 2 Phase 5.6.11 — SystemStatusPanel 매트릭스 5 시나리오.
 *
 * 1) 마지막 갱신 시각 표시 (N초 전)
 * 2) 다음 자동 갱신 카운트다운
 * 3) 수동 새로고침 → invalidate 호출
 * 4) provider down → alert_history 의 'provider_down' row 찾아 "N시간 전부터"
 * 5) provider up + lastPingedAt → 상대 시간 + latencyMs
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useSystemStatus', () => ({
  useSystemStatus: vi.fn(),
}))

import { useSystemStatus } from '@/hooks/useSystemStatus'
import { SystemStatusPanel } from './SystemStatusPanel'

const useSystemStatusMock = vi.mocked(useSystemStatus)

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  function Wrap({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
  return { qc, invalidateSpy, Wrap }
}

const upHealth = {
  status: 'up' as const,
  latencyMs: 80,
  reason: null,
  lastPingedAt: new Date(Date.now() - 30_000).toISOString(),
}
const downHealth = {
  status: 'down' as const,
  latencyMs: 5000,
  reason: 'HTTP 503',
  lastPingedAt: new Date().toISOString(),
}

const defaultData = {
  backend: 'up' as const,
  db: 'ok' as const,
  openai: upHealth,
  anthropic: upHealth,
}

describe('SystemStatusPanel (5.6.11)', () => {
  beforeEach(() => useSystemStatusMock.mockReset())

  it('1) 마지막 갱신 시각 표시 ("N초 전 갱신")', () => {
    useSystemStatusMock.mockReturnValue({
      data: defaultData,
      dataUpdatedAt: Date.now() - 5000, // 5초 전
    } as never)
    const { Wrap } = makeWrapper()
    render(<SystemStatusPanel recentAlerts={[]} />, { wrapper: Wrap })
    expect(screen.getByText(/\d+초 전 갱신/)).toBeInTheDocument()
  })

  it('2) 다음 자동 갱신 카운트다운 ("N초 후")', () => {
    useSystemStatusMock.mockReturnValue({
      data: defaultData,
      dataUpdatedAt: Date.now() - 5000,
    } as never)
    const { Wrap } = makeWrapper()
    render(<SystemStatusPanel recentAlerts={[]} />, { wrapper: Wrap })
    // 30s refetchInterval - 5s 경과 = 25초 후
    expect(screen.getByText(/다음 \d+초 후/)).toBeInTheDocument()
  })

  it('3) 수동 새로고침 버튼 클릭 → invalidate 호출', () => {
    useSystemStatusMock.mockReturnValue({
      data: defaultData,
      dataUpdatedAt: Date.now(),
    } as never)
    const { invalidateSpy, Wrap } = makeWrapper()
    render(<SystemStatusPanel recentAlerts={[]} />, { wrapper: Wrap })
    fireEvent.click(screen.getByText(/새로고침/))
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'system-status'],
    })
  })

  it('4) provider down → alert_history 의 provider_down row 시각 표시', () => {
    useSystemStatusMock.mockReturnValue({
      data: { ...defaultData, openai: downHealth },
      dataUpdatedAt: Date.now(),
    } as never)
    const { Wrap } = makeWrapper()
    const alerts = [
      {
        id: 'a-1',
        alertType: 'provider_down' as const,
        triggeredValue: 5000,
        thresholdValue: 0,
        message: '🔴 openai down — HTTP 503',
        webhookStatus: 'sent' as const,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
      },
    ]
    render(<SystemStatusPanel recentAlerts={alerts} />, { wrapper: Wrap })
    expect(screen.getByText(/2시간 .* 전부터/)).toBeInTheDocument()
  })

  it('5) provider up → lastPingedAt 상대 시간 + latencyMs 표시', () => {
    useSystemStatusMock.mockReturnValue({
      data: defaultData,
      dataUpdatedAt: Date.now(),
    } as never)
    const { Wrap } = makeWrapper()
    render(<SystemStatusPanel recentAlerts={[]} />, { wrapper: Wrap })
    // upHealth.latencyMs = 80, lastPingedAt = 30s 전
    expect(screen.getAllByText(/80ms/).length).toBeGreaterThan(0)
  })
})
