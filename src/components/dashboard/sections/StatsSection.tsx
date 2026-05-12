import { StatCard } from '@/components/dashboard/StatCard'
import type { DashboardStats } from '@/api/dashboard'

interface StatsSectionProps {
  stats: DashboardStats | undefined
  isLoading: boolean
}

export function StatsSection({ stats, isLoading }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <StatCard
        label="지원한 회사"
        value={stats?.total}
        icon="📋"
        description="서류부터 최종까지 — 지원한 모든 기업"
        filterKey="all"
        accent="brand"
        isLoading={isLoading}
      />
      <StatCard
        label="진행 중"
        value={stats?.inProgress}
        icon="🔄"
        description="아직 결과를 기다리는 기업"
        filterKey="IN_PROGRESS"
        accent="neutral"
        isLoading={isLoading}
      />
      <StatCard
        label="면접 본 횟수"
        value={stats?.interviewsAttended}
        icon="🎤"
        description="지금까지 치른 면접 — 노력의 누적"
        accent="warning"
        isLoading={isLoading}
      />
      <StatCard
        label="합격"
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
