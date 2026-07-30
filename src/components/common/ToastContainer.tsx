import { useToastStore } from '@/stores/toastStore'

/**
 * 위생 ③ — 토스트 스크린리더 공지.
 *
 * `role=status` + `aria-live=polite` 를 **시각 컨테이너 자체에** 둔다.
 *   - 항상 마운트: 라이브 영역이 메시지와 동시에 DOM 에 들어오면 스크린리더가 변화를
 *     감지하지 못해 안 읽는 경우가 많다. 토스트 0건이어도 빈 컨테이너를 유지한다.
 *   - **별도 sr-only 영역을 두지 않는다**: 처음엔 그렇게 했다가 문구가 DOM 에 두 번
 *     존재해 `getByText` 가 2개를 잡는 실사고가 났다 (2026-07-30 e2e). 텍스트는 한 곳에만.
 *   - polite: 토스트는 사용자 조작의 결과 통지라 읽던 흐름을 끊지 않아야 한다.
 *
 * 빈 컨테이너가 클릭을 막지 않는지 — 자식이 없으면 크기 0 이라 클릭 대상이 될 수 없고,
 * `CalendarDaySheet` 의 outside-dismiss 가드는 `target.closest()` 로 **클릭 대상**을 보므로 무해하다.
 */
export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    // z-[60] — 바텀시트·모달(z-50) 위에서 되돌리기 등 액션 토스트가 눌리도록.
    // pointer-events-auto — 모달(vaul/Radix)이 body 에 pointer-events:none 을 걸어도 토스트는 클릭 수신.
    // data-toast-container — 모달의 outside-dismiss 가드 셀렉터 (토스트 클릭 시 시트 닫힘 방지).
    <div
      data-toast-container
      role="status"
      aria-live="polite"
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
