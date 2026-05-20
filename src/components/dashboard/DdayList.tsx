import { useDemoNavigate } from '@/hooks/useDemoNavigate'
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
  const navigate = useDemoNavigate()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-surface-2 border border-line rounded-lg animate-pulse" />
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
      {items.map((item) => {
        const variant = getDdayVariant(item.dday)
        const avatarColor = getAvatarColor(item.companyName)
        return (
          <button
            key={`${item.applicationId ?? ''}-${item.type}-${item.stepId ?? ''}-${item.examId ?? ''}`}
            onClick={() => {
              if (item.type === 'exam') {
                navigate('/myinfo#exam-schedules')
              } else if (item.type === 'step' && item.stepId) {
                navigate(`/board/${item.applicationId}/steps/${item.stepId}`)
              } else if (item.applicationId) {
                navigate(`/board/${item.applicationId}`)
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-line hover:border-line-strong hover:bg-surface-3 transition-all text-left"
          >
            {/* 타입 아이콘 */}
            <div className={`flex-none w-8 h-8 rounded-lg flex items-center justify-center text-base ${item.type === 'exam' ? 'bg-violet/15 text-violet' : avatarColor}`}>
              {item.type === 'exam' ? '📚' : '📄'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-text-primary text-xs font-medium truncate">{item.companyName}</p>
              <p className="text-text-quaternary text-[10px] truncate">
                {item.type === 'exam'
                  ? `시험 일정${item.scheduledTime && item.scheduledTime !== '00:00' ? ` · ${item.scheduledTime}` : ''}`
                  : `${item.stepName}${item.scheduledTime && item.scheduledTime !== '00:00' ? ` · ${item.scheduledTime}` : ''}`}
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
