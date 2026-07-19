import type { ReactElement } from 'react'
import type { BoardView } from '@/utils/boardViewGroups'

interface Props {
  value: BoardView
  onChange: (view: BoardView) => void
  className?: string
}

/** 목업 SVG 재현 — 카드(2x2 그리드) · 리스트(가로 바 3) · 그룹(헤더 바 + 들여쓴 바 3). */
const ICONS: Record<BoardView, ReactElement> = {
  card: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.2" />
      <rect x="9" y="1" width="6" height="6" rx="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" />
    </svg>
  ),
  list: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2.4" rx="1.2" />
      <rect x="1" y="6.8" width="14" height="2.4" rx="1.2" />
      <rect x="1" y="11.6" width="14" height="2.4" rx="1.2" />
    </svg>
  ),
  group: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="14" height="3" rx="1" />
      <rect x="3" y="6" width="12" height="2" rx="1" />
      <rect x="3" y="9.5" width="12" height="2" rx="1" />
      <rect x="3" y="13" width="12" height="2" rx="1" />
    </svg>
  ),
}

const OPTIONS: { key: BoardView; label: string }[] = [
  { key: 'card', label: '카드' },
  { key: 'list', label: '리스트' },
  { key: 'group', label: '그룹' },
]

export function BoardViewToggle({ value, onChange, className = '' }: Props) {
  return (
    <div
      role="group"
      aria-label="보기 방식"
      className={`flex flex-none rounded-lg border border-line overflow-hidden ${className}`}
    >
      {OPTIONS.map((opt, i) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            aria-label={`${opt.label} 보기`}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap transition-colors
              ${i > 0 ? 'border-l border-line' : ''}
              ${active
                ? 'bg-surface-3 text-text-primary font-medium'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-card'
              }`}
          >
            {ICONS[opt.key]}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
