import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getAdminStats } from '@/api/admin'

export function OpsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
    refetchInterval: 60_000,
  })

  const cards = [
    { label: '전체 사용자', value: data?.totalUsers ?? 0, color: 'text-brand' },
    { label: '이번 달 신규', value: data?.newUsersMonth ?? 0, color: 'text-success' },
    { label: '이번 주 신규', value: data?.newUsersWeek ?? 0, color: 'text-warning' },
    { label: '미답변 문의', value: data?.pendingInquiries ?? 0, color: 'text-danger' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">관리자</h1>
          <p className="text-sm text-text-muted mt-1">취뽀 운영 현황</p>
        </div>
        <span className="text-xs text-text-muted bg-surface-2 border border-white/5 px-3 py-1 rounded-full">admin</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {cards.map(({ label, value, color }) => (
          <div key={label} className="bg-surface-2 border border-white/5 rounded-xl p-4">
            <p className={`text-3xl font-bold tabular-nums ${color} ${isLoading ? 'opacity-30' : ''}`}>
              {value.toLocaleString()}
            </p>
            <p className="text-xs text-text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3">
        <Link
          to="/ops/inquiries"
          className="flex items-center justify-between bg-surface-2 border border-white/5 rounded-xl px-5 py-4 hover:border-white/15 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold">문의 관리</p>
            <p className="text-xs text-text-muted mt-0.5">
              미답변 문의 {data?.pendingInquiries ?? 0}건
            </p>
          </div>
          <span className="text-text-muted">›</span>
        </Link>
      </div>
    </div>
  )
}
