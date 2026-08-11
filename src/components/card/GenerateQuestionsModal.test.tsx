/**
 * 질문 은행 D2b — **AI 질문 생성 모달.**
 *
 * 이 모달이 하는 일은 "몇 개를, 어떤 유형으로" 를 고르게 하고 **시작 전에 대가를 알리는**
 * 것이다. 그래서 검증할 것도 그 두 축이다 — 고른 값이 서버로 그대로 가는가, 한도·코인을
 * 정직하게 말하는가.
 *
 * 시나리오 매트릭스:
 *
 * 개수 기본값·상한
 *   1. 질문 0개 → 기본 20 (빈 세션은 한 벌이 있어야 준비가 시작된다)
 *   2. 질문 있음 → 기본 10 ("조금 더" 가 보통이다)
 *   3. 🔴 상한 = min(20, 60 − 현재 AI 질문 수) — 55개면 5까지만
 *   4. 🔴 상한이 20 미만이면 남은 개수를 안내한다
 *   5. 🔴 캡 도달(60개) → 시작 버튼 disabled + 한도 안내
 *
 * 카테고리
 *   6. 기본은 전체(''), 고르면 그 값이 body 로 간다
 *
 * 코인 문구 (정보 제공용 — 틀린 숫자를 보여주느니 안 보여준다)
 *   7. 로드 성공 → "약 N코인이 예약" 문구
 *   8. 🔴 로드 실패 → 문구 자체가 없다 (생성은 계속 가능하다)
 *
 * NEED_COVERLETTER
 *   9. 🔴 blocked 되면 토스트가 아니라 **모달 안 안내**로 바뀐다 (서버 문구 그대로)
 *  10. 🔴 안내에서 자소서로 가는 길 + "직접 추가" 보조 문구
 *  11. 게이트 취소(undefined) → 모달이 닫히지 않는다 (다시 시도할 수 있게)
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GenerateQuestionsModal } from './GenerateQuestionsModal'
import { useMyAiCosts } from '@/hooks/useMyAiQuotas'
import type { GenerateSessionResult } from '@/types/interviewPrep'

vi.mock('@/hooks/useMyAiQuotas', () => ({
  useMyAiCosts: vi.fn(),
  useMyAiQuota: vi.fn(() => undefined),
  useMyAiQuotas: vi.fn(() => ({ data: undefined })),
  useAiQuotaBlocked: vi.fn(() => ({ blocked: false, reason: null })),
}))

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

const costsMock = vi.mocked(useMyAiCosts)

/** costs 훅은 React Query 결과 모양만 쓰므로 필요한 필드만 세운다 */
const costsResult = (data: unknown) =>
  ({ data }) as ReturnType<typeof useMyAiCosts>

function renderModal(
  props: Partial<Parameters<typeof GenerateQuestionsModal>[0]> = {},
) {
  const onGenerate = vi.fn(
    async (): Promise<GenerateSessionResult | undefined> => ({
      status: 'ok',
      meta: { mainCount: 10 } as GenerateSessionResult['meta'],
    }),
  )
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GenerateQuestionsModal
          onClose={onClose}
          applicationId="app-1"
          aiQuestionCount={0}
          hasQuestions={false}
          onGenerate={onGenerate}
          generating={false}
          quotaBlocked={false}
          quotaReason={null}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onGenerate, onClose }
}

const slider = () => screen.getByLabelText('만들 질문 수') as HTMLInputElement
const startButton = () => screen.getByRole('button', { name: /생성 시작/ })

beforeEach(() => {
  vi.clearAllMocks()
  costsMock.mockReturnValue(costsResult(undefined))
})

describe('개수 — 기본값과 상한', () => {
  it('1) 질문이 없으면 기본 20개', () => {
    renderModal({ hasQuestions: false, aiQuestionCount: 0 })
    expect(slider().value).toBe('20')
    expect(startButton()).toHaveTextContent('20개 생성 시작')
  })

  it('2) 질문이 있으면 기본 10개', () => {
    renderModal({ hasQuestions: true, aiQuestionCount: 20 })
    expect(slider().value).toBe('10')
  })

  /** 🔴 서버 캡(60)을 넘겨 보내면 깎여 돌아온다 — 고르기 **전에** 알려준다 */
  it('3) 🔴 남은 자리가 20보다 적으면 상한이 그만큼 준다', () => {
    renderModal({ hasQuestions: true, aiQuestionCount: 55 })
    expect(slider().max).toBe('5')
  })

  it('4) 🔴 상한이 줄면 남은 개수를 안내한다', () => {
    renderModal({ hasQuestions: true, aiQuestionCount: 55 })
    expect(screen.getByText(/한도\(60개\)까지 5개 남았어요/)).toBeInTheDocument()
  })

  it('5) 🔴 캡에 도달하면 시작할 수 없다', () => {
    renderModal({ hasQuestions: true, aiQuestionCount: 60 })
    expect(screen.getByText(/한도\(60개\)에 도달했어요/)).toBeInTheDocument()
    expect(startButton()).toBeDisabled()
  })
})

describe('카테고리·개수 전달', () => {
  it('6) 고른 개수와 카테고리가 그대로 서버로 간다', async () => {
    const { onGenerate } = renderModal({ hasQuestions: false })
    fireEvent.change(slider(), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('만들 질문 유형'), {
      target: { value: 'motivation' },
    })
    fireEvent.click(startButton())
    await waitFor(() =>
      expect(onGenerate).toHaveBeenCalledWith({
        count: 7,
        category: 'motivation',
      }),
    )
  })

  it('6b) 유형을 안 고르면 category 는 null (서버가 부족한 유형을 고른다)', async () => {
    const { onGenerate } = renderModal({ hasQuestions: true })
    fireEvent.click(startButton())
    await waitFor(() =>
      expect(onGenerate).toHaveBeenCalledWith({ count: 10, category: null }),
    )
  })
})

describe('코인 문구', () => {
  it('7) 로드 성공 → 예약 코인을 근사로 알린다', () => {
    costsMock.mockReturnValue(
      costsResult({
        feature: 'interview_prep_session',
        chargesCoins: true,
        estimatedCoins: 12,
        countSensitive: false,
      }),
    )
    renderModal()
    expect(screen.getByText(/예약되고, 실제로는 쓴 만큼만/)).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  /** 🔴 정보 제공용이라 실패해도 생성을 막지 않는다 — 문구만 사라진다 */
  it('8) 🔴 로드 실패 → 문구가 없고, 시작 버튼은 살아 있다', () => {
    costsMock.mockReturnValue(costsResult(undefined))
    renderModal()
    expect(screen.queryByText(/예약되고/)).toBeNull()
    expect(startButton()).toBeEnabled()
  })
})

describe('NEED_COVERLETTER 안내 전환', () => {
  const blocked: GenerateSessionResult = {
    status: 'blocked',
    code: 'NEED_COVERLETTER',
    reason:
      '자소서가 있어야 AI 질문을 만들 수 있어요. 지원 카드에 자소서 문항을 먼저 추가해 주세요.',
  }

  it('9) 🔴 서버 문구를 그대로 모달 안에 남긴다 (모달은 닫히지 않는다)', async () => {
    const onGenerate = vi.fn(async () => blocked)
    const onClose = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <GenerateQuestionsModal
            onClose={onClose}
            applicationId="app-1"
            aiQuestionCount={0}
            hasQuestions={false}
            onGenerate={onGenerate}
            generating={false}
            quotaBlocked={false}
            quotaReason={null}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(startButton())
    await waitFor(() =>
      expect(screen.getByText(/자소서가 있어야 AI 질문을/)).toBeInTheDocument(),
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('10) 🔴 자소서로 가는 길 + 직접 추가 보조 문구', async () => {
    const onGenerate = vi.fn(async () => blocked)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <GenerateQuestionsModal
            onClose={vi.fn()}
            applicationId="app-1"
            aiQuestionCount={0}
            hasQuestions={false}
            onGenerate={onGenerate}
            generating={false}
            quotaBlocked={false}
            quotaReason={null}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(startButton())
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /자소서 쓰러 가기/ }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText(/직접 질문은 지금 바로/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /자소서 쓰러 가기/ }))
    expect(navigateMock).toHaveBeenCalledWith('/board/app-1/coverletter')
  })

  /** 동의·직무 게이트를 취소하면 아무 일도 안 일어났다 — 모달을 닫아 버리면 다시 열어야 한다 */
  it('11) 게이트 취소(undefined) → 모달이 닫히지 않는다', async () => {
    const onGenerate = vi.fn(async () => undefined)
    const onClose = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <GenerateQuestionsModal
            onClose={onClose}
            applicationId="app-1"
            aiQuestionCount={0}
            hasQuestions={false}
            onGenerate={onGenerate}
            generating={false}
            quotaBlocked={false}
            quotaReason={null}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(startButton())
    await waitFor(() => expect(onGenerate).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })
})
