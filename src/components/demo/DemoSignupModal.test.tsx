/**
 * 🔴 **모달이 언마운트되면 `open` 이 반드시 풀려야 한다** (2026-08-08 QA 발견).
 *
 * `toast.error` 는 **전역 스토어의 `open`** 을 보고 에러 토스트를 억제한다. 그런데 이 모달은
 * `DemoShell` 안에만 있으므로, 모달이 열린 채 데모를 벗어나면(뒤로가기·주소 직접 입력)
 * 모달은 화면에서 사라지는데 `open` 은 `true` 로 남는다.
 *
 * 그 뒤로는 **앱 전체에서 에러 토스트가 죽는다** — 로그인하고 저장에 실패해도 아무 말이 없다.
 * 조용히 나빠지는 종류라 로그에도 안 남는다.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { DemoSignupModal } from './DemoSignupModal'
import { useDemoSignupStore } from '@/stores/demoSignupStore'
import { toast, useToastStore } from '@/stores/toastStore'

describe('DemoSignupModal — 언마운트 정리', () => {
  beforeEach(() => {
    useDemoSignupStore.setState({ open: false, reason: 'default' })
    useToastStore.setState({ toasts: [] })
  })

  it('🔴 열린 채 언마운트되면 open 이 풀린다', () => {
    const { unmount } = render(<DemoSignupModal />)
    useDemoSignupStore.getState().show('ai_answer')
    expect(useDemoSignupStore.getState().open).toBe(true)

    unmount() // 데모 이탈
    expect(useDemoSignupStore.getState().open).toBe(false)
  })

  /**
   * 위 단언이 왜 중요한지를 **결과로** 확인한다 — 상태 하나가 아니라
   * "그 뒤로 에러를 볼 수 있는가" 가 실제 피해다.
   */
  it('🔴 데모를 벗어난 뒤 에러 토스트가 정상 동작한다', () => {
    const { unmount } = render(<DemoSignupModal />)
    useDemoSignupStore.getState().show('ai_answer')
    unmount()

    toast.error('저장에 실패했습니다.')
    expect(useToastStore.getState().toasts.length).toBeGreaterThan(0)
  })

  it('맥락에 맞는 제목이 렌더된다', () => {
    useDemoSignupStore.setState({ open: true, reason: 'ai_followup' })
    const { getByText } = render(<DemoSignupModal />)
    expect(getByText('꼬리질문까지 미리 뽑아드릴게요')).toBeTruthy()
  })
})
