import type { ReactNode } from 'react'

/**
 * F6 PR 2 Phase 5.6.7 — admin 페이지 콘텐츠 공용 카드.
 *
 * 일관 톤: bg-surface-2 + border-line + rounded-xl + shadow-sm + p-5.
 * 페이지 배경 (bg-bg) 위에 카드들이 떠보이도록 (Linear/Stripe 패턴).
 *
 * 표·리스트·폼 등 모든 admin 콘텐츠를 wrap. title/action 옵션.
 */
interface Props {
  title?: ReactNode
  action?: ReactNode
  /** title 옆 hover tooltip (ⓘ 아이콘) */
  hint?: string
  /** 본문 padding 제거 (full-bleed table 용) */
  flush?: boolean
  className?: string
  children: ReactNode
}

export function AdminCard({
  title,
  action,
  hint,
  flush = false,
  className = '',
  children,
}: Props) {
  return (
    <section
      className={`bg-surface-2 border border-line rounded-xl shadow-sm overflow-hidden mb-5 ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line bg-card">
          {title && (
            <h2 className="text-text-primary text-sm font-semibold inline-flex items-center gap-1.5">
              {title}
              {hint && (
                <span
                  className="text-text-quaternary text-[10px] cursor-help"
                  title={hint}
                >
                  ⓘ
                </span>
              )}
            </h2>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  )
}
