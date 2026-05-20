import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import type { DdayItem } from '@/api/dashboard'
import { getDdayLabel } from '@/utils/dday'

interface Props {
  item: DdayItem
}

export function DdayPinnedCard({ item }: Props) {
  const navigate = useDemoNavigate()

  const ddayLabel = getDdayLabel(item.dday)
  const isToday = item.dday === 0

  return (
    <button
      onClick={() => navigate(`/board/${item.applicationId}/steps/${item.stepId}`)}
      className="w-full text-left border border-brand/30 bg-brand/8 rounded-xl p-4 hover:bg-brand/12 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-brand text-xs font-semibold">{ddayLabel}</span>
            {isToday && (
              <span className="text-[10px] font-medium text-text-faint bg-brand/20 px-1.5 py-0.5 rounded-full">오늘</span>
            )}
          </div>
          <p className="text-text-primary text-sm font-semibold">{item.companyName}</p>
          <p className="text-text-quaternary text-xs">
            {item.stepName}
            {item.scheduledTime && item.scheduledTime !== '00:00' && ` · ${item.scheduledTime}`}
          </p>
        </div>
        <span className="text-brand text-lg shrink-0">📌</span>
      </div>

      <div className="bg-surface-2 rounded-lg px-3 py-2.5">
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-4 whitespace-pre-line">
          {item.pinnedContent}
        </p>
      </div>

      <p className="text-brand/60 text-[10px] mt-2 text-right">탭하여 전체 메모 보기 →</p>
    </button>
  )
}
