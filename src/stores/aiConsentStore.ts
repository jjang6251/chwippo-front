import { create } from 'zustand'

/**
 * AI 사용 동의 요구 모달 전역 store.
 *
 * 사용자가 AI feature 호출 시점에 consent 가 없으면 모달을 띄우고,
 * 동의 / 취소 결과를 caller 에게 Promise<boolean> 으로 돌려준다.
 *
 * 동시에 여러 caller 가 request() 호출 시 첫 caller 의 resolver 가 유지되고
 * 그 모달 close 결과를 모든 caller 가 공유하는 식으로는 X — 마지막 호출이 이전 resolver 를
 * false 로 종료 후 자신의 resolver 로 교체. 실용상 동시 호출은 거의 없음.
 */
interface AiConsentState {
  open: boolean
  _resolve: ((value: boolean) => void) | null
  request: () => Promise<boolean>
  agree: () => void
  decline: () => void
}

export const useAiConsentStore = create<AiConsentState>((set, get) => ({
  open: false,
  _resolve: null,
  request: () => {
    // 이전 resolver 가 살아있으면 false 로 정리 후 새 모달 시작
    const prev = get()._resolve
    if (prev) prev(false)
    return new Promise<boolean>((resolve) => {
      set({ open: true, _resolve: resolve })
    })
  },
  agree: () => {
    const resolve = get()._resolve
    set({ open: false, _resolve: null })
    if (resolve) resolve(true)
  },
  decline: () => {
    const resolve = get()._resolve
    set({ open: false, _resolve: null })
    if (resolve) resolve(false)
  },
}))
