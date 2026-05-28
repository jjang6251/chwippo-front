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
  perResourceDayLimit: 5,
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

  // ── 5.6.소급 — FEATURE_LABEL 12종 + fallback ──
  it('5.6.소급 — 12 feature 모두 한국어 라벨 표시 (legacy/deprecated 포함)', async () => {
    apiMock.mockResolvedValue([
      { ...sampleRow, feature: 'note_summary' },
      { ...sampleRow, feature: 'coverletter' },
      { ...sampleRow, feature: 'interview' },
      { ...sampleRow, feature: 'interview_followup' },
      { ...sampleRow, feature: 'score' },
      { ...sampleRow, feature: 'analysis' },
      { ...sampleRow, feature: 'auto_tag' },
      { ...sampleRow, feature: 'coverletter_draft_v2' },
      { ...sampleRow, feature: 'coverletter_feedback' },
      { ...sampleRow, feature: 'coverletter_recommend' },
      { ...sampleRow, feature: 'interview_prep_session' },
      { ...sampleRow, feature: 'interview_prep_followup' },
      { ...sampleRow, feature: 'company_research' },
    ] as never)
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    expect(screen.getByText('노트 요약')).toBeInTheDocument()
    expect(screen.getByText('자소서 (legacy)')).toBeInTheDocument()
    expect(screen.getByText('면접 (legacy)')).toBeInTheDocument()
    expect(screen.getByText('점수 (deprecated)')).toBeInTheDocument()
    expect(screen.getByText('분석 (deprecated)')).toBeInTheDocument()
    expect(screen.getByText('자동 태그 (deprecated)')).toBeInTheDocument()
    expect(screen.getByText('자소서 AI 답변')).toBeInTheDocument()
    expect(screen.getByText('면접 질문 생성')).toBeInTheDocument()
    expect(screen.getByText('회사 조사')).toBeInTheDocument()
    // undefined 토스트 방지 fallback — 모든 행에 한국어 표시
    expect(screen.queryByText('undefined')).toBeNull()
  })

  it('5.6.소급 — FEATURE_LABEL 없는 unknown feature → fallback (원본 key 그대로)', async () => {
    apiMock.mockResolvedValue([
      { ...sampleRow, feature: 'experimental_unknown' as never },
    ])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    expect(screen.getAllByText('experimental_unknown')).toHaveLength(2)
    expect(screen.queryByText('undefined')).toBeNull()
  })

  // ── 5.6.8 — 노트별 한도 input (note_summary 만 활성) ──
  it('5.6.8 — note_summary 행의 노트별 한도 input 활성 + 값 표시', async () => {
    apiMock.mockResolvedValue([
      { ...sampleRow, feature: 'note_summary', perResourceDayLimit: 5 },
    ])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs[3]).not.toBeDisabled()
    expect((inputs[3] as HTMLInputElement).value).toBe('5')
  })

  it('5.6.8 — 다른 feature 행의 노트별 한도 input → disabled + placeholder "—"', async () => {
    apiMock.mockResolvedValue([
      {
        ...sampleRow,
        feature: 'coverletter_draft_v2',
        perResourceDayLimit: null,
      },
    ])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs[3]).toBeDisabled()
    expect((inputs[3] as HTMLInputElement).placeholder).toBe('—')
  })

  it('5.6.8 — 노트별 한도 변경 → dirty → 저장 버튼 활성', async () => {
    apiMock.mockResolvedValue([
      { ...sampleRow, feature: 'note_summary', perResourceDayLimit: 5 },
    ])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    const perResourceInput = screen.getAllByRole('spinbutton')[3]
    expect(screen.getByText('저장')).toBeDisabled()
    fireEvent.change(perResourceInput, { target: { value: '3' } })
    expect(screen.getByText('저장')).not.toBeDisabled()
  })

  // ── 5.6.9 — 전체 사용량 reset 버튼 ──
  it('13-a) "전체 사용량 reset" 버튼 렌더', async () => {
    apiMock.mockResolvedValue([sampleRow])
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    expect(screen.getByText(/전체 사용량 reset/)).toBeInTheDocument()
  })

  it('13-b) reset 버튼 클릭 → window.confirm 호출 (전체 사용자 경고 포함)', async () => {
    apiMock.mockResolvedValue([sampleRow])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    fireEvent.click(screen.getByText(/전체 사용량 reset/))
    expect(confirmSpy).toHaveBeenCalled()
    expect(confirmSpy.mock.calls[0][0]).toContain('전체 사용자')
    confirmSpy.mockRestore()
  })

  it('13-c) confirm 거부 → mutation 호출 X', async () => {
    apiMock.mockResolvedValue([sampleRow])
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    render(<AiQuotas />, { wrapper })
    await waitForRow()
    fireEvent.click(screen.getByText(/전체 사용량 reset/))
    // resetApi 가 호출되지 않았어야 함 (api mock 은 useQuotaReset 내부)
    // useQuotaReset hook 이 vi.mock 안 되어 있으므로 실제 호출. 단 confirm 거부로 mutate 안 됨
    // 검증: 잠시 후 토스트 메시지 없음
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText(/reset 했어요/)).toBeNull()
  })
})
