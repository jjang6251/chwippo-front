/**
 * 질문 은행 D2b — 질문 카드의 **⭐ 토글 · 인라인 편집 · 삭제 · ↻ 낱개 교체.**
 *
 * 시나리오 매트릭스:
 *
 * ⭐ 토글 (모든 질문 — AI 가 고른 우선순위를 내가 고쳐 잡는다)
 *   1. 꺼짐 → 누르면 `{ mustPrepare: true }` PATCH
 *   2. 켜짐 → 누르면 `{ mustPrepare: false }` PATCH (`||` 였으면 못 끈다)
 *   3. 🔴 readOnly + 켜짐 → 정적 배지, 버튼 아님 (면접 직전에 잘못 눌러 꺼지지 않게)
 *   4. 🔴 readOnly + 꺼짐 → 아예 안 보인다 (현행 유지)
 *
 * ✏️ 인라인 편집 (연필은 전 질문 — 다만 **AI 는 유형만** 열린다)
 *   5. user 질문 → 연필 노출 (`질문 수정`)
 *   6. 🔴 AI 질문 → 연필 노출되지만 이름이 `유형 수정` 이다 (열리는 게 다르니 이름도 다르다)
 *   7. readOnly → 둘 다 연필 없음
 *   8. user 저장 → `{ questionText, category }` PATCH · 성공 토스트 없이 조용히 닫힘
 *   9. trim 후 빈 값 → 저장 disabled (user 한정 — AI 는 본문 입력 자체가 없다)
 *   9b. 🔴 AI 편집 → textarea 없음 + 안내 문구 + 질문은 글로 남는다
 *   9c. 🔴 AI 저장 → body 에 `questionText` **키 자체가 없다** · `category` 는 있다
 *       (서버는 키 유무만 보고 400 을 던지고, 그 던짐이 `category` 저장까지 막는다)
 *   9d. AI → 미분류로 되돌리기 = `{ category: null }`
 *   9e. 🔴 더보기 뒤(TAIL) 유형이 붙어 있어도 접힌 칩 줄에 남고 눌려 있다
 *
 * 🔴 유형 입력은 select 가 아니라 **칩 줄**(`CategoryChipPicker`)이다 — 추가 폼과 같은
 *   컴포넌트다. 그래서 단언도 `change(select)` 가 아니라 **칩 클릭**이다.
 *
 * 🗑 삭제 (모든 질문)
 *  10. 내용 없음 → 확인 없이 즉시 DELETE + 토스트
 *  11. 꼬리질문 있음 → 확인 모달에 "꼬리질문 N개" (자손 재귀 카운트)
 *  12. 내 답변 있음 → 확인 모달에 "작성한 답변도 사라져요"
 *  13. readOnly → 휴지통 없음
 *
 * ↻ 낱개 교체 (source='ai' && depth===0 전용)
 *  14. AI 메인 → 노출
 *  15. 🔴 내 질문 → 없음 (교체가 아니라 수정·삭제가 맞는 동작이다)
 *  16. 🔴 꼬리질문 → 없음 (부모 맥락에서 나온 것이라 "같은 자리에 새로" 가 성립 안 함)
 *  17. 🔴 409 GENERATION_IN_PROGRESS → 전용 안내 (인터셉터가 409 를 토스트하지 않는다)
 *  18. 🔴 status:'blocked' → **서버 reason 그대로** (고정 문구가 진짜 이유를 덮지 않게)
 *  19. readOnly → 없음
 *
 * 🚪 자소서 게이트 (백엔드가 면접 AI 4경로에 같은 게이트를 달았다 — 2026-08-11)
 *  21. 🔴 ↻ NEED_COVERLETTER → 토스트가 아니라 **모달** (토스트는 길까지 데리고 사라진다)
 *  22. 🔴 답변 NEED_COVERLETTER → 모달 + 인라인 `다시 시도` 없음 (재시도가 답이 아니다)
 *  23. 🔴 꼬리질문 NEED_COVERLETTER → 모달
 *  24. 🔴 code 없는 blocked(쿼터·장애)는 **기존 UI 그대로** — 모달이 뜨면 안 된다
 *
 * 🔁 다시 볼 것 배지 (D3 — 연습 결과가 목록으로 이어진다)
 *  26. `lastPracticeResult === 'again'` → 배지가 뜬다
 *  27. good·soso·미연습 → 안 뜬다 (「다시」만이다)
 *  28. 🔴 꼬리질문(depth>0)에는 안 뜬다 — 연습 루프가 메인만 돌아 값이 쌓이지 않는다
 *  29. 읽기 모드에도 남는다 — 면접 직전에 가장 필요한 표시다
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewQuestionCard } from './InterviewQuestionCard'
import { apiClient } from '@/api/client'
import { toast } from '@/stores/toastStore'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/hooks/useMyAiQuotas', () => ({
  useMyAiQuota: vi.fn(() => undefined),
  useAiQuotaBlocked: vi.fn(() => ({ blocked: false, reason: null })),
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({
  useRequireAiConsent: () => vi.fn(async () => true),
}))

const postMock = vi.mocked(apiClient.post)
const patchMock = vi.mocked(apiClient.patch)
const deleteMock = vi.mocked(apiClient.delete)

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
    materialGap: null,
    sourceLogIds: [],
    myMemo: null,
    mustPrepare: false,
    followupBasis: null,
    source: 'ai',
    lastPracticedAt: null,
    lastPracticeResult: null,
    children: [],
    ...overrides,
  }) as unknown as InterviewPrepQuestion

function renderCard(question: InterviewPrepQuestion, readOnly = false) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      {/* 자소서 게이트 모달의 CTA 가 라우터를 쓴다 — 막혔을 때만 마운트되지만 감싸 둔다 */}
      <MemoryRouter>
        <InterviewQuestionCard
          applicationId="app-1"
          question={question}
          sessionId="sess-1"
          readOnly={readOnly}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const starButton = () =>
  screen.queryByRole('button', { name: /우선 준비 표시/ })

/**
 * 편집 모드의 **유형 칩 줄** (`CategoryChipPicker`) — select 를 걷어낸 자리다.
 * 카드 헤더의 유형 **배지**도 같은 라벨 텍스트를 갖지만 그건 `<span>` 이라,
 * 칩 조회는 이 group 안으로 좁혀서 섞이지 않게 한다.
 */
const catGroup = () => screen.getByRole('group', { name: '질문 유형' })
const catChip = (name: string) =>
  within(catGroup()).getByRole('button', { name })

beforeEach(() => {
  vi.clearAllMocks()
  patchMock.mockResolvedValue({ data: { data: {} } } as never)
  deleteMock.mockResolvedValue({ data: { data: null } } as never)
})

describe('⭐ 우선 준비 토글', () => {
  it('1) 꺼짐 → 누르면 mustPrepare:true 로 PATCH', async () => {
    renderCard(makeQuestion({ mustPrepare: false }))
    fireEvent.click(screen.getByRole('button', { name: '우선 준비 표시 켜기' }))
    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('/interview-prep-questions/q-1', {
        mustPrepare: true,
      }),
    )
  })

  /** 🔴 `??` 가 아니라 `||` 로 병합하면 여기서 false 가 삼켜져 ⭐ 가 안 꺼진다 */
  it('2) 켜짐 → 누르면 mustPrepare:false 로 PATCH', async () => {
    renderCard(makeQuestion({ mustPrepare: true }))
    fireEvent.click(screen.getByRole('button', { name: '우선 준비 표시 끄기' }))
    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('/interview-prep-questions/q-1', {
        mustPrepare: false,
      }),
    )
  })

  it('3) 🔴 읽기 모드 + 켜짐 → 정적 배지 (토글 버튼이 아니다)', () => {
    renderCard(makeQuestion({ mustPrepare: true }), true)
    expect(screen.getByText('우선')).toBeInTheDocument()
    expect(starButton()).toBeNull()
  })

  it('4) 🔴 읽기 모드 + 꺼짐 → 배지 자체가 없다', () => {
    renderCard(makeQuestion({ mustPrepare: false }), true)
    expect(screen.queryByText('우선')).toBeNull()
  })
})

/**
 * 🔁 **연습에서 「다시」로 찍은 질문**. 이 배지가 없으면 연습 결과는 연습 화면 안에만
 * 남고, 정작 답을 고쳐 쓰는 자리(이 카드)에서는 보이지 않는다.
 */
describe('🔁 다시 볼 것 배지', () => {
  const badge = () => screen.queryByText('🔁 다시 볼 것')

  it('26) again 이면 배지가 뜬다', () => {
    renderCard(makeQuestion({ lastPracticeResult: 'again' }))
    expect(badge()).toBeInTheDocument()
    expect(badge()?.className).toContain('text-danger')
  })

  it('27) good·soso·미연습에는 안 뜬다', () => {
    const { unmount } = renderCard(makeQuestion({ lastPracticeResult: 'good' }))
    expect(badge()).toBeNull()
    unmount()

    const second = renderCard(makeQuestion({ lastPracticeResult: 'soso' }))
    expect(badge()).toBeNull()
    second.unmount()

    renderCard(makeQuestion({ lastPracticeResult: null }))
    expect(badge()).toBeNull()
  })

  /** 연습 루프는 메인 질문만 돈다 — 꼬리에 이 값이 있으면 그게 데이터 사고다 */
  it('28) 🔴 꼬리질문에는 안 뜬다', () => {
    renderCard(makeQuestion({ depth: 1, lastPracticeResult: 'again' }))
    expect(badge()).toBeNull()
  })

  it('29) 읽기 모드에도 남는다', () => {
    renderCard(makeQuestion({ lastPracticeResult: 'again' }), true)
    expect(badge()).toBeInTheDocument()
  })
})

describe('✏️ 인라인 편집 (연필은 전 질문 · AI 는 유형만)', () => {
  it('5) 내 질문 → 연필이 보인다', () => {
    renderCard(makeQuestion({ source: 'user' }))
    expect(screen.getByRole('button', { name: '질문 수정' })).toBeInTheDocument()
  })

  /**
   * 🔴 **의도가 뒤집힌 단언이다** (2026-08-12). 예전엔 "AI 질문엔 연필이 없다" 가 계약이었다.
   * 그 문은 본문 수정만이 아니라 **유형 수정까지** 닫고 있었고, 그래서 AI 가 유형을
   * 애매하게 붙이면 흐름 정렬과 유형 필터가 어긋난 채로 굳었다 — 고칠 길이 ↻(코인)·삭제뿐.
   * 이제 연필은 열려 있고, **무엇이 열리는지는 이름이 말한다.**
   */
  it('6) 🔴 AI 질문 → 연필이 「유형 수정」 이름으로 보인다', () => {
    renderCard(makeQuestion({ source: 'ai' }))
    expect(screen.getByRole('button', { name: '유형 수정' })).toBeInTheDocument()
    // 본문까지 여는 이름은 쓰지 않는다 — 눌러 보기 전에 구분돼야 한다
    expect(screen.queryByRole('button', { name: '질문 수정' })).toBeNull()
  })

  it('7) 읽기 모드 → 연필이 없다 (내 질문·AI 질문 둘 다)', () => {
    const { unmount } = renderCard(makeQuestion({ source: 'user' }), true)
    expect(screen.queryByRole('button', { name: '질문 수정' })).toBeNull()
    unmount()

    renderCard(makeQuestion({ source: 'ai' }), true)
    expect(screen.queryByRole('button', { name: '유형 수정' })).toBeNull()
  })

  it('8) 저장 → questionText·category 를 PATCH 하고 조용히 닫힌다', async () => {
    renderCard(makeQuestion({ source: 'user', category: 'self_intro' }))
    fireEvent.click(screen.getByRole('button', { name: '질문 수정' }))

    const textarea = screen.getByLabelText('질문 내용 수정')
    fireEvent.change(textarea, { target: { value: '  고친 질문입니다  ' } })
    fireEvent.click(catChip('지원동기'))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('/interview-prep-questions/q-1', {
        questionText: '고친 질문입니다',
        category: 'motivation',
      }),
    )
    // 편집 영역이 닫힌다 — 자동 저장되는 메모와 톤을 맞춰 성공 토스트는 없다
    await waitFor(() => expect(screen.queryByLabelText('질문 내용 수정')).toBeNull())
    expect(toast.show).not.toHaveBeenCalled()
  })

  it('9) trim 후 빈 값이면 저장할 수 없다', () => {
    renderCard(makeQuestion({ source: 'user' }))
    fireEvent.click(screen.getByRole('button', { name: '질문 수정' }))
    fireEvent.change(screen.getByLabelText('질문 내용 수정'), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('9b) 🔴 AI 편집 → 본문 입력칸이 없고, 질문은 글로 남고, 대안을 안내한다', () => {
    renderCard(makeQuestion({ source: 'ai' }))
    fireEvent.click(screen.getByRole('button', { name: '유형 수정' }))

    expect(screen.queryByLabelText('질문 내용 수정')).toBeNull()
    // 유형은 고를 수 있다 (이 편집이 여는 유일한 것)
    expect(catGroup()).toBeInTheDocument()
    expect(catChip('지원동기')).toBeInTheDocument()
    // 무엇을 분류하는 중인지 화면에서 사라지지 않는다
    expect(screen.getByText('자기소개를 해주세요.')).toBeInTheDocument()
    // 막다른 길이 아니라는 걸 문구가 말한다 — 내용을 바꾸려면 ↻·삭제
    expect(
      screen.getByText(/내용을 바꾸려면 ↻ 또는 삭제/),
    ).toBeInTheDocument()
  })

  /**
   * 🔴 이 테스트의 핵심은 값이 아니라 **키의 유무**다. 서버는 `questionText` 가
   * `undefined` 가 아니기만 하면 400 을 던지고, 그 던짐이 저장보다 먼저라
   * **같이 보낸 `category` 까지 통째로 날아간다** (부분 반영 없음). 그래서
   * `toHaveBeenCalledWith({ category })` 로는 부족하다 — 그 단언은
   * `{ questionText: undefined, category }` 도 통과시킨다. 키 목록을 직접 본다.
   */
  it('9c) 🔴 AI 저장 → body 에 questionText 키가 아예 없다', async () => {
    renderCard(makeQuestion({ source: 'ai', category: 'self_intro' }))
    fireEvent.click(screen.getByRole('button', { name: '유형 수정' }))
    fireEvent.click(catChip('지원동기'))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(patchMock).toHaveBeenCalled())
    const [url, body] = patchMock.mock.calls[0]
    expect(url).toBe('/interview-prep-questions/q-1')
    expect(Object.keys(body as Record<string, unknown>)).toEqual(['category'])
    expect(body).toEqual({ category: 'motivation' })

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: '질문 유형' })).toBeNull(),
    )
  })

  it('9d) AI → 미분류로 되돌리면 category:null 을 보낸다', async () => {
    renderCard(makeQuestion({ source: 'ai', category: 'self_intro' }))
    fireEvent.click(screen.getByRole('button', { name: '유형 수정' }))
    fireEvent.click(catChip('미분류'))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('/interview-prep-questions/q-1', {
        category: null,
      }),
    )
    expect(Object.keys(patchMock.mock.calls[0][1] as Record<string, unknown>)).toEqual([
      'category',
    ])
  })

  /**
   * 🔴 **이 카드가 「접힘 유지」 동작의 주 소비처다.** 칩 피커는 기본 9종만 펴는데,
   * AI 가 붙인 유형은 그 밖일 때가 많다 (직무 fork·컬처핏·인성 등). 고른 칩을 접힘
   * 상태에서 안 남기면 화면엔 아무것도 안 눌린 것처럼 보이는데 저장하면 원래 유형이
   * 그대로 나간다 — 「무엇에서 무엇으로 바꾸는가」가 화면에서 사라진다.
   */
  it('9e) 🔴 더보기 뒤 유형이 붙어 있어도 접힌 채로 보이고 눌려 있다', () => {
    renderCard(makeQuestion({ source: 'ai', category: 'personality' }))
    fireEvent.click(screen.getByRole('button', { name: '유형 수정' }))

    // 아직 [더보기] 를 펴지 않은 상태다
    expect(
      within(catGroup()).getByRole('button', { name: /더보기$/ }),
    ).toBeInTheDocument()
    // 그런데도 현재 유형 칩은 있고, 눌려 있다
    expect(catChip('인성·장단점')).toHaveAttribute('aria-pressed', 'true')
    // "안 보이니까 미분류" 로 읽히면 안 된다
    expect(catChip('미분류')).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('🗑 질문 삭제', () => {
  it('10) 내용이 없으면 확인 없이 바로 지운다', async () => {
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: '질문 삭제' }))
    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('/interview-prep-questions/q-1'),
    )
    expect(toast.show).toHaveBeenCalledWith('질문을 삭제했어요.')
  })

  /** 자손은 **재귀**로 센다 — 꼬리의 꼬리까지 CASCADE 로 사라진다 */
  it('11) 꼬리질문이 있으면 확인 모달이 개수를 말한다 (재꼬리 포함)', () => {
    const question = makeQuestion({
      children: [
        makeQuestion({
          id: 'q-2',
          depth: 1,
          children: [makeQuestion({ id: 'q-3', depth: 2 })],
        }),
      ] as InterviewPrepQuestion[],
    })
    renderCard(question)
    // 자식 카드도 자기 휴지통을 그린다 — 맨 앞이 뿌리 질문의 것이다
    fireEvent.click(screen.getAllByRole('button', { name: '질문 삭제' })[0])
    expect(screen.getByText(/꼬리질문 2개가 함께 삭제돼요/)).toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('12) 내 답변이 있으면 확인 모달이 답변 소실을 말한다', () => {
    renderCard(makeQuestion({ myMemo: '제 강점은…' }))
    fireEvent.click(screen.getByRole('button', { name: '질문 삭제' }))
    expect(screen.getByText(/작성한 답변도 사라져요/)).toBeInTheDocument()
  })

  it('13) 읽기 모드 → 휴지통이 없다', () => {
    renderCard(makeQuestion(), true)
    expect(screen.queryByRole('button', { name: '질문 삭제' })).toBeNull()
  })
})

describe('↻ 낱개 교체', () => {
  const regenButton = () =>
    screen.queryByRole('button', { name: '새 질문으로 교체' })

  it('14) AI 메인 질문에는 보인다', () => {
    renderCard(makeQuestion({ source: 'ai', depth: 0 }))
    expect(regenButton()).toBeInTheDocument()
  })

  it('15) 🔴 내가 적은 질문에는 없다', () => {
    renderCard(makeQuestion({ source: 'user', depth: 0 }))
    expect(regenButton()).toBeNull()
  })

  it('16) 🔴 꼬리질문에는 없다', () => {
    renderCard(makeQuestion({ source: 'ai', depth: 1 }))
    expect(regenButton()).toBeNull()
  })

  it('19) 읽기 모드 → 없다', () => {
    renderCard(makeQuestion({ source: 'ai', depth: 0 }), true)
    expect(regenButton()).toBeNull()
  })

  /**
   * 🔴 인터셉터는 **400 만** 토스트한다 (`client.ts`). 409 를 여기서 말하지 않으면
   * 아무 일도 안 일어난 것처럼 보여 사용자가 계속 누른다.
   */
  it('17) 🔴 409 GENERATION_IN_PROGRESS → 진행 중 안내를 띄운다', async () => {
    postMock.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'GENERATION_IN_PROGRESS', message: '지금 만들고 있어요.' },
      },
    })
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: '새 질문으로 교체' }))
    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        '지금 다른 생성이 진행 중이에요. 끝나면 다시 시도해 주세요.',
      ),
    )
  })

  /**
   * 서버가 구분해 준 사유(코인 부족·동의·장애)를 고정 문구로 덮지 않는다.
   *
   * 🔴 **자소서 없음(`code: 'NEED_COVERLETTER'`)은 여기 오지 않는다** — 그건 아래
   * 「자소서 게이트」에서 모달로 갈라진다. 그래서 이 케이스는 **코드 없는 blocked** 다.
   */
  it('18) 🔴 blocked 응답 → 서버 reason 을 그대로 보여준다', async () => {
    postMock.mockResolvedValue({
      data: {
        data: {
          status: 'blocked',
          reason: '코인이 부족해요. 충전 후 이용해 주세요.',
        },
      },
    } as never)
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: '새 질문으로 교체' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '코인이 부족해요. 충전 후 이용해 주세요.',
      ),
    )
  })

  it('20) 진행 중에는 다시 누를 수 없다', async () => {
    postMock.mockImplementation(() => new Promise(() => {}))
    renderCard(makeQuestion())
    const btn = screen.getByRole('button', { name: '새 질문으로 교체' })
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
  })
})

/**
 * 🚪 **자소서 게이트** — 백엔드가 면접 AI 4경로(생성·↻·답변·꼬리)에 같은 게이트를 달았다.
 *
 * 이 카드가 쥔 3경로에서 필요한 건 "실패했어요" 가 아니라 **자소서를 쓰러 가는 길**이다.
 * 토스트는 몇 초 뒤 사라지면서 그 길까지 가져가고, 답변의 인라인 `다시 시도` 는 같은 벽에
 * 다시 부딪히게 한다. 그래서 이 사유만 모달로 갈라진다.
 *
 * 🔴 **다른 blocked(쿼터·코인·장애)까지 모달로 끌고 가면 안 된다** — 그건 재시도가 답이라
 * 기존 UI 가 맞다. 그래서 각 경로마다 "모달로 가는 것" 과 "안 가는 것" 을 짝으로 잠근다.
 */
describe('🚪 자소서 게이트 — 3경로 공통 모달', () => {
  const REASON = '자소서가 있어야 AI 질문을 만들 수 있어요.'
  const blockedNeedCl = {
    data: { data: { status: 'blocked', code: 'NEED_COVERLETTER', reason: REASON } },
  }
  /** 코드 없는 차단 — 서버가 `reason` 만 준다 (쿼터·코인·장애) */
  const blockedPlain = {
    data: { data: { status: 'blocked', reason: '오늘 사용 한도를 넘었어요.' } },
  }

  const gateModal = () =>
    screen.queryByRole('button', { name: /자소서 쓰러 가기/ })

  it('21) 🔴 ↻ NEED_COVERLETTER → 토스트가 아니라 모달', async () => {
    postMock.mockResolvedValue(blockedNeedCl as never)
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: '새 질문으로 교체' }))

    expect(await screen.findByText(REASON)).toBeInTheDocument()
    expect(gateModal()).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('22) 🔴 답변 NEED_COVERLETTER → 모달 (인라인 `다시 시도` 로 새지 않는다)', async () => {
    postMock.mockResolvedValue(blockedNeedCl as never)
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: /AI 도움/ }))

    expect(await screen.findByText(REASON)).toBeInTheDocument()
    expect(gateModal()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
  })

  it('23) 🔴 꼬리질문 NEED_COVERLETTER → 모달', async () => {
    postMock.mockResolvedValue(blockedNeedCl as never)
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: /꼬리질문 추가/ }))

    expect(await screen.findByText(REASON)).toBeInTheDocument()
    expect(gateModal()).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('24a) 🔴 답변 — 코드 없는 blocked 는 인라인 에러 그대로 (모달 없음)', async () => {
    postMock.mockResolvedValue(blockedPlain as never)
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: /AI 도움/ }))

    expect(await screen.findByText('오늘 사용 한도를 넘었어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(gateModal()).toBeNull()
  })

  it('24b) 🔴 꼬리질문 — 코드 없는 blocked 는 토스트 그대로 (모달 없음)', async () => {
    postMock.mockResolvedValue(blockedPlain as never)
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: /꼬리질문 추가/ }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('오늘 사용 한도를 넘었어요.'),
    )
    expect(gateModal()).toBeNull()
  })

  /** 세 경로가 상태 하나를 나눠 쓴다 — 닫으면 카드가 원래 화면으로 돌아와야 한다 */
  it('25) 모달을 닫으면 사라진다', async () => {
    postMock.mockResolvedValue(blockedNeedCl as never)
    renderCard(makeQuestion())
    fireEvent.click(screen.getByRole('button', { name: '새 질문으로 교체' }))
    await screen.findByText(REASON)

    // 공용 `Modal` 헤더의 X 도 접근명이 「닫기」 다 — 본문 ghost 는 마지막 것
    const closeButtons = screen.getAllByRole('button', { name: '닫기' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByText(REASON)).toBeNull())
  })
})
