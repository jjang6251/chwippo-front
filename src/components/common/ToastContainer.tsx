import { useToastStore } from '@/stores/toastStore'

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  if (toasts.length === 0) return null

  return (
    // z-[60] — 바텀시트·모달(z-50) 위에서 되돌리기 등 액션 토스트가 눌리도록.
    // pointer-events-auto — 모달(vaul/Radix)이 body 에 pointer-events:none 을 걸어도 토스트는 클릭 수신.
    // data-toast-container — 모달의 outside-dismiss 가드 셀렉터 (토스트 클릭 시 시트 닫힘 방지).
    <div
      data-toast-container
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-auto"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={t.action ? undefined : () => remove(t.id)}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium shadow-lg
            animate-[fadeInUp_0.2s_ease-out]
            ${t.action ? '' : 'cursor-pointer'}
            ${t.type === 'error' ? 'bg-danger/10 border border-danger/30 text-danger' : ''}
            ${t.type === 'success' ? 'bg-success/10 border border-success/30 text-success' : ''}
            ${t.type === 'info' ? 'bg-surface-2 border border-line text-text-primary' : ''}
          `}
        >
          {/* 액션 토스트는 문구 한 줄 고정 (버튼과 폭 경쟁으로 줄바꿈 방지) · 일반 토스트는 긴 메시지 wrap 허용 */}
          <span className={t.action ? 'whitespace-nowrap' : undefined}>{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.onAction()
                remove(t.id)
              }}
              className="shrink-0 -my-1 h-8 px-2 flex items-center rounded text-brand font-semibold hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
