import { DdayList } from '@/components/dashboard/DdayList'
import type { DdayItem } from '@/api/dashboard'

interface TodayScheduleSectionProps {
  items: DdayItem[] | undefined
  isLoading: boolean
}

export function TodayScheduleSection({ items, isLoading }: TodayScheduleSectionProps) {
  const todayItems = items?.filter((it) => it.dday === 0)

  return (
    <section>
      <h2 className="text-text-primary text-base font-semibold mb-3">📆 오늘 일정</h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface-2 border border-white/6 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !todayItems || todayItems.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <p className="text-2xl mb-2">☕</p>
          <p className="text-text-tertiary text-xs">오늘 예정된 일정이 없어요</p>
        </div>
      ) : (
        <DdayList items={todayItems} isLoading={false} />
      )}
    </section>
  )
}
