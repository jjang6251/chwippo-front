import { create } from 'zustand'
import { useDemoSignupStore } from '@/stores/demoSignupStore'

type ToastType = 'success' | 'error' | 'info'

/** U13 — 토스트 액션 슬롯 (예: "되돌리기") */
export interface ToastAction {
  label: string
  onAction: () => void
}

interface Toast {
  id: string
  message: string
  type: ToastType
  action?: ToastAction
}

interface ToastOptions {
  action?: ToastAction
  durationMs?: number
}

interface ToastState {
  toasts: Toast[]
  show: (message: string, type?: ToastType, options?: ToastOptions) => void
  remove: (id: string) => void
}

const DEFAULT_DURATION = 3500

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, type = 'info', options) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type, action: options?.action }] }))
    const duration = options?.durationMs ?? DEFAULT_DURATION
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// 인터셉터 등 컴포넌트 밖에서 호출 가능한 함수
export const toast = {
  show: (message: string, type?: ToastType) => useToastStore.getState().show(message, type),
  /**
   * 🔴 **가입 모달이 떠 있으면 에러 토스트를 삼킨다** (2026-08-09).
   *
   * 데모에서 차단된 요청은 이제 **전용 코드로 reject** 된다(예전엔 영원히 pending 이라
   * 로딩이 안 풀렸다). 그러면서 `onError` 를 타게 됐는데, `toast.error` 를 쓰는 곳이
   * 20군데가 넘어 개별로 막으면 새 caller 가 생길 때마다 빠뜨린다.
   *
   * 사용자 입장에서 보면 **이미 "로그인하고 직접 해보기" 안내가 떠 있다.**
   * 거기에 "저장에 실패했습니다" 가 겹치면 **두 번 혼내는 꼴**이라, 모달이 떠 있는
   * 동안은 에러 토스트를 내보내지 않는다. 모달을 닫으면 평소대로 돌아온다.
   */
  error: (message: string) => {
    if (useDemoSignupStore.getState().open) return
    useToastStore.getState().show(message, 'error')
  },
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  /** U13 — 되돌리기 등 액션 버튼이 있는 토스트 (기본 5초 노출) */
  action: (message: string, action: ToastAction, options?: { durationMs?: number }) =>
    useToastStore.getState().show(message, 'info', {
      action,
      durationMs: options?.durationMs ?? 5000,
    }),
}
