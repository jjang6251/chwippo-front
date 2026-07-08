/**
 * A1 Phase 3 — AI 심층 점검 섹션 테스트.
 *
 * 상태·호출은 aiFeedbackStore 로 승격됨 (모달 닫아도 진행). 컴포넌트는 스토어를
 * 구독해 running/done/error/저장결과 를 렌더한다.
 *
 * 시나리오:
 * 1. 초기 — "점검 받기" 버튼 + 비용 안내("약 10코인")
 * 2. 성공 — 잘한 점 / kind 라벨 + 원문 인용 / 예시(취소선→개선) / 총평 렌더
 * 3. blocked — reason + "다시 시도"
 * 4. API 실패 → 에러 토스트 (스토어 catch)
 * 5. 예시 적용 — 원문 있으면 치환 콜백 + ✓ 적용됨 / 원문 없으면 안내 + 콜백 미호출
 * 6. answer/onApplyText 미전달(하위호환) → 적용 버튼 미노출
 * 7. 저장된 결과(lastFeedback) → "N분 전 점검" 라벨 + 결과 렌더 (점검 받기 미노출)
 * 8. 재검사 클릭 → clear 후 재호출
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiFeedbackSection } from './AiFeedbackSection'
import { useAiFeedbackStore } from '@/stores/aiFeedbackStore'
import { apiClient } from '@/api/client'
import { toast } from '@/stores/toastStore'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import type { CoverletterFeedback } from '@/types/coverletter'

vi.mock('@/api/client', () => ({ apiClient: { post: vi.fn() } }))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
// AiQuotaChip 은 useMyAiQuota 로 chip 표시 판단 — 테스트에선 숨김(undefined).
// useAiQuotaBlocked 는 사전 차단 판단.
vi.mock('@/hooks/useMyAiQuotas', () => ({
  useMyAiQuota: vi.fn(() => undefined),
  useAiQuotaBlocked: vi.fn(() => ({ blocked: false, reason: null })),
}))

const postMock = vi.mocked(apiClient.post)
const blockedMock = vi.mocked(useAiQuotaBlocked)

const FEEDBACK: CoverletterFeedback = {
  strengths: ['정량 근거가 좋아요'],
  issues: [
    {
      kind: 'ai_tone',
      quote: '끊임없는 열정과 도전정신',
      advice: '본인 사례의 구체 동사로 바꿔보세요',
    },
  ],
  suggestions: [{ target: '끊임없는 열정', improved: '채널 7개를 직접 비교하며' }],
  summary: '도입부만 다듬으면 좋겠어요',
}

const OK_RESPONSE = { data: { data: { status: 'ok', feedback: FEEDBACK } } }

describe('AiFeedbackSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    blockedMock.mockReturnValue({ blocked: false, reason: null })
    useAiFeedbackStore.setState({ entries: {} })
  })

  it('초기 — 점검 받기 버튼 + 비용 안내', () => {
    render(<AiFeedbackSection clId="cl-1" />)
    expect(screen.getByRole('button', { name: '점검 받기' })).toBeInTheDocument()
    expect(screen.getByText(/약 10코인/)).toBeInTheDocument()
  })

  it('성공 — 잘한 점·kind 라벨·원문 인용·예시·총평 렌더', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    render(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))

    expect(await screen.findByText('AI 티 나는 표현')).toBeInTheDocument()
    expect(screen.getByText(/끊임없는 열정과 도전정신/)).toBeInTheDocument()
    expect(screen.getByText(/👍 정량 근거가 좋아요/)).toBeInTheDocument()
    expect(screen.getByText('채널 7개를 직접 비교하며')).toBeInTheDocument()
    expect(screen.getByText(/도입부만 다듬으면 좋겠어요/)).toBeInTheDocument()
    expect(postMock).toHaveBeenCalledWith('/coverletters/cl-1/ai-feedback')
  })

  it('blocked — reason + 다시 시도', async () => {
    postMock.mockResolvedValue({
      data: { data: { status: 'blocked', reason: '오늘 한도 소진' } },
    } as never)
    render(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    expect(await screen.findByText('오늘 한도 소진')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('API 실패 → 에러 토스트', async () => {
    postMock.mockRejectedValue(new Error('500'))
    render(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('예시 적용 — 원문 포함 시 치환 콜백 + ✓ 적용됨 전환', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    const onApplyText = vi.fn()
    render(
      <AiFeedbackSection
        clId="cl-1"
        answer="저는 끊임없는 열정으로 성장했습니다"
        onApplyText={onApplyText}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    fireEvent.click(await screen.findByRole('button', { name: '이 문장 적용' }))

    expect(onApplyText).toHaveBeenCalledWith('저는 채널 7개를 직접 비교하며으로 성장했습니다')
    expect(screen.getByText('✓ 적용됨')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이 문장 적용' })).toBeNull()
  })

  it('예시 적용 — 원문 없으면(이미 수정) 안내 + 콜백 미호출', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    const onApplyText = vi.fn()
    render(
      <AiFeedbackSection
        clId="cl-1"
        answer="이미 전부 고쳐 쓴 답변입니다"
        onApplyText={onApplyText}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    fireEvent.click(await screen.findByRole('button', { name: '이 문장 적용' }))

    expect(onApplyText).not.toHaveBeenCalled()
    expect(screen.getByText(/원문을 찾을 수 없어요/)).toBeInTheDocument()
  })

  it('answer/onApplyText 미전달 → 적용 버튼 미노출 (하위호환)', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    render(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    await screen.findByText('AI 티 나는 표현')
    expect(screen.queryByRole('button', { name: '이 문장 적용' })).toBeNull()
  })

  it('저장된 결과(lastFeedback) — 라벨 + 결과 렌더, 점검 받기 미노출', () => {
    render(
      <AiFeedbackSection
        clId="cl-1"
        lastFeedback={FEEDBACK}
        lastFeedbackAt={new Date(Date.now() - 3 * 60 * 1000).toISOString()}
      />,
    )

    expect(screen.getByText('AI 티 나는 표현')).toBeInTheDocument()
    expect(screen.getByText(/3분 전 점검/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '↻ 재검사' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '점검 받기' })).toBeNull()
  })

  it('quota 사전 차단 — 점검 받기 disabled + reason title', () => {
    blockedMock.mockReturnValue({ blocked: true, reason: '오늘 한도 소진' })
    render(<AiFeedbackSection clId="cl-1" />)
    const btn = screen.getByRole('button', { name: '점검 받기' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', '오늘 한도 소진')
  })

  it('재검사 클릭 → clear 후 재호출 (running 표시)', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    render(
      <AiFeedbackSection
        clId="cl-1"
        lastFeedback={FEEDBACK}
        lastFeedbackAt={new Date().toISOString()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '↻ 재검사' }))

    expect(postMock).toHaveBeenCalledWith('/coverletters/cl-1/ai-feedback')
    // 새 결과가 store 를 통해 다시 렌더됨
    expect(await screen.findByText('AI 티 나는 표현')).toBeInTheDocument()
  })
})
