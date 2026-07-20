import { Star } from 'lucide-react'

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
          : 'text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <Star
        size={iconSize}
        strokeWidth={1.5}
        fill={starred ? 'currentColor' : 'none'}
        aria-hidden="true"
      />
    </button>
  )
}
