/**
 * 새로고침 복귀 회귀 (15축 ⑮-② · 2026-08-07 CEO 실기).
 *
 * 🔴 **증상** — 생성 버튼을 누르고 그대로 두면 질문이 뿅 뜬다. 그런데 누르고 **새로고침**하면,
 * 서버가 다 만든 뒤에도 "AI 면접질문 생성" 버튼이 다시 뜬다.
 *
 * 🔴 **원인** — 완료를 알리는 건 생성 mutation 의 `onSuccess` 인데, 새로고침한 탭엔
 * 그 mutation 이 없다. 세션 폴링은 `completed` 를 받아 "생성 중" 을 끄지만, **질문 목록을
 * 다시 받는 사람이 아무도 없어서** 0개인 채로 CTA 분기에 떨어진다.
 *
 * 🔴 **왜 폴링으로 안 푸나** — "질문 목록도 생성 중엔 폴링" 은 두 폴링의 순서에 기댄다.
 * 세션 폴링이 완료를 먼저 보면 질문 폴링이 그 자리에서 꺼져 **완료 후 한 번도 안 받는 창**이
 * 생긴다. 그래서 전이 자체를 잡는다.
 */
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRefetchQuestionsOnGenerationEnd } from './useInterviewPrep'

let qc: QueryClient
let invalidate: ReturnType<typeof vi.fn>

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
)

type Status = 'idle' | 'in_progress' | 'completed' | 'failed' | undefined

const renderWith = (initial: Status) =>
  renderHook(({ s }: { s: Status }) => useRefetchQuestionsOnGenerationEnd('sess-1', s), {
    initialProps: { s: initial },
    wrapper,
  })

/** 질문 목록만 무효화됐는지 (다른 키까지 쓸어버리면 불필요한 재요청이 된다) */
const questionsInvalidated = () =>
  invalidate.mock.calls.filter(
    ([arg]) => JSON.stringify(arg?.queryKey) === JSON.stringify(['interview-prep-questions', 'sess-1']),
  ).length

describe('useRefetchQuestionsOnGenerationEnd', () => {
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    invalidate = vi.fn()
    qc.invalidateQueries = invalidate as unknown as QueryClient['invalidateQueries']
  })

  it('🔴 새로고침한 탭: in_progress → completed 면 질문을 다시 받는다', () => {
    const { rerender } = renderWith('in_progress')
    expect(questionsInvalidated()).toBe(0) // 아직 진행 중이면 건드리지 않는다
    rerender({ s: 'completed' })
    expect(questionsInvalidated()).toBe(1)
  })

  it('🔴 실패로 끝나도 다시 받는다 — 부분 저장분이 있을 수 있다', () => {
    const { rerender } = renderWith('in_progress')
    rerender({ s: 'failed' })
    expect(questionsInvalidated()).toBe(1)
  })

  it('🔴 이미 끝난 세션을 열 땐 재요청하지 않는다 (매 진입마다 1회씩 새면 안 된다)', () => {
    const { rerender } = renderWith('completed')
    rerender({ s: 'completed' })
    expect(questionsInvalidated()).toBe(0)
  })

  it('🔴 로딩 중(undefined) → in_progress 는 전이가 아니다', () => {
    const { rerender } = renderWith(undefined)
    rerender({ s: 'in_progress' })
    expect(questionsInvalidated()).toBe(0)
  })

  it('🔴 세션 조회가 끊겨 undefined 가 되면 완료로 오인하지 않는다', () => {
    const { rerender } = renderWith('in_progress')
    rerender({ s: undefined })
    expect(questionsInvalidated()).toBe(0)
  })

  it('🔴 완료 후 폴링이 같은 값을 또 줘도 한 번만 받는다', () => {
    const { rerender } = renderWith('in_progress')
    rerender({ s: 'completed' })
    rerender({ s: 'completed' })
    rerender({ s: 'completed' })
    expect(questionsInvalidated()).toBe(1)
  })

  it('재생성(completed → in_progress → completed)도 매번 잡는다', () => {
    const { rerender } = renderWith('in_progress')
    rerender({ s: 'completed' })
    rerender({ s: 'in_progress' })
    rerender({ s: 'completed' })
    expect(questionsInvalidated()).toBe(2)
  })

  /**
   * 🔴 **새로고침을 여러 번 해도 같아야 한다** (CEO 질문 2026-08-07).
   *
   * 새로고침은 매번 **새 마운트**다 — 훅의 이전 상태(ref)도, React Query 캐시도 통째로
   * 초기화된다. 그래서 회차 간에 남는 게 없고, 각 회차는 독립적으로 같은 시퀀스를 탄다:
   * `undefined`(세션 조회 중) → `in_progress` → `completed`.
   *
   * ref 를 쓰는 훅은 이 지점에서 조용히 깨지기 쉽다 — 마운트 직후 첫 값을 "전이" 로
   * 오인하면 매 새로고침마다 헛요청이 나가고, 반대로 첫 값을 흘려보내면 그 회차는
   * 영영 안 받는다. 그래서 회차를 실제로 반복해 본다.
   */
  it('🔴 새로고침 3번 — 매 회차가 독립적으로 완료를 잡는다', () => {
    for (let round = 1; round <= 3; round++) {
      invalidate.mockClear()
      // 새 마운트 = 새 새로고침. 세션 조회가 아직 안 끝나 undefined 로 시작한다
      const { rerender, unmount } = renderWith(undefined)
      rerender({ s: 'in_progress' })
      expect(questionsInvalidated()).toBe(0) // 진행 중엔 헛요청 없음
      rerender({ s: 'completed' })
      expect(questionsInvalidated()).toBe(1) // 회차마다 정확히 1번
      unmount()
    }
  })

  /**
   * 🔴 **이미 끝난 뒤에 새로고침하면** 세션이 처음부터 `completed` 로 내려온다.
   * 이땐 질문 목록도 마운트하며 새로 받으므로 이 훅이 낄 일이 없다 —
   * 여기서 무효화하면 페이지 열 때마다 요청이 하나씩 더 나간다.
   */
  it('🔴 완료 후 새로고침: 처음부터 completed 면 아무것도 안 한다', () => {
    const { rerender } = renderWith(undefined)
    rerender({ s: 'completed' })
    expect(questionsInvalidated()).toBe(0)
  })

  /**
   * 🔴 StrictMode 는 마운트 시 effect 를 **두 번** 돌린다. 같은 상태로 두 번 들어와도
   * 결과가 같아야 한다 — `prev` 를 early return 앞에서 갱신하는 이유다.
   */
  it('🔴 같은 상태로 effect 가 두 번 들어와도 한 번만 받는다 (StrictMode)', () => {
    const { rerender } = renderWith('in_progress')
    rerender({ s: 'in_progress' })
    rerender({ s: 'completed' })
    rerender({ s: 'completed' })
    expect(questionsInvalidated()).toBe(1)
  })
})
