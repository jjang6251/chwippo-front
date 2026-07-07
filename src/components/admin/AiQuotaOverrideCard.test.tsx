/**
 * cost hardening B-4 — AiQuotaOverrideCard 테스트.
 *
 * 시나리오:
 * 1. override 없음 → "개별 한도 없음" + 통상 한도 안내
 * 2. 활성 override → "적용 중" 배지 + reason 라벨 + 영구 문구
 * 3. 만료 override → "만료됨" 배지
 * 4. cap 비유효(빈값·범위 밖) → 설정 버튼 disabled
 * 5. 설정 → PUT payload (validUntil 비우면 null · fair_use)
 * 6. 해제 → confirm 후 DELETE
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiQuotaOverrideCard } from './AiQuotaOverrideCard'
import { apiClient } from '@/api/client'
import { quotaResetApi } from '@/api/quotaReset'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/api/quotaReset', () => ({
  quotaResetApi: { reset: vi.fn() },
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const getMock = vi.mocked(apiClient.get)
const putMock = vi.mocked(apiClient.put)
const deleteMock = vi.mocked(apiClient.delete)

const USER_ID = 'user-1'

function mockGet(override: unknown, active: boolean) {
  getMock.mockResolvedValue({ data: { data: { override, active } } } as never)
}

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('AiQuotaOverrideCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('override 없음 → 통상 한도 안내', async () => {
    mockGet(null, false)
    wrap(<AiQuotaOverrideCard userId={USER_ID} />)

    expect(
      await screen.findByText('개별 한도 없음 — tier 통상 한도 적용 중'),
    ).toBeInTheDocument()
  })

  it('활성 override → "적용 중" 배지 + fair use 라벨 + 영구 문구', async () => {
    mockGet(
      {
        dailyCapOverride: 100,
        validUntil: null,
        reason: 'fair_use',
        updatedAt: '2026-07-06',
      },
      true,
    )
    wrap(<AiQuotaOverrideCard userId={USER_ID} />)

    expect(await screen.findByText('적용 중')).toBeInTheDocument()
    expect(screen.getByText('Fair use 상향 (베타·이벤트)')).toBeInTheDocument()
    expect(screen.getByText(/수동 해제까지 영구/)).toBeInTheDocument()
    expect(screen.getByText('100회')).toBeInTheDocument()
  })

  it('만료 override → "만료됨" 배지 (auto ban 이력 표시)', async () => {
    mockGet(
      {
        dailyCapOverride: 5,
        validUntil: '2020-01-01T00:00:00Z',
        reason: 'auto_ban_3_consecutive_days',
        updatedAt: '2020-01-01',
      },
      false,
    )
    wrap(<AiQuotaOverrideCard userId={USER_ID} />)

    expect(await screen.findByText('만료됨')).toBeInTheDocument()
    expect(
      screen.getByText('자동 제재 (3일 연속 한도 도달)'),
    ).toBeInTheDocument()
  })

  it('cap 빈값·범위 밖 → 설정 버튼 disabled', async () => {
    mockGet(null, false)
    wrap(<AiQuotaOverrideCard userId={USER_ID} />)
    await screen.findByText('개별 한도 없음 — tier 통상 한도 적용 중')

    const button = screen.getByRole('button', { name: '설정' })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('예: 100'), {
      target: { value: '1001' },
    })
    expect(button).toBeDisabled()
  })

  it('설정 → PUT payload (만료일 비움 = null, fair_use)', async () => {
    mockGet(null, false)
    putMock.mockResolvedValue({ data: { data: {} } } as never)
    wrap(<AiQuotaOverrideCard userId={USER_ID} />)
    await screen.findByText('개별 한도 없음 — tier 통상 한도 적용 중')

    fireEvent.change(screen.getByPlaceholderText('예: 100'), {
      target: { value: '100' },
    })
    fireEvent.click(screen.getByRole('button', { name: '설정' }))

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith(
        `/admin/users/${USER_ID}/ai-quota-override`,
        { dailyCapOverride: 100, validUntil: null, reason: 'fair_use' },
      ),
    )
  })

  it('해제 → confirm 후 DELETE (거절 시 미호출)', async () => {
    mockGet(
      {
        dailyCapOverride: 100,
        validUntil: null,
        reason: 'fair_use',
        updatedAt: '2026-07-06',
      },
      true,
    )
    deleteMock.mockResolvedValue({ data: { data: { cleared: true } } } as never)
    const confirmSpy = vi.spyOn(window, 'confirm')
    wrap(<AiQuotaOverrideCard userId={USER_ID} />)
    const btn = await screen.findByRole('button', {
      name: '해제 (통상 한도 복귀)',
    })

    confirmSpy.mockReturnValueOnce(false)
    fireEvent.click(btn)
    expect(deleteMock).not.toHaveBeenCalled()

    confirmSpy.mockReturnValueOnce(true)
    fireEvent.click(btn)
    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith(
        `/admin/users/${USER_ID}/ai-quota-override`,
      ),
    )
    confirmSpy.mockRestore()
  })
  it('오늘 사용량 리셋 → confirm 후 해당 유저만 reset 호출 (한도와 독립)', async () => {
    mockGet(null, false)
    vi.mocked(quotaResetApi.reset).mockResolvedValue({
      affected: 1,
      scope: 'single_user',
    })
    const confirmSpy = vi.spyOn(window, 'confirm')
    wrap(<AiQuotaOverrideCard userId={USER_ID} />)
    const btn = await screen.findByRole('button', { name: '오늘 사용량 리셋' })

    confirmSpy.mockReturnValueOnce(false)
    fireEvent.click(btn)
    expect(quotaResetApi.reset).not.toHaveBeenCalled()

    confirmSpy.mockReturnValueOnce(true)
    fireEvent.click(btn)
    await waitFor(() =>
      expect(quotaResetApi.reset).toHaveBeenCalledWith({ userId: USER_ID }),
    )
    confirmSpy.mockRestore()
  })

})
