import { useEffect } from 'react'

interface Props {
  title: string
  body: string
  onDismiss: () => void
}

export function AnnouncementModal({ title, body, onDismiss }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
        className="bg-surface border border-line rounded-2xl w-full max-w-sm overflow-hidden"
      >
        {/* 상단 brand 바 */}
        <div className="h-1 bg-brand w-full" />

        {/* 아이콘 + 제목 */}
        <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center mb-4">
            <MegaphoneIcon />
          </div>
          <h2 id="announcement-modal-title" className="text-[15px] font-bold text-text-primary leading-snug">{title}</h2>
        </div>

        {/* 구분선 + 본문 + 버튼 */}
        <div className="border-t border-line px-6 pt-5 pb-6 flex flex-col gap-5">
          <div className="max-h-[35vh] overflow-y-auto">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap text-center">
              {body}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            autoFocus
            className="w-full py-2.5 rounded-xl bg-brand text-bg text-sm font-semibold hover:bg-accent active:bg-accent-hover transition-colors"
          >
            확인했어요
          </button>
        </div>
      </div>
    </div>
  )
}

function MegaphoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary/90" aria-hidden="true">
      <path d="M13 2L3 6H1a1 1 0 00-1 1v2a1 1 0 001 1h2l10 4V2z" />
      <path d="M3 9v4" />
    </svg>
  )
}
