/**
 * F6 PR 2 Phase 5.2 — AiQuotas 매트릭스 페이지 테스트.
 *
 * 시나리오:
 * 1. 로딩 → "로딩 중..."
 * 2. 정상 로드 → free tier 행들 표시 (FEATURE_LABEL 한국어)
 * 3. dirty 상태 (dayLimit 변경) → "저장" 활성
 * 4. enabled=true → toggle 클릭 시 window.confirm 강제, 거부 시 변경 X
 * 5. pro/enterprise tier 탭 disabled (F7 후속)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiQuotas } from './AiQuotas'
import { aiFeatureQuotasApi } from '@/api/aiFeatureQuotas'
import type { FeatureQuotaConfig } from '@/types/aiQuota'

vi.mock('@/api/aiFeatureQuotas', () => ({
  aiFeatureQuotasApi: { listAll: vi.fn(), update: vi.fn() },
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn() },
}))

const apiMock = vi.mocked(aiFeatureQuotasApi.listAll)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const sampleRow: FeatureQuotaConfig = {
  feature: 'note_summary',
  tier: 'free',
  dayLimit: 5,
  monthLimit: 100,
  cooldownSeconds: 30,
  enabled: true,
  updatedBy: null,
  updatedAt: '2026-05-28T00:00:00Z',
}

async function waitForRow() {
  await waitFor(() => expect(screen.queryByText('로딩 중...')).toBeNull(), {
    timeout: 1000,
  })
}

describe('AiQuotas page', () => {
  beforeEach(() => apiMock.mockReset())

  it('정상 로드 → feature 한국어 label 표시', async () => {
    apiMock.mockResolvedValue([sampleRow])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    expect(screen.getByText('노트 요약')).toBeInTheDocument()
    expect(screen.getByText('note_summary')).toBeInTheDocument()
  })

  it('빈 매트릭스 → 안내 문구', async () => {
    apiMock.mockResolvedValue([])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    expect(
      screen.getByText('이 tier 의 feature 설정이 없어요.'),
    ).toBeInTheDocument()
  })

  it('dayLimit 변경 → "저장" 버튼 활성', async () => {
    apiMock.mockResolvedValue([sampleRow])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    const dayInput = screen.getAllByRole('spinbutton')[0]
    expect(screen.getByText('저장')).toBeDisabled()
    fireEvent.change(dayInput, { target: { value: '10' } })
    expect(screen.getByText('저장')).not.toBeDisabled()
  })

  it('enabled toggle → window.confirm 강제 (거부 시 변경 X)', async () => {
    apiMock.mockResolvedValue([sampleRow])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    fireEvent.click(screen.getByText('✓ 활성'))
    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.getByText('✓ 활성')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('pro/enterprise tier 탭 disabled (F7 후속)', async () => {
    apiMock.mockResolvedValue([sampleRow])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    expect(screen.getByText('Pro (F7)')).toBeDisabled()
    expect(screen.getByText('Enterprise (F7)')).toBeDisabled()
  })
})
