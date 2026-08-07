import { create } from 'zustand'

/**
 * 지원 직무 입력 요구 모달 전역 store.
 *
 * `useRequireAiConsent` / `aiConsentStore` 와 **같은 모양**이다 — AI 진입점마다 게이트
 * 코드를 흩뿌리면 반드시 하나가 빠지므로, 이미 모든 AI 버튼에 깔린 동의 게이트와
 * 같은 형태로 만들어 한 줄씩만 추가하게 한다.
 *
 * 직무가 비어 있으면 모달을 띄우고, 입력 결과를 caller 에게 `Promise<boolean>` 으로 준다.
 * 입력된 직무는 모달이 **카드에 저장**한 뒤 true 를 돌려준다 (write-back).
 */
interface JobTitleGateState {
  /** 모달 대상 지원 카드. null 이면 닫힘 */
  applicationId: string | null
  _resolve: ((value: boolean) => void) | null
  request: (applicationId: string) => Promise<boolean>
  /** 저장 성공 — caller 를 통과시킨다 */
  done: () => void
  /** 취소 — caller 는 silent return (토스트 X, 동의 모달과 동일 정책) */
  cancel: () => void
}

export const useJobTitleGateStore = create<JobTitleGateState>((set, get) => ({
  applicationId: null,
  _resolve: null,
  request: (applicationId) => {
    // 이전 resolver 가 살아있으면 false 로 정리 후 새 모달 시작 (동의 모달과 동일)
    const prev = get()._resolve
    if (prev) prev(false)
    return new Promise<boolean>((resolve) => {
      set({ applicationId, _resolve: resolve })
    })
  },
  done: () => {
    const resolve = get()._resolve
    set({ applicationId: null, _resolve: null })
    if (resolve) resolve(true)
  },
  cancel: () => {
    const resolve = get()._resolve
    set({ applicationId: null, _resolve: null })
    if (resolve) resolve(false)
  },
}))
