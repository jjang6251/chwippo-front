import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = 'max-w-sm' }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // U14 — ESC 닫기. 리스너는 document bubble 단계 → 안쪽 요소(인라인 에디터·오토컴플리트)나
  // document capture 단계 소비자(JobPostingModal 닫기 확인)가 preventDefault 로 선점 가능.
  // 처리 후 스스로도 preventDefault → 모달이 겹쳐 열려도 ESC 1번에 1개만 닫힌다.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:px-4 pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:pb-0"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface border border-line rounded-t-2xl sm:rounded-xl shadow-2xl w-full ${width} max-h-[85dvh] sm:max-h-[calc(100vh-4rem)] flex flex-col animate-fadeInUp`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
          <h2 className="text-text-primary font-semibold text-sm">{title}</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 p-5 overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">{children}</div>
      </div>
    </div>
  )
}
