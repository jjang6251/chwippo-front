/**
 * 내 답변 자동 저장 — **떠날 때 잃지 않는가.**
 *
 * 🔴 **왜 이 파일이 생겼나** (2026-08-09). 언마운트 cleanup 을 넣으면서
 * `clearTimeout` 만 했다. 저장은 **1.5초 debounce** 인데, 모바일 집중 화면은 문항마다
 * `key` 로 remount 되므로 **타이핑하다 바로 「다음」을 누르면 그 1.5초 안에 언마운트**된다.
 * 타이머만 지우면 그 문항 답변이 통째로 사라지고, 화면엔 `저장 중…` 이 떠 있었으니
 * 사용자는 저장된 줄 안다.
 *
 * cleanup 이 없던 시절엔 타이머가 언마운트 뒤에도 살아 있어 **우연히** 저장됐다
 * (mutation 은 컴포넌트가 아니라 QueryClient 에 매인다). cleanup 이 그 안전망을 끊었다.
 *
 * 그래서 이 spec 이 잠그는 계약은 하나다 — **떠나도 저장된다.**
 */
import { render, screen, act, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewQuestionCard } from './InterviewQuestionCard'
import { interviewPrepApi } from '@/api/interviewPrep'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

vi.mock('@/api/interviewPrep', () => ({
  interviewPrepApi: {
    updateQuestion: vi.fn(() => Promise.resolve({ id: 'q-1', myMemo: '' })),
  },
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { show: vi.fn(), error: vi.fn() },
}))
vi.mock('@/hooks/useMyAiQuotas', () => ({
  useAiQuotaBlocked: () => ({ blocked: false, reason: null }),
}))
vi.mock('@/hooks/useRequireAiConsent', () => ({
  useRequireAiConsent: () => vi.fn().mockResolvedValue(true),
}))
vi.mock('@/hooks/useRequireJobTitle', () => ({
  useRequireJobTitle: () => vi.fn().mockResolvedValue(true),
}))

const updateMock = vi.mocked(interviewPrepApi.updateQuestion)

const question = {
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
  children: [],
} as unknown as InterviewPrepQuestion

function draw(q: InterviewPrepQuestion = question) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = (next: InterviewPrepQuestion) => (
    <QueryClientProvider client={qc}>
      <InterviewQuestionCard
        question={next}
        sessionId="sess-1"
        applicationId="app-1"
      />
    </QueryClientProvider>
  )
  const r = render(ui(q))
  return { ...r, again: (next: InterviewPrepQuestion) => r.rerender(ui(next)) }
}

/** debounce 를 실제로 기다리지 않고 시계를 돌린다 */
const tick = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe('내 답변 자동 저장', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    updateMock.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('타이핑 후 1.5초가 지나면 저장한다 (기존 동작)', async () => {
    draw()
    const ta = screen.getByPlaceholderText(/어떻게 답할지 적어보세요/)
    await act(async () => {
      fireEvent.change(ta, { target: { value: '보정 전 41%였습니다' } })
    })
    expect(updateMock).not.toHaveBeenCalled() // 아직 debounce 중
    await tick(1600)
    expect(updateMock).toHaveBeenCalledWith('q-1', {
      myMemo: '보정 전 41%였습니다',
    })
  })

  /**
   * 🔴 **핵심.** 집중 화면에서 「다음」을 누르면 카드가 언마운트된다.
   * 저장이 안 나가면 그 답변은 어디에도 없다.
   */
  it('🔴 debounce 가 끝나기 전에 언마운트돼도 저장한다 (flush)', async () => {
    const { unmount } = draw()
    const ta = screen.getByPlaceholderText(/어떻게 답할지 적어보세요/)
    await act(async () => {
      fireEvent.change(ta, { target: { value: '아직 저장 안 된 답변' } })
    })
    await tick(300) // 1.5초 전
    expect(updateMock).not.toHaveBeenCalled()

    await act(async () => {
      unmount()
    })

    expect(updateMock).toHaveBeenCalledWith('q-1', {
      myMemo: '아직 저장 안 된 답변',
    })
  })

  /** 이미 저장된 뒤 떠나면 같은 값을 또 보내지 않는다 */
  it('저장이 끝난 뒤 언마운트하면 중복 저장하지 않는다', async () => {
    const { unmount } = draw()
    const ta = screen.getByPlaceholderText(/어떻게 답할지 적어보세요/)
    await act(async () => {
      fireEvent.change(ta, { target: { value: '저장된 답변' } })
    })
    await tick(1600)
    expect(updateMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      unmount()
    })
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  /**
   * 🔴 **내가 보낸 값이 돌아와 내가 방금 친 글자를 지우면 안 된다.**
   *
   * 저장 성공 시 questions 캐시를 패치하도록 바꾸면서 생긴 경합이다 —
   * 캐시가 바뀌면 `question.myMemo` 가 바뀌고, 서버값을 로컬로 내리는 effect 가 돈다.
   * 응답이 오는 사이에 사용자가 더 쳤으면 **그 글자가 옛 값으로 되돌아간다.**
   * 캐시를 안 고치던 시절엔 일어날 수 없던 일이다.
   */
  it('🔴 저장 응답이 캐시로 돌아와도 그 사이 친 글자를 되돌리지 않는다', async () => {
    const { again } = draw()
    const ta = screen.getByPlaceholderText(/어떻게 답할지 적어보세요/)

    await act(async () => {
      fireEvent.change(ta, { target: { value: '보정 전 41%' } })
    })
    await tick(1600) // "보정 전 41%" 가 서버로 나감

    // 응답을 기다리는 사이에 계속 쓴다
    await act(async () => {
      fireEvent.change(ta, { target: { value: '보정 전 41%였습니다' } })
    })

    // 응답 도착 → 캐시 패치로 **옛 값**이 prop 으로 내려온다
    await act(async () => {
      again({ ...question, myMemo: '보정 전 41%' } as InterviewPrepQuestion)
    })

    expect((ta as HTMLTextAreaElement).value).toBe('보정 전 41%였습니다')
  })

  /** 반대로 **밖에서** 바뀐 값(다른 탭·재조회)은 반영돼야 한다 */
  it('내가 보낸 적 없는 서버값은 그대로 반영한다', async () => {
    const { again } = draw()
    const ta = screen.getByPlaceholderText(/어떻게 답할지 적어보세요/)
    await act(async () => {
      again({ ...question, myMemo: '다른 곳에서 쓴 답변' } as InterviewPrepQuestion)
    })
    expect((ta as HTMLTextAreaElement).value).toBe('다른 곳에서 쓴 답변')
  })

  /** 한 글자도 안 쳤으면 떠나도 아무 일 없어야 한다 (헛 호출 = 헛 쓰기) */
  it('입력이 없으면 언마운트해도 저장하지 않는다', async () => {
    const { unmount } = draw()
    await act(async () => {
      unmount()
    })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
