interface Props {
  title: string
  body: string
  onExpand: () => void
  onDismiss: () => void
}

export function AnnouncementBanner({ title, body, onExpand, onDismiss }: Props) {
  return (
    <div className="w-full bg-brand flex items-start gap-3 px-4 py-2.5 shrink-0 print:hidden">
      <MegaphoneIcon />
      <button
        type="button"
        onClick={onExpand}
        aria-label={`공지 상세 보기: ${title}`}
        className="flex-1 min-w-0 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2 overflow-hidden text-left hover:opacity-80 transition-opacity"
      >
        <span className="text-[13px] font-bold text-bg truncate">{title}</span>
        {body && (
          <span className="text-xs text-bg/90 truncate">{body}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="공지 닫기"
        className="flex-none w-8 h-8 flex items-center justify-center rounded-lg text-bg/90 hover:text-bg hover:bg-bg/10 active:bg-bg/20 transition-colors text-lg leading-none mt-px"
      >
        ×
      </button>
    </div>
  )
}

function MegaphoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-bg/90 flex-none mt-0.5" aria-hidden="true">
      <path d="M13 2L3 6H1a1 1 0 00-1 1v2a1 1 0 001 1h2l10 4V2z" />
      <path d="M3 9v4" />
    </svg>
  )
}
