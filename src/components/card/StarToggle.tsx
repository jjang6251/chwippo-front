interface StarToggleProps {
  starred: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function StarToggle({ starred, onToggle, size = 'sm', disabled }: StarToggleProps) {
  const btnSize = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9'
  const iconSize = size === 'sm' ? 14 : 16

  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onToggle() }}
      disabled={disabled}
      aria-label={starred ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      aria-pressed={starred}
      className={`
        ${btnSize} flex items-center justify-center rounded-md transition-colors
        ${starred
          ? 'text-warning hover:bg-warning/10'
          : 'text-text-quaternary hover:text-text-secondary hover:bg-white/6'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M8 1.5l2.06 4.18 4.61.67-3.34 3.25.79 4.6L8 12.02l-4.12 2.18.79-4.6L1.33 6.35l4.61-.67L8 1.5z" />
      </svg>
    </button>
  )
}
