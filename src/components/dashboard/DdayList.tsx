import { useNavigate } from 'react-router-dom'
import type { DdayItem } from '@/api/dashboard'
import { getDdayLabel, getDdayVariant } from '@/utils/dday'
import { getAvatarColor } from '@/utils/tags'

interface DdayListProps {
  items: DdayItem[] | undefined
  isLoading: boolean
}

const VARIANT_CLASS = {
  danger:  'text-danger',
  warning: 'text-warning',
  info:    'text-brand',
  muted:   'text-text-quaternary',
}

export function DdayList({ items, isLoading }: DdayListProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-surface-2 border border-white/6 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <p className="text-2xl mb-2">🗓️</p>
        <p className="text-text-tertiary text-xs">임박한 일정이 없어요</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const variant = getDdayVariant(item.dday)
        const avatarColor = getAvatarColor(item.companyName)
        return (
          <button
            key={i}
            onClick={() => navigate(`/board/${item.applicationId}`, { state: { from: 'dashboard' } })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-white/6 hover:border-white/12 hover:bg-[#1d1e20] transition-all text-left"
          >
            <div className={`flex-none w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${avatarColor}`}>
              {item.companyName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-text-primary text-xs font-medium truncate">{item.companyName}</p>
              <p className="text-text-quaternary text-[10px] truncate">
                {item.type === 'deadline' ? '서류 마감' : item.stepName}
              </p>
            </div>
            <span className={`text-xs font-mono font-semibold flex-none ${VARIANT_CLASS[variant]}`}>
              {getDdayLabel(item.dday)}
            </span>
          </button>
        )
      })}

      <button
        onClick={() => navigate('/board')}
        className="w-full text-center text-[11px] text-text-quaternary hover:text-text-tertiary pt-1 transition-colors"
      >
        전체 보기 →
      </button>
    </div>
  )
}
