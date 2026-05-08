import { StatCard } from '@/components/dashboard/StatCard'
import type { DashboardStats } from '@/api/dashboard'

interface StatsSectionProps {
  stats: DashboardStats | undefined
  isLoading: boolean
}

export function StatsSection({ stats, isLoading }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        label="전체 지원"
        value={stats?.total}
        icon="📋"
        description="서류부터 최종까지 진행 중인 기업"
        filterKey="all"
        accent="brand"
        isLoading={isLoading}
      />
      <StatCard
        label="면접 진행중"
        value={stats?.interviews}
        icon="🗓️"
        description="현재 면접 단계에 있는 기업"
        filterKey="IN_PROGRESS"
        accent="warning"
        isLoading={isLoading}
      />
      <StatCard
        label="최종 합격"
        value={stats?.passed}
        icon="🎉"
        description="합격이 확정된 기업"
        filterKey="PASSED"
        accent="success"
        isLoading={isLoading}
      />
    </div>
  )
}
