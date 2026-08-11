/**
 * 질문 은행 D2 — **내가 직접 적는 질문 폼.**
 *
 * 🔴 이 폼의 값어치는 「한 번 적기」가 아니라 **연달아 적기**다. 면접 직후 복기는 5~10개가
 * 한꺼번에 떠오르는데, 한 개 넣을 때마다 폼이 닫히거나 카테고리가 초기화되면 두 번째에서
 * 그만두게 된다. 그래서 성공 후의 **잔류 상태**를 계약으로 박는다.
 *
 * 시나리오:
 *  A. parsePastedQuestions (순수 함수)
 *   A1. 접두 번호 5변형(`1.` `1)` `-` `•` `Q1.` `Q.`)을 뗀다
 *   A2. 진짜 질문의 숫자(`3년 후…`)는 접두로 오인하지 않는다
 *   A3. 빈 줄·공백 줄은 사라진다
 *   A4. 배치 안 완전 중복(대소문자·공백 무시)은 `duplicate`
 *   A5. 501자는 `too_long` (500자 경계는 통과)
 *   A6. 50개를 넘으면 51번째부터 `over_limit`
 *  B. ✍️ 직접 적기
 *   B1. 빈 값·공백만이면 [추가] 비활성
 *   B2. 성공 → items 1개로 호출 · textarea 만 비고 · 포커스 유지 · 카테고리 보존
 *   B3. isPending 동안 [추가] 잠금 (더블클릭 이중 추가 방지)
 *   B4. 실패 → 토스트 + 입력 보존 (다시 치게 하지 않는다)
 *  C. 📋 붙여넣기
 *   C1. 미리보기에서 개별 제외(체크 해제)가 실제 요청에서 빠진다
 *   C2. 일괄 카테고리가 모든 items 에 실린다
 *   C3. 선택 0개면 버튼 비활성
 *   C4. 성공 → 폼을 닫는다 (연달아 붙여넣는 흐름이 아니다)
 *  D. 📣 성공 알림은 폼이 하지 않는다 (2026-08-11)
 *   D1. 단건 성공 → onAdded(created) · 폼은 토스트하지 않는다
 *   D2. 붙여넣기 성공 → onAdded(created 전부) · 폼은 토스트하지 않는다
 *   D3. 카테고리가 정렬 자리를 정한다는 힌트가 보인다
 *
 * 🔴 D 가 계약인 이유 — 목록은 **면접 진행 순서**로 정렬돼서 새 질문이 맨 끝이 아니라
 * 카테고리의 자리로 들어간다. 「추가했어요」 만으론 어디로 갔는지 알 수 없어서, 번호를
 * 아는 부모(목록)가 위치까지 함께 알린다. 폼이 토스트를 되살리면 이중 토스트가 된다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddInterviewQuestionForm } from './AddInterviewQuestionForm'
import { apiClient } from '@/api/client'
import { toast } from '@/stores/toastStore'
import {
  BULK_MAX_ITEMS,
  QUESTION_MAX_CHARS,
  parsePastedQuestions,
} from '@/utils/interviewQuestionParse'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn() },
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

const postMock = vi.mocked(apiClient.post)
const BULK_URL = '/interview-prep-sessions/sess-1/questions/bulk'

/** 서버 응답 봉투 — `unwrap` 이 `res.data.data` 를 읽는다 */
const created = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `q-${i}`,
    questionText: `질문 ${i}`,
  }))
const okResponse = (count: number) =>
  ({ data: { data: created(count) } }) as never

const onClose = vi.fn()
const onAdded = vi.fn()

function draw() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <AddInterviewQuestionForm
        sessionId="sess-1"
        onClose={onClose}
        onAdded={onAdded}
      />
    </QueryClientProvider>,
  )
}

const goPaste = () =>
  fireEvent.click(screen.getByRole('button', { name: /여러 개 붙여넣기/ }))

describe('A. parsePastedQuestions', () => {
  it.each([
    ['1. 자기소개 해주세요', '자기소개 해주세요'],
    ['1) 자기소개 해주세요', '자기소개 해주세요'],
    ['- 자기소개 해주세요', '자기소개 해주세요'],
    ['• 자기소개 해주세요', '자기소개 해주세요'],
    ['Q1. 자기소개 해주세요', '자기소개 해주세요'],
    ['Q. 자기소개 해주세요', '자기소개 해주세요'],
  ])('A1. 접두 "%s" 를 떼고 본문만 남긴다', (raw, expected) => {
    expect(parsePastedQuestions(raw)).toEqual([
      { text: expected, exclude: null },
    ])
  })

  /** 🔴 접두 판정이 헐거우면 진짜 질문의 첫 글자가 잘려 나간다 — 조용히 틀린 데이터가 된다 */
  it.each(['3년 후 목표는 무엇인가요?', '2026년 계획을 말씀해 주세요'])(
    'A2. 숫자로 시작하는 진짜 질문(%s)은 건드리지 않는다',
    (raw) => {
      expect(parsePastedQuestions(raw)[0].text).toBe(raw)
    },
  )

  it('A3. 빈 줄·공백 줄은 목록에서 사라진다', () => {
    const parsed = parsePastedQuestions('첫 질문\n\n   \n둘째 질문\n')
    expect(parsed.map((p) => p.text)).toEqual(['첫 질문', '둘째 질문'])
  })

  it('A4. 배치 안 완전 중복은 duplicate 로 표시된다 (대소문자·공백 무시)', () => {
    const parsed = parsePastedQuestions('Why Naver?\n why  naver ?\n다른 질문')
    expect(parsed[0].exclude).toBeNull()
    expect(parsed[1].exclude).toBe('duplicate')
    expect(parsed[2].exclude).toBeNull()
  })

  it('A5. 경계 — 500자는 통과하고 501자는 too_long', () => {
    const ok = '가'.repeat(QUESTION_MAX_CHARS)
    const over = '나'.repeat(QUESTION_MAX_CHARS + 1)
    const parsed = parsePastedQuestions(`${ok}\n${over}`)
    expect(parsed[0].exclude).toBeNull()
    expect(parsed[1].exclude).toBe('too_long')
  })

  it('A6. 50개를 넘으면 51번째부터 over_limit', () => {
    const raw = Array.from(
      { length: BULK_MAX_ITEMS + 3 },
      (_, i) => `질문 ${i + 1}`,
    ).join('\n')
    const parsed = parsePastedQuestions(raw)
    expect(parsed.filter((p) => p.exclude === null)).toHaveLength(BULK_MAX_ITEMS)
    expect(parsed.filter((p) => p.exclude === 'over_limit')).toHaveLength(3)
    expect(parsed[BULK_MAX_ITEMS - 1].exclude).toBeNull()
    expect(parsed[BULK_MAX_ITEMS].exclude).toBe('over_limit')
  })
})

describe('B. ✍️ 직접 적기', () => {
  beforeEach(() => vi.clearAllMocks())

  it('B1. 빈 값·공백만이면 [추가] 가 비활성이다', () => {
    draw()
    const btn = screen.getByRole('button', { name: '추가' })
    expect(btn).toBeDisabled()

    fireEvent.change(screen.getByLabelText('질문 내용'), {
      target: { value: '   ' },
    })
    expect(btn).toBeDisabled()
  })

  it('B2. 🔴 성공하면 입력만 비우고 카테고리·포커스는 유지한다', async () => {
    postMock.mockResolvedValue(okResponse(1))
    draw()

    const ta = screen.getByLabelText('질문 내용') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: '  1분 자기소개 해주세요  ' } })
    fireEvent.click(screen.getByRole('button', { name: '자기소개' }))
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(BULK_URL, {
        items: [{ questionText: '1분 자기소개 해주세요', category: 'self_intro' }],
      }),
    )
    await waitFor(() => expect(ta.value).toBe(''))
    expect(document.activeElement).toBe(ta)
    // 고른 칩은 눌린 채 남는다 — 다음 질문도 같은 유형인 경우가 대부분이다
    expect(screen.getByRole('button', { name: '자기소개' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // 폼은 열린 채다 — 연달아 적는 흐름
    expect(onClose).not.toHaveBeenCalled()
  })

  it('미분류(기본)면 category 는 null 로 나간다', async () => {
    postMock.mockResolvedValue(okResponse(1))
    draw()
    fireEvent.change(screen.getByLabelText('질문 내용'), {
      target: { value: '왜 우리 회사인가요?' },
    })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(BULK_URL, {
        items: [{ questionText: '왜 우리 회사인가요?', category: null }],
      }),
    )
  })

  it('B3. 🔴 요청 중에는 버튼이 잠긴다 (더블클릭 이중 추가 방지)', async () => {
    postMock.mockReturnValue(new Promise(() => {}) as never)
    draw()
    fireEvent.change(screen.getByLabelText('질문 내용'), {
      target: { value: '압박 질문 받아본 적 있나요?' },
    })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    const btn = await screen.findByRole('button', { name: '추가 중…' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(postMock).toHaveBeenCalledTimes(1)
  })

  it('B4. 🔴 실패하면 토스트를 띄우고 입력은 그대로 남긴다', async () => {
    postMock.mockRejectedValue(new Error('boom'))
    draw()
    const ta = screen.getByLabelText('질문 내용') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: '가장 힘들었던 경험은?' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('질문 추가에 실패했어요.'),
    )
    expect(ta.value).toBe('가장 힘들었던 경험은?')
  })

  /**
   * 🔴 서버가 이미 이유를 말했으면 고정 문구로 덮지 않는다 (/qa 2026-08-11).
   * 400 서버 메시지는 인터셉터가 토스트하고 `_toastShown` 을 세운다 — 폼이 또 띄우면
   * "한 세션에는 100개까지…" 같은 진짜 이유가 generic 문구에 밀려난다.
   */
  it('B5. 🔴 인터셉터가 이미 토스트했으면(400 서버 문구) 고정 문구를 덧띄우지 않는다', async () => {
    const err = Object.assign(new Error('한 세션에는 직접 질문을 100개까지 담을 수 있어요.'), {
      config: { _toastShown: true },
    })
    postMock.mockRejectedValue(err)
    draw()
    const ta = screen.getByLabelText('질문 내용') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: '가장 힘들었던 경험은?' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    // 실패 처리(입력 보존)가 끝날 때까지 기다린 뒤, 폼 쪽 토스트가 0회인지 본다
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(ta.value).toBe('가장 힘들었던 경험은?')
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('C. 📋 여러 개 붙여넣기', () => {
  beforeEach(() => vi.clearAllMocks())

  const paste = (value: string) => {
    goPaste()
    fireEvent.change(screen.getByLabelText('붙여넣을 질문 목록'), {
      target: { value },
    })
  }

  it('C1. 🔴 체크를 끈 줄은 요청에서 빠진다', async () => {
    postMock.mockResolvedValue(okResponse(2))
    draw()
    paste('1. 첫 질문\n2. 둘째 질문\n3. 셋째 질문')

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    fireEvent.click(boxes[1]) // 둘째 질문 제외

    fireEvent.click(screen.getByRole('button', { name: '2개 추가' }))
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(BULK_URL, {
        items: [
          { questionText: '첫 질문', category: null },
          { questionText: '셋째 질문', category: null },
        ],
      }),
    )
  })

  /** 기본 노출에 없는 유형이라 [더보기] 를 편 뒤에 고른다 — 붙여넣기도 같은 피커다 */
  it('C2. 일괄 카테고리가 모든 items 에 실린다', async () => {
    postMock.mockResolvedValue(okResponse(2))
    draw()
    paste('첫 질문\n둘째 질문')
    fireEvent.click(screen.getByRole('button', { name: /종 더보기$/ }))
    fireEvent.click(screen.getByRole('button', { name: '인성·장단점' }))

    fireEvent.click(screen.getByRole('button', { name: '2개 추가' }))
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(BULK_URL, {
        items: [
          { questionText: '첫 질문', category: 'personality' },
          { questionText: '둘째 질문', category: 'personality' },
        ],
      }),
    )
  })

  it('제외된 줄에는 사유가 보이고 체크할 수 없다', () => {
    draw()
    paste('같은 질문\n같은 질문')
    expect(screen.getByText('중복')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')[1]).toBeDisabled()
  })

  it('50개를 넘기면 안내가 뜨고 앞 50개만 선택된다', () => {
    draw()
    paste(
      Array.from({ length: BULK_MAX_ITEMS + 2 }, (_, i) => `질문 ${i + 1}`).join(
        '\n',
      ),
    )
    expect(screen.getByText(/50개까지 한 번에 추가할 수 있어요/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `${BULK_MAX_ITEMS}개 추가` }),
    ).toBeEnabled()
  })

  it('C3. 선택이 0개면 버튼이 비활성이다', () => {
    draw()
    goPaste()
    expect(screen.getByRole('button', { name: '0개 추가' })).toBeDisabled()
  })

  it('C4. 성공하면 폼을 닫는다', async () => {
    postMock.mockResolvedValue(okResponse(2))
    draw()
    paste('첫 질문\n둘째 질문')
    fireEvent.click(screen.getByRole('button', { name: '2개 추가' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

describe('D. 📣 성공 알림은 폼이 하지 않는다', () => {
  beforeEach(() => vi.clearAllMocks())

  it('D1. 🔴 단건 성공 → onAdded(created) 만 부르고 폼은 토스트하지 않는다', async () => {
    postMock.mockResolvedValue(okResponse(1))
    draw()
    fireEvent.change(screen.getByLabelText('질문 내용'), {
      target: { value: '1분 자기소개 해주세요' },
    })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(created(1)))
    expect(toast.show).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('D2. 🔴 붙여넣기 성공 → onAdded 가 created 전부를 받고 폼은 토스트하지 않는다', async () => {
    postMock.mockResolvedValue(okResponse(3))
    draw()
    goPaste()
    fireEvent.change(screen.getByLabelText('붙여넣을 질문 목록'), {
      target: { value: '첫 질문\n둘째 질문\n셋째 질문' },
    })
    fireEvent.click(screen.getByRole('button', { name: '3개 추가' }))

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(created(3)))
    expect(toast.show).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  /** 고르기 **전에** 알려야 "어디 갔지" 가 안 생긴다 — 사후 토스트만으로는 늦다 */
  it('D3. 카테고리가 정렬 자리를 정한다는 힌트가 보인다', () => {
    draw()
    expect(
      screen.getByText('카테고리를 고르면 면접 흐름의 그 자리로 들어가요 · 미분류는 중간'),
    ).toBeInTheDocument()
  })
})
