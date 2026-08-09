/**
 * 면접 prep v2 — 질문 카드의 `AI 도움` 답변 생성 UI.
 *
 * v2 에서 답변은 세션 생성 시 만들어지지 않는다. 그래서 **답변이 비어 있는 게 정상 상태**이고,
 * 사용자가 눌러야 채워진다. 아래 4상태가 다 돌아야 기능이 성립한다.
 *
 * 시나리오:
 * 1. 답변 없음 → `AI 도움` 버튼 + 안내 문구
 * 2. 미동의 → 사전 게이트에서 막고 **API 미호출** (코인·쿼터 소모 방지)
 * 3. 성공 → 질문 목록 invalidate (답변은 refetch 로 들어온다)
 * 4. blocked(코인 부족·장애) → **서버 reason 을 그대로** 카드에 남기고 `다시 시도` 노출
 * 5. 쿼터 사전 차단 → 버튼 disabled + 사유 title
 * 6. 답변 있음 → 본문 + `↻ 다시 생성` (재차감 안내 title)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewQuestionCard } from './InterviewQuestionCard'
import { apiClient } from '@/api/client'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import { MIN_PROBEABLE_ANSWER_CHARS } from '@/types/interviewPrep'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/hooks/useMyAiQuotas', () => ({
  useMyAiQuota: vi.fn(() => undefined),
  useAiQuotaBlocked: vi.fn(() => ({ blocked: false, reason: null })),
}))
const { ensureConsentMock } = vi.hoisted(() => ({
  ensureConsentMock: vi.fn(async () => true),
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({
  useRequireAiConsent: () => ensureConsentMock,
}))

const postMock = vi.mocked(apiClient.post)
const blockedMock = vi.mocked(useAiQuotaBlocked)

const makeQuestion = (
  overrides: Partial<InterviewPrepQuestion> = {},
): InterviewPrepQuestion =>
  ({
    id: 'q-1',
    sessionId: 'sess-1',
    parentQuestionId: null,
    depth: 0,
    orderIndex: 0,
    category: 'self_intro',
    questionText: '자기소개를 해주세요.',
    suggestedAnswer: null,
    sourceLogIds: [],
    myMemo: null,
    mustPrepare: false,
    followupBasis: null,
    children: [],
    ...overrides,
  }) as unknown as InterviewPrepQuestion

function renderCard(question: InterviewPrepQuestion) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <InterviewQuestionCard applicationId="app-1" question={question} sessionId="sess-1" />
    </QueryClientProvider>,
  )
}

describe('InterviewQuestionCard — AI 답변 생성 (v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureConsentMock.mockResolvedValue(true)
    blockedMock.mockReturnValue({ blocked: false, reason: null })
  })

  it('1) 답변이 없으면 AI 도움 버튼과 안내를 보여준다', () => {
    renderCard(makeQuestion())
    expect(screen.getByRole('button', { name: /AI 도움/ })).toBeInTheDocument()
    expect(screen.getByText(/직접 써보고 막히면/)).toBeInTheDocument()
  })

  it('2) 🔴 AI 미동의면 사전 게이트에서 막고 API 를 호출하지 않는다', async () => {
    ensureConsentMock.mockResolvedValue(false)
    renderCard(makeQuestion())

    fireEvent.click(screen.getByRole('button', { name: /AI 도움/ }))
    await waitFor(() => expect(ensureConsentMock).toHaveBeenCalled())
    expect(postMock).not.toHaveBeenCalled()
  })

  it('3) 성공하면 답변 생성 API 를 그 질문 id 로 호출한다', async () => {
    postMock.mockResolvedValue({
      data: { data: { status: 'ok', question: makeQuestion() } },
    } as never)
    renderCard(makeQuestion())

    fireEvent.click(screen.getByRole('button', { name: /AI 도움/ }))
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        '/interview-prep-questions/q-1/answer',
      ),
    )
  })

  /**
   * 🔴 2026-07-23 공고정리 실사고 재발 방지 — 서버가 동의·코인·장애를 구분해 주는데
   * 프론트가 고정 문구로 덮으면 사용자는 이유를 못 보고 막다른 길에 갇힌다.
   */
  it('4) blocked 면 서버 reason 을 그대로 보여주고 다시 시도를 노출한다', async () => {
    postMock.mockResolvedValue({
      data: {
        data: { status: 'blocked', reason: '코인이 부족해요. 충전 후 이용해 주세요.' },
      },
    } as never)
    renderCard(makeQuestion())

    fireEvent.click(screen.getByRole('button', { name: /AI 도움/ }))
    expect(
      await screen.findByText('코인이 부족해요. 충전 후 이용해 주세요.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('5) 쿼터 사전 차단이면 버튼이 비활성이고 사유가 title 에 담긴다', () => {
    blockedMock.mockReturnValue({
      blocked: true,
      reason: '오늘 사용 한도를 넘었어요.',
    })
    renderCard(makeQuestion())

    const btn = screen.getByRole('button', { name: /AI 도움/ })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', '오늘 사용 한도를 넘었어요.')
  })

  it('6) 답변이 있으면 본문과 함께 다시 생성 버튼을 보여준다 (재차감 안내 포함)', () => {
    renderCard(
      makeQuestion({ suggestedAnswer: '저는 백엔드 개발자입니다.' }),
    )

    expect(screen.getByText('저는 백엔드 개발자입니다.')).toBeInTheDocument()
    const regen = screen.getByRole('button', { name: /다시 생성/ })
    expect(regen).toHaveAttribute('title', expect.stringContaining('코인'))
    expect(
      screen.queryByRole('button', { name: /AI 도움/ }),
    ).not.toBeInTheDocument()
  })

  /**
   * 접었다 펼치기 (2026-08-07) — 답변은 보통 5~10줄이라 여러 문항에 쌓이면
   * **주인공인 "내 답변"** 가 스크롤 밖으로 밀린다. 기본은 펼침이고, 접는 건 선택.
   */
  it('7) AI 답변을 접었다 펼칠 수 있다 (기본 펼침)', () => {
    renderCard(makeQuestion({ suggestedAnswer: '저는 백엔드 개발자입니다.' }))
    expect(screen.getByText('저는 백엔드 개발자입니다.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /AI 예상 답변/ }))
    expect(
      screen.queryByText('저는 백엔드 개발자입니다.'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /AI 예상 답변/ }))
    expect(screen.getByText('저는 백엔드 개발자입니다.')).toBeInTheDocument()
  })

  it('접어도 "다시 생성" 은 계속 눌 수 있다 — 접힘이 기능을 막지 않는다', () => {
    renderCard(makeQuestion({ suggestedAnswer: '저는 백엔드 개발자입니다.' }))
    fireEvent.click(screen.getByRole('button', { name: /AI 예상 답변/ }))
    expect(
      screen.getByRole('button', { name: /다시 생성/ }),
    ).toBeInTheDocument()
  })
})

/**
 * A+B (2026-08-07) — 꼬리질문의 **시점 안내**와 **근거 배지**.
 *
 * 🔴 답변이 없으면 꼬리질문은 "질문 심화" 로만 나온다 — 실제 면접의 꼬리질문과 가장 먼
 * 형태다. 막지 않되 순서를 알려주는 게 목적이라, 안내가 조건대로 뜨고 사라져야 한다.
 */
describe('InterviewQuestionCard — 꼬리질문 안내·근거', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureConsentMock.mockResolvedValue(true)
    blockedMock.mockReturnValue({ blocked: false, reason: null })
  })

  it('답변·메모가 없으면 "답변을 적고 누르면" 안내가 보인다', () => {
    renderCard(makeQuestion())
    expect(screen.getByText(/답변을 적고 누르면/)).toBeInTheDocument()
  })

  it('AI 답변이 충분히 길면 안내가 사라진다', () => {
    renderCard(makeQuestion({ suggestedAnswer: '가'.repeat(30) }))
    expect(screen.queryByText(/답변을 적고 누르면/)).not.toBeInTheDocument()
  })

  it('내 메모가 충분히 길면 안내가 사라진다', () => {
    renderCard(makeQuestion({ myMemo: '가'.repeat(30) }))
    expect(screen.queryByText(/답변을 적고 누르면/)).not.toBeInTheDocument()
  })

  it('🔴 메모를 지금 입력해도 즉시 사라진다 — 저장 전 상태를 본다', () => {
    renderCard(makeQuestion())
    const ta = screen.getByPlaceholderText(/어떻게 답할지/)
    fireEvent.change(ta, { target: { value: '가'.repeat(30) } })
    expect(screen.queryByText(/답변을 적고 누르면/)).not.toBeInTheDocument()
  })

  /**
   * 🔴 `ㅏ` 한 글자에 안내가 사라지면 "이제 됐구나" 로 읽힌다. 실제로는 서버가
   *    질문 심화로 내려가므로, **화면과 서버 판정이 같아야** 한다.
   */
  it.each(['ㅏ', '음', '네', '가'.repeat(19)])(
    '너무 짧은 메모(%s)에는 안내가 그대로 남는다',
    (short) => {
      renderCard(makeQuestion())
      const ta = screen.getByPlaceholderText(/어떻게 답할지/)
      fireEvent.change(ta, { target: { value: short } })
      expect(screen.getByText(/답변을 적고 누르면/)).toBeInTheDocument()
    },
  )

  it('경계 — 정확히 최소 길이면 안내가 사라진다', () => {
    renderCard(makeQuestion())
    const ta = screen.getByPlaceholderText(/어떻게 답할지/)
    fireEvent.change(ta, {
      target: { value: '가'.repeat(MIN_PROBEABLE_ANSWER_CHARS) },
    })
    expect(screen.queryByText(/답변을 적고 누르면/)).not.toBeInTheDocument()
  })

  it('짧은 AI 답변도 답변으로 치지 않는다', () => {
    renderCard(makeQuestion({ suggestedAnswer: '네.' }))
    expect(screen.getByText(/답변을 적고 누르면/)).toBeInTheDocument()
  })

  it.each([
    ['my_memo', '내 답변 기반'],
    ['ai_answer', 'AI 답변 기반'],
    ['question', '질문 심화'],
  ])('꼬리질문 근거 %s → "%s" 배지', (basis, label) => {
    renderCard(
      makeQuestion({
        depth: 1,
        followupBasis: basis as 'my_memo',
      }),
    )
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('메인 질문(근거 null)에는 배지가 없다', () => {
    renderCard(makeQuestion())
    expect(screen.queryByText('질문 심화')).not.toBeInTheDocument()
  })
})
