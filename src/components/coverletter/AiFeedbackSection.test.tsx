/**
 * A1 Phase 3 — AI 심층 점검 섹션 테스트.
 *
 * 시나리오:
 * 1. 초기 — "점검 받기" 버튼 + 비용 안내("약 10코인")
 * 2. 성공 — 잘한 점 / kind 라벨 + 원문 인용 / 예시(취소선→개선) / 총평 렌더
 * 3. blocked — reason 표시
 * 4. API 실패 → 에러 토스트 (mutation onError)
 * 5. 예시 적용 — 원문 있으면 치환 콜백 + ✓ 적용됨 / 원문 없으면 안내 + 콜백 미호출
 * 6. answer/onApplyText 미전달(하위호환) → 적용 버튼 미노출
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiFeedbackSection } from './AiFeedbackSection'
import { apiClient } from '@/api/client'
import { toast } from '@/stores/toastStore'

vi.mock('@/api/client', () => ({ apiClient: { post: vi.fn() } }))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const postMock = vi.mocked(apiClient.post)

const OK_RESPONSE = {
  data: {
    data: {
      status: 'ok',
      feedback: {
        strengths: ['정량 근거가 좋아요'],
        issues: [
          {
            kind: 'ai_tone',
            quote: '끊임없는 열정과 도전정신',
            advice: '본인 사례의 구체 동사로 바꿔보세요',
          },
        ],
        suggestions: [
          { target: '끊임없는 열정', improved: '채널 7개를 직접 비교하며' },
        ],
        summary: '도입부만 다듬으면 좋겠어요',
      },
    },
  },
}

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('AiFeedbackSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('초기 — 점검 받기 버튼 + 비용 안내', () => {
    wrap(<AiFeedbackSection clId="cl-1" />)
    expect(screen.getByRole('button', { name: '점검 받기' })).toBeInTheDocument()
    expect(screen.getByText(/약 10코인/)).toBeInTheDocument()
  })

  it('성공 — 잘한 점·kind 라벨·원문 인용·예시·총평 렌더', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    wrap(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))

    expect(await screen.findByText('AI 티 나는 표현')).toBeInTheDocument()
    expect(screen.getByText(/끊임없는 열정과 도전정신/)).toBeInTheDocument()
    expect(screen.getByText(/👍 정량 근거가 좋아요/)).toBeInTheDocument()
    expect(screen.getByText('채널 7개를 직접 비교하며')).toBeInTheDocument()
    expect(screen.getByText(/도입부만 다듬으면 좋겠어요/)).toBeInTheDocument()
    expect(postMock).toHaveBeenCalledWith('/coverletters/cl-1/ai-feedback')
  })

  it('blocked — reason 표시', async () => {
    postMock.mockResolvedValue({
      data: { data: { status: 'blocked', reason: '오늘 한도 소진' } },
    } as never)
    wrap(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    expect(await screen.findByText('오늘 한도 소진')).toBeInTheDocument()
  })

  it('API 실패 → 에러 토스트', async () => {
    postMock.mockRejectedValue(new Error('500'))
    wrap(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('예시 적용 — 원문 포함 시 치환 콜백 + ✓ 적용됨 전환', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    const onApplyText = vi.fn()
    wrap(
      <AiFeedbackSection
        clId="cl-1"
        answer="저는 끊임없는 열정으로 성장했습니다"
        onApplyText={onApplyText}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    fireEvent.click(await screen.findByRole('button', { name: '이 문장 적용' }))

    expect(onApplyText).toHaveBeenCalledWith(
      '저는 채널 7개를 직접 비교하며으로 성장했습니다',
    )
    expect(screen.getByText('✓ 적용됨')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이 문장 적용' })).toBeNull()
  })

  it('예시 적용 — 원문 없으면(이미 수정) 안내 + 콜백 미호출', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    const onApplyText = vi.fn()
    wrap(
      <AiFeedbackSection
        clId="cl-1"
        answer="이미 전부 고쳐 쓴 답변입니다"
        onApplyText={onApplyText}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    fireEvent.click(await screen.findByRole('button', { name: '이 문장 적용' }))

    expect(onApplyText).not.toHaveBeenCalled()
    expect(
      screen.getByText(/원문을 찾을 수 없어요/),
    ).toBeInTheDocument()
  })

  it('answer/onApplyText 미전달 → 적용 버튼 미노출 (하위호환)', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    wrap(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))
    await screen.findByText('AI 티 나는 표현')
    expect(screen.queryByRole('button', { name: '이 문장 적용' })).toBeNull()
  })
})
