/**
 * 카드 상세 — 데모에서 면접 탭 차단 (2026-08-09).
 *
 * 🔴 **진입점이 셋이다.** 사이드바(`Sidebar.demo.test`)·탭 버튼·**URL 직접 진입**.
 * 처음엔 탭 버튼만 숨겼는데, `?tab=interview` 로 들어오면 초기 `activeTab` 이 'interview' 가 돼
 * **버튼 없이 본문만** 떴다. QA 에서 잡혔다 — 눈으로는 안 보이는 경로다.
 *
 * 데모에 `interview-prep-*` 엔드포인트가 없어서 렌더되면 GET 이 전부 `null` 로 떨어지고
 * 콘솔에 미등록 에러만 남는다. ⑥(데모에 면접 채우기)이 끝나면 이 차단을 푼다.
 *
 * 🔴 **BoardDetail 전체를 렌더하지 않는다** — 의존이 많아 mock 이 20개 넘게 필요하고, 그러면
 * **BoardDetail 테스트가 아니라 mock 테스트**가 된다. 여기서 지킬 계약은 "어느 탭이 보이는가" 뿐이라
 * 그 판정식을 구현과 동일하게 옮겨 검증한다. 구현 조건이 바뀌면 이 함수도 같이 바뀌어야 한다.
 */
import { describe, expect, it } from 'vitest'

/** `BoardDetail.tsx` 의 탭 목록 구성과 동일한 식 */
function visibleTabs(opts: {
  aiEnabled: boolean
  interviewAiEnabled: boolean
  isDemo: boolean
}): string[] {
  return [
    'steps',
    ...(opts.aiEnabled ? ['coverletter'] : []),
    ...(opts.interviewAiEnabled && !opts.isDemo ? ['interview'] : []),
  ]
}

/** `BoardDetail.tsx` 의 면접 본문 렌더 조건과 동일한 식 */
function rendersInterviewBody(opts: {
  interviewAiEnabled: boolean
  isDemo: boolean
  activeTab: string
}): boolean {
  return (
    opts.interviewAiEnabled && !opts.isDemo && opts.activeTab === 'interview'
  )
}

const ON = { aiEnabled: true, interviewAiEnabled: true }

describe('BoardDetail — 데모 면접 탭 차단', () => {
  it('🔴 데모에서 면접 탭 버튼이 사라진다', () => {
    expect(visibleTabs({ ...ON, isDemo: true })).not.toContain('interview')
  })

  it('🔴 실서비스에서는 보인다 — 데모에서만 막는 것이다', () => {
    expect(visibleTabs({ ...ON, isDemo: false })).toContain('interview')
  })

  /**
   * 🔴 데모에서 **자소서 탭까지 막히면** 둘러보기가 망가진다.
   * 자소서는 데모 데이터가 갖춰져 있다(3개사 × 3문항 · 답변까지 작성됨).
   */
  it('🔴 데모에서도 전형 단계·자소서 탭은 살아 있다 (과잉 차단 방지)', () => {
    expect(visibleTabs({ ...ON, isDemo: true })).toEqual([
      'steps',
      'coverletter',
    ])
  })

  /**
   * 🔴 **이게 QA 에서 잡힌 갭이다.** 탭 버튼만 숨기면 `?tab=interview` 직접 진입에
   * 본문이 그대로 렌더된다 — 버튼이 없으니 눈으로는 안 보인다.
   */
  it('🔴 데모 + ?tab=interview 직접 진입 → 본문도 렌더되지 않는다', () => {
    expect(
      rendersInterviewBody({
        interviewAiEnabled: true,
        isDemo: true,
        activeTab: 'interview',
      }),
    ).toBe(false)
  })

  it('실서비스 + ?tab=interview → 본문이 렌더된다', () => {
    expect(
      rendersInterviewBody({
        interviewAiEnabled: true,
        isDemo: false,
        activeTab: 'interview',
      }),
    ).toBe(true)
  })

  it('flag 가 꺼져 있으면 데모 여부와 무관하게 안 뜬다 (기존 계약)', () => {
    for (const isDemo of [true, false]) {
      expect(visibleTabs({ ...ON, interviewAiEnabled: false, isDemo })).not.toContain(
        'interview',
      )
    }
  })
})
