import { create } from 'zustand'

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
  error: (message: string) => useToastStore.getState().show(message, 'error'),
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  /** U13 — 되돌리기 등 액션 버튼이 있는 토스트 (기본 5초 노출) */
  action: (message: string, action: ToastAction, options?: { durationMs?: number }) =>
    useToastStore.getState().show(message, 'info', {
      action,
      durationMs: options?.durationMs ?? 5000,
    }),
}
