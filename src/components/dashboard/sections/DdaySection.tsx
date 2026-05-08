import { DdayList } from '@/components/dashboard/DdayList'
import type { DdayItem } from '@/api/dashboard'

interface DdaySectionProps {
  items: DdayItem[] | undefined
  isLoading: boolean
}

export function DdaySection({ items, isLoading }: DdaySectionProps) {
  return (
    <section>
      <h2 className="text-text-primary text-sm font-semibold mb-3">📅 D-day 임박</h2>
      <DdayList items={items} isLoading={isLoading} />
    </section>
  )
}
