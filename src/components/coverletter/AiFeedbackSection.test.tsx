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
// AI 사용 동의 사전 게이트 — 기본 동의(true). 미동의 시나리오는 개별 테스트에서 override.
const { ensureConsentMock } = vi.hoisted(() => ({
  ensureConsentMock: vi.fn(async () => true),
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({
  useRequireAiConsent: () => ensureConsentMock,
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
    ensureConsentMock.mockResolvedValue(true)
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

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/coverletters/cl-1/ai-feedback'),
    )
    // 새 결과가 store 를 통해 다시 렌더됨
    expect(await screen.findByText('AI 티 나는 표현')).toBeInTheDocument()
  })

  it('미동의 — 점검 받기 클릭 → 게이트 차단으로 API 미호출', async () => {
    ensureConsentMock.mockResolvedValue(false)
    postMock.mockResolvedValue(OK_RESPONSE as never)
    render(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))

    await waitFor(() => expect(ensureConsentMock).toHaveBeenCalled())
    expect(postMock).not.toHaveBeenCalled()
  })

  it('동의 — 점검 받기 클릭 → 게이트 통과 후 API 호출', async () => {
    postMock.mockResolvedValue(OK_RESPONSE as never)
    render(<AiFeedbackSection clId="cl-1" />)

    fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/coverletters/cl-1/ai-feedback'),
    )
    expect(ensureConsentMock).toHaveBeenCalled()
  })

  it('재검사 미동의 → clear·재호출 없음', async () => {
    ensureConsentMock.mockResolvedValue(false)
    postMock.mockResolvedValue(OK_RESPONSE as never)
    render(
      <AiFeedbackSection
        clId="cl-1"
        lastFeedback={FEEDBACK}
        lastFeedbackAt={new Date().toISOString()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '↻ 재검사' }))

    await waitFor(() => expect(ensureConsentMock).toHaveBeenCalled())
    expect(postMock).not.toHaveBeenCalled()
  })

  /**
   * D0 (2026-08-01 실사고) — 불완전한 저장 결과로 인한 크래시 방어.
   *
   * 백엔드가 정규화를 시작했지만 **그 이전에 `last_feedback` 에 저장된 불완전한 값이 DB 에 남아 있고**,
   * 재진입 시 그대로 렌더된다. 실제로 `suggestions.length` 에서 TypeError 가 나 페이지가 죽었다.
   *
   * 아래는 "렌더가 죽지 않는다"를 필드별로 고정한다 — 죽으면 render() 가 throw 하므로
   * 별도 expect 없이도 회귀가 잡히지만, 의도를 드러내기 위해 화면 결과까지 확인한다.
   */
  describe('D0 — 불완전한 저장 결과 방어', () => {
    it('🔴 suggestions 가 없어도 크래시하지 않는다 (실제 사고 케이스)', () => {
      const { suggestions: _omitted, ...broken } = FEEDBACK
      render(<AiFeedbackSection clId="cl-1" lastFeedback={broken} lastFeedbackAt={new Date().toISOString()} />)

      // 나머지 결과는 정상 렌더되고, 예시 섹션만 빠진다
      expect(screen.getByText(/정량 근거가 좋아요/)).toBeInTheDocument()
      expect(screen.queryByText('예시 방향 (참고용)')).not.toBeInTheDocument()
    })

    it('issues 가 없어도 크래시하지 않는다', () => {
      const { issues: _omitted, ...broken } = FEEDBACK
      render(<AiFeedbackSection clId="cl-1" lastFeedback={broken} lastFeedbackAt={new Date().toISOString()} />)

      expect(screen.getByText(/정량 근거가 좋아요/)).toBeInTheDocument()
      expect(screen.queryByText('AI 티')).not.toBeInTheDocument()
    })

    it('strengths 가 없어도 크래시하지 않는다', () => {
      const { strengths: _omitted, ...broken } = FEEDBACK
      render(<AiFeedbackSection clId="cl-1" lastFeedback={broken} lastFeedbackAt={new Date().toISOString()} />)

      expect(screen.getByText(/도입부만 다듬으면/)).toBeInTheDocument()
    })

    it('summary 가 없으면 총평 줄 자체를 렌더하지 않는다', () => {
      const { summary: _omitted, ...broken } = FEEDBACK
      render(<AiFeedbackSection clId="cl-1" lastFeedback={broken} lastFeedbackAt={new Date().toISOString()} />)

      expect(screen.queryByText(/💬/)).not.toBeInTheDocument()
      expect(screen.getByText(/정량 근거가 좋아요/)).toBeInTheDocument()
    })

    it('모든 필드가 없는 빈 객체여도 크래시하지 않는다', () => {
      render(<AiFeedbackSection clId="cl-1" lastFeedback={{}} lastFeedbackAt={new Date().toISOString()} />)

      expect(screen.getByRole('button', { name: '↻ 재검사' })).toBeInTheDocument()
    })
  })

  describe('D0 — 출력 잘림 안내', () => {
    it('truncated 응답이면 안내가 뜬다', async () => {
      postMock.mockResolvedValue({
        data: { data: { status: 'ok', feedback: FEEDBACK, truncated: true } },
      } as never)
      render(<AiFeedbackSection clId="cl-1" />)

      fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))

      expect(await screen.findByText(/일부만 나왔어요/)).toBeInTheDocument()
    })

    it('truncated 가 아니면 안내가 없다', async () => {
      postMock.mockResolvedValue({
        data: { data: { status: 'ok', feedback: FEEDBACK, truncated: false } },
      } as never)
      render(<AiFeedbackSection clId="cl-1" />)

      fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))

      await screen.findByText(/도입부만 다듬으면/)
      expect(screen.queryByText(/일부만 나왔어요/)).not.toBeInTheDocument()
    })

    it('저장된 결과(재진입)에는 잘림 안내가 없다 — 플래그가 DB 에 없으므로', () => {
      render(<AiFeedbackSection clId="cl-1" lastFeedback={FEEDBACK} lastFeedbackAt={new Date().toISOString()} />)

      expect(screen.queryByText(/일부만 나왔어요/)).not.toBeInTheDocument()
    })

    /**
     * 이 안내의 목적은 "결과가 전부가 아님을 인지시키는 것"이다. 화면을 못 보는 사용자에게
     * 전달되지 않으면 기능이 목적을 달성하지 못하므로, 시각 표시와 같은 급으로 고정한다.
     * (aria-live 가 로딩 블록에만 있어 결과·경고는 안 읽히던 상태였다 — /uiux 에서 발견)
     */
    it('잘림 안내가 role="status" + aria-live 로 스크린리더에 전달된다', async () => {
      postMock.mockResolvedValue({
        data: { data: { status: 'ok', feedback: FEEDBACK, truncated: true } },
      } as never)
      render(<AiFeedbackSection clId="cl-1" />)

      fireEvent.click(screen.getByRole('button', { name: '점검 받기' }))

      const alert = await screen.findByRole('status')
      expect(alert).toHaveTextContent(/일부만 나왔어요/)
      expect(alert).toHaveAttribute('aria-live', 'polite')
    })
  })
})
