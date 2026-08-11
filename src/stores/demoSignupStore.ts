import { create } from 'zustand'

/**
 * 사용자가 **무엇을 하려다** 막혔는지.
 *
 * 🔴 **모달이 맥락을 알아야 한다** (2026-08-09). 예전엔 어디서 눌러도 같은 문구가 떴다 —
 * `AI 도움`·`꼬리질문 추가`·`카드 만들기` 가 전부 "데모에서는 저장되지 않아요" 였다.
 * 사용자가 그 버튼을 누른 순간이 **관심이 가장 높은 시점**인데 그걸 안 받아주면
 * 남의 얘기로 들린다.
 */
export type DemoBlockReason =
  | 'ai_answer'
  | 'ai_followup'
  | 'ai_generate'
  | 'ai_coverletter'
  | 'coverletter_item'
  /** 질문 은행 — 내가 직접 적은 질문 저장 (AI 아님) */
  | 'custom_question'
  | 'create'
  | 'default'

interface DemoSignupState {
  open: boolean
  reason: DemoBlockReason
  show: (reason?: DemoBlockReason) => void
  hide: () => void
}

export const useDemoSignupStore = create<DemoSignupState>((set) => ({
  open: false,
  reason: 'default',
  show: (reason = 'default') => set({ open: true, reason }),
  hide: () => set({ open: false }),
}))
