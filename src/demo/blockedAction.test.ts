/**
 * 데모에서 차단된 동작의 사용자 경험 (2026-08-09 실기 발견 3건).
 *
 * 실기에서 세 가지가 한꺼번에 드러났다:
 *  1. `AI 도움`·`다시 생성` 을 눌러도 **아무 일도 안 일어났다** — AI 동의 게이트가
 *     `if (!user) return false` 라 비로그인(데모)에서 조용히 멈췄다. 꼬리질문만 모달이
 *     떴는데, 그건 그 게이트를 안 거치는 유일한 경로였다
 *  2. 꼬리질문 모달을 **X 로 닫으면 로딩이 안 풀렸다** — 차단된 요청이 영원히 pending
 *     인 Promise 라 `isPending` 이 true 로 남았다
 *  3. 모달 문구가 **"데모에서는 저장되지 않아요"** — 안 되는 이유만 말한다
 *
 * 🔴 셋 다 **에러가 나지 않는 종류의 고장**이다. 콘솔도 조용하고 테스트도 안 걸린다.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { demoAdapter, DEMO_BLOCKED } from './demoAdapter'
import { useDemoSignupStore } from '@/stores/demoSignupStore'
import { useToastStore } from '@/stores/toastStore'
import { toast } from '@/stores/toastStore'
import type { InternalAxiosRequestConfig } from 'axios'

function call(method: string, url: string, body?: unknown) {
  return demoAdapter({
    method,
    url,
    data: body === undefined ? undefined : JSON.stringify(body),
  } as InternalAxiosRequestConfig)
}

describe('데모 — AI 동작 차단', () => {
  beforeEach(() => {
    useDemoSignupStore.setState({ open: false })
    useToastStore.setState({ toasts: [] })
  })

  /**
   * 🔴 **영원히 pending 이면 안 된다.** 그러면 모달을 닫아도 버튼이
   * `꼬리질문 만드는 중…` 인 채로 멈춘다 — 사용자는 뭔가 돌고 있다고 믿는다.
   */
  it.each([
    ['post', '/interview-prep-questions/demo-is1-q5/answer'],
    ['post', '/interview-prep-questions/demo-is1-q5/followups'],
    ['post', '/interview-prep-sessions/demo-is1/generate'],
    ['post', '/interview-prep-sessions'],
  ])('🔴 %s %s → 영원 pending 이 아니라 거절된다 (로딩이 풀린다)', async (m, url) => {
    await expect(call(m, url, {})).rejects.toMatchObject({
      code: DEMO_BLOCKED,
    })
  })

  it.each([
    ['post', '/interview-prep-questions/demo-is1-q5/answer'],
    ['post', '/interview-prep-sessions/demo-is1/generate'],
  ])('🔴 %s %s → 가입 모달이 뜬다', async (m, url) => {
    await call(m, url, {}).catch(() => undefined)
    expect(useDemoSignupStore.getState().open).toBe(true)
  })

  it('차단 에러에 식별 코드가 실려 온다', async () => {
    const err = await call('post', '/interview-prep-sessions', {}).catch(
      (e: unknown) => e,
    )
    expect((err as { code?: string }).code).toBe(DEMO_BLOCKED)
  })

  /**
   * 🔴 **비 AI 메모는 허용된다.** 데모에서 실제로 써볼 수 있어야 기능을 이해한다.
   * 자소서 답변 저장과 같은 성격이다.
   */
  it.each([
    ['patch', '/interview-prep-questions/demo-is1-q5'],
    ['patch', '/interview-prep-sessions/demo-is1/user-notes'],
  ])('%s %s → 메모는 허용된다 (모달 안 뜸)', async (m, url) => {
    await call(m, url, { myMemo: '메모' })
    expect(useDemoSignupStore.getState().open).toBe(false)
  })

  /**
   * 🔴 **「면접 보기」 자가평가도 AI 가 아니다** (질문 은행 D3). 막으면 연습 도중 문항마다
   * 가입 모달이 떠서 **루프가 끝까지 도는 걸 볼 수 없다** — 데모에서 보여줄 게 그건데도.
   * 코인도 안 쓰고 서버 판단도 없는, 내가 나를 채점한 한 칸이다.
   */
  it('🔴 post /interview-prep-questions/:id/practice → 차단되지 않는다', async () => {
    await call('post', '/interview-prep-questions/demo-is1-q7/practice', {
      result: 'good',
    })
    expect(useDemoSignupStore.getState().open).toBe(false)
  })
})

/**
 * 🔴 **맥락이 틀리면 무맥락보다 나쁘다.** 꼬리질문을 눌렀는데 "자소서를 도와드릴게요" 가
 * 뜨면 앱이 내 행동을 모른다는 게 더 분명해진다. 경로→이유 매핑을 값으로 못박는다.
 */
describe('데모 — 모달이 맥락을 받는다', () => {
  beforeEach(() => useDemoSignupStore.setState({ open: false, reason: 'default' }))

  it.each([
    ['/interview-prep-questions/q1/answer', 'ai_answer'],
    ['/interview-prep-questions/q1/followups', 'ai_followup'],
    ['/interview-prep-sessions/s1/generate', 'ai_generate'],
    // 🔴 직접 적은 질문은 AI 가 아니다 — "예상 질문을 뽑아드릴게요" 가 뜨면 방금 한
    //    행동과 어긋난다. `/generate` 와 접두사가 같아 순서가 뒤집히면 조용히 섞인다
    ['/interview-prep-sessions/s1/questions/bulk', 'custom_question'],
    // 🔴 세션 생성 = 질문 생성이다. 예전엔 'create'(지원 카드 추가) 로 떨어져
    //    "지원한 회사를 추가하면 마감 D-day 를…" 이 떴다 (2026-08-08 QA)
    ['/interview-prep-sessions', 'ai_generate'],
    ['/applications', 'create'],
    // 🔴 자소서 문항 추가는 AI 가 아니다 — "초안을 만들어드릴게요" 가 뜨면 안 된다
    ['/coverletters', 'coverletter_item'],
    ['/coverletters/cl1/ai-draft', 'ai_coverletter'],
  ])('🔴 %s → reason=%s', async (url, expected) => {
    await call('post', url, {}).catch(() => undefined)
    expect(useDemoSignupStore.getState().reason).toBe(expected)
  })

  /**
   * 못 알아본 경로는 `default` 로 떨어지고, **그때도 문구가 어색하지 않아야** 한다.
   * 새 기능이 생길 때마다 매핑을 추가하지 않으면 여기로 온다.
   */
  it('알 수 없는 차단 경로는 default 로 떨어진다', async () => {
    await call('post', '/some/unknown/endpoint', {}).catch(() => undefined)
    expect(useDemoSignupStore.getState().reason).toBe('default')
  })
})

describe('데모 — 가입 모달 중 에러 토스트 억제', () => {
  beforeEach(() => {
    useDemoSignupStore.setState({ open: false })
    useToastStore.setState({ toasts: [] })
  })

  /**
   * 🔴 차단된 요청이 이제 `onError` 를 타므로 caller 의 `toast.error` 가 돈다.
   * `toast.error` 를 쓰는 곳이 20군데가 넘어 개별로 막으면 새 caller 가 생길 때마다
   * 빠뜨린다 — 한 곳에서 막는다. 사용자에겐 이미 안내가 떠 있고,
   * 거기에 "저장에 실패했습니다" 가 겹치면 두 번 혼내는 꼴이다.
   */
  it('🔴 모달이 떠 있으면 에러 토스트가 안 뜬다', () => {
    useDemoSignupStore.setState({ open: true })
    toast.error('저장에 실패했습니다.')
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('🔴 모달을 닫으면 평소대로 돌아온다 (영구 억제가 아니다)', () => {
    useDemoSignupStore.setState({ open: false })
    toast.error('저장에 실패했습니다.')
    expect(useToastStore.getState().toasts.length).toBeGreaterThan(0)
  })

  it('모달이 떠 있어도 일반 토스트는 막지 않는다 (에러만 억제)', () => {
    useDemoSignupStore.setState({ open: true })
    toast.show('저장했어요.')
    expect(useToastStore.getState().toasts.length).toBeGreaterThan(0)
  })
})
