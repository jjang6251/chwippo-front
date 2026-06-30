/**
 * MyInfo C 패턴 — 한 줄 카드 (학력·자격증·수상 등 list 항목)
 *
 * 평소엔 깔끔한 list, 클릭 시 modal 로 상세 편집.
 * 사용:
 *   <MyInfoItemRow emoji="🎓" title="서울대학교 · 컴퓨터공학"
 *                  meta="학사 · 2020.03 ~ 2024.02 · 3.85/4.5"
 *                  onClick={() => setEditing(item)} />
 */
interface Props {
  emoji: string
  title: string
  meta?: string
  /** 우측 액션 (배지·X 버튼 등). 없으면 chevron 만 */
  rightSlot?: React.ReactNode
  onClick: () => void
  /** 강조 (active·hover) 색 — brand·accent·warning 등 */
  accent?: 'brand' | 'accent' | 'warning' | 'success' | 'info' | 'violet'
}

const ACCENT_HOVER: Record<NonNullable<Props['accent']>, string> = {
  brand: 'hover:border-brand/40',
  accent: 'hover:border-accent/40',
  warning: 'hover:border-warning/40',
  success: 'hover:border-success/40',
  info: 'hover:border-info/40',
  violet: 'hover:border-violet/40',
}

const ACCENT_EMOJI_BG: Record<NonNullable<Props['accent']>, string> = {
  brand: 'bg-brand/15 text-brand',
  accent: 'bg-accent/15 text-accent',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  info: 'bg-info/15 text-info',
  violet: 'bg-violet/15 text-violet',
}

export function MyInfoItemRow({
  emoji,
  title,
  meta,
  rightSlot,
  onClick,
  accent = 'brand',
}: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`w-full flex items-center gap-3 px-4 py-3.5 bg-surface-2 border border-line ${ACCENT_HOVER[accent]} hover:bg-surface-3 rounded-xl transition-all text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40`}
    >
      <span
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${ACCENT_EMOJI_BG[accent]}`}
      >
        {emoji}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary truncate">{title}</div>
        {meta && (
          <div className="text-[11px] text-text-tertiary truncate mt-0.5">{meta}</div>
        )}
      </div>
      {rightSlot ?? (
        <span
          className="text-text-quaternary group-hover:text-text-secondary transition-colors text-lg leading-none"
          aria-hidden="true"
        >
          ›
        </span>
      )}
    </div>
  )
}
