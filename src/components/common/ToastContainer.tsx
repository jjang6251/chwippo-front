import { useToastStore } from '@/stores/toastStore'

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={`
            flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg cursor-pointer
            animate-[fadeInUp_0.2s_ease-out]
            ${t.type === 'error' ? 'bg-danger/10 border border-danger/30 text-danger' : ''}
            ${t.type === 'success' ? 'bg-success/10 border border-success/30 text-success' : ''}
            ${t.type === 'info' ? 'bg-surface-2 border border-white/8 text-text-primary' : ''}
          `}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
