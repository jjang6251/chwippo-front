/**
 * MyInfo C 패턴 — 한 줄 카드 + expandable 복붙 body.
 *
 * detailFields 있으면:
 *   - Row 클릭 = expand 토글
 *   - 우상단 ✏️ 편집 = onEdit (modal)
 *   - 펼침 body = label + value + [📋] · 상단 "전체 복사"
 * detailFields 없으면:
 *   - Row 클릭 = onClick (기존 modal 진입 하위 호환)
 */
import { useState } from 'react'

export interface DetailField {
  label: string
  value: string
  /** 값 옆 [📋] 노출 (default true) */
  copyable?: boolean
  /** mono 폰트 (자격번호·날짜·학점 등) */
  mono?: boolean
}

interface Props {
  emoji: string
  title: string
  meta?: string
  /** 우측 액션 (배지·X 버튼 등). 없으면 chevron 만 */
  rightSlot?: React.ReactNode
  /** Row 클릭 액션 — detailFields 있으면 expand 토글, 없으면 이 콜백 (하위 호환) */
  onClick: () => void
  /** 강조 (active·hover) 색 — brand·accent·warning 등 */
  accent?: 'brand' | 'accent' | 'warning' | 'success' | 'info' | 'violet'
  /** title 옆 카테고리 chip (예: 학교 단계 "학사" · "석사") */
  badge?: string
  /** 펼침 body 필드들. 있으면 Row 클릭 = expand, 우상단 ✏️ 편집 icon = onEdit */
  detailFields?: DetailField[]
  /** 편집 icon 클릭 시 (modal 진입) */
  onEdit?: () => void
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

const ACCENT_BADGE: Record<NonNullable<Props['accent']>, string> = {
  brand: 'bg-brand/15 text-brand border-brand/25',
  accent: 'bg-accent/15 text-accent border-accent/25',
  warning: 'bg-warning/15 text-warning border-warning/25',
  success: 'bg-success/15 text-success border-success/25',
  info: 'bg-info/15 text-info border-info/25',
  violet: 'bg-violet/15 text-violet border-violet/25',
}

export function MyInfoItemRow({
  emoji,
  title,
  meta,
  rightSlot,
  onClick,
  accent = 'brand',
  badge,
  detailFields,
  onEdit,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const hasDetail = !!detailFields && detailFields.length > 0

  const handleRowClick = () => {
    if (hasDetail) setExpanded((v) => !v)
    else onClick()
  }

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(key)
      setTimeout(() => setCopiedField(null), 900)
    } catch { /* ignore */ }
  }

  return (
    <div className={`bg-surface-2 border ${expanded ? `border-brand/40` : `border-line ${ACCENT_HOVER[accent]}`} rounded-xl overflow-hidden transition-all`}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleRowClick()
          }
        }}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-3 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 text-left"
      >
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${ACCENT_EMOJI_BG[accent]}`}>
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="text-sm font-semibold text-text-primary truncate">{title}</div>
            {badge && (
              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ACCENT_BADGE[accent]}`}>
                {badge}
              </span>
            )}
          </div>
          {meta && (
            <div className="text-[11px] text-text-tertiary truncate mt-0.5">{meta}</div>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            aria-label="편집"
            title="편집"
            className="shrink-0 w-11 h-11 flex items-center justify-center text-text-quaternary hover:text-brand hover:bg-brand/10 rounded-md transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L10 4L4 10H2V8L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {rightSlot ?? (hasDetail ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`shrink-0 text-text-quaternary transition-transform ${expanded ? '' : '-rotate-90'}`} aria-hidden="true">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="text-text-quaternary group-hover:text-text-secondary transition-colors text-lg leading-none" aria-hidden="true">›</span>
        ))}
      </div>

      {hasDetail && expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-line/60">
          <div className="space-y-0.5">
            {detailFields!.filter((f) => f.value.trim().length > 0).map((f) => {
              const copyable = f.copyable !== false
              const isCopied = copiedField === f.label
              return (
                <div key={f.label} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-card">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-text-quaternary font-semibold tracking-wide">{f.label}</p>
                    <p className={`text-[13px] text-text-primary font-medium truncate ${f.mono ? 'font-mono tabular-nums' : ''}`}>{f.value}</p>
                  </div>
                  {copyable && (
                    <button
                      type="button"
                      onClick={() => copyText(f.value, f.label)}
                      aria-label={`${f.label} 복사`}
                      title="복사"
                      className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-md transition-colors ${
                        isCopied ? 'text-success bg-success/10' : 'text-text-quaternary hover:text-brand hover:bg-brand/10'
                      }`}
                    >
                      {isCopied ? (
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4.5" y="1" width="7.5" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2"/><path d="M1 4.5h3M1 4.5v7.5h7.5V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
