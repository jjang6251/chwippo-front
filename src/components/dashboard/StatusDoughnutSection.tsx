import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useDashboardStreak } from '@/hooks/useDashboardStreak'
import type { ApplicationStatus } from '@/types/dashboardStreak'

/**
 * W3 — 지원 카드 status 분포 도넛 (recharts).
 *
 * - 5 status × 의미 토큰 색 (info/violet/warning/success/danger)
 * - 0건 → 빈 상태 메시지 ("아직 지원 카드가 없어요")
 * - 401·503 → 섹션 미렌더 (silent)
 */
const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string }
> = {
  IN_PROGRESS: { label: '작성 중', color: 'rgb(var(--info))' },
  APPLIED: { label: '지원 완료', color: 'rgb(var(--violet))' },
  INTERVIEW: { label: '면접', color: 'rgb(var(--warning))' },
  PASSED: { label: '합격', color: 'rgb(var(--success))' },
  FAILED: { label: '불합격', color: 'rgb(var(--danger))' },
}

const STATUS_ORDER: ApplicationStatus[] = [
  'IN_PROGRESS',
  'APPLIED',
  'INTERVIEW',
  'PASSED',
  'FAILED',
]

export function StatusDoughnutSection() {
  const { data, isLoading, error } = useDashboardStreak()

  if (error || (!isLoading && !data)) return null
  if (isLoading) return <Skeleton />
  if (!data) return null

  const { statusDistribution } = data
  const total = statusDistribution.reduce((sum, s) => sum + s.count, 0)

  return (
    <section
      aria-labelledby="status-doughnut-heading"
      className="border border-line bg-surface-2 rounded-xl p-5"
    >
      <h2 id="status-doughnut-heading" className="text-text-primary text-sm font-semibold mb-4">
        지원 현황
      </h2>
      {total === 0 ? (
        <p className="text-text-quaternary text-xs text-center py-8">
          아직 지원 카드가 없어요.
        </p>
      ) : (
        <Doughnut statusDistribution={statusDistribution} total={total} />
      )}
    </section>
  )
}

function Doughnut({
  statusDistribution,
  total,
}: {
  statusDistribution: { status: ApplicationStatus; count: number }[]
  total: number
}) {
  // STATUS_ORDER 순서대로 정렬 + 0 인 status 도 표시 X (recharts pie 가 빈 슬라이스 어색)
  const map = new Map(statusDistribution.map((s) => [s.status, s.count]))
  const chartData = STATUS_ORDER.filter((status) => (map.get(status) ?? 0) > 0).map(
    (status) => ({
      status,
      label: STATUS_CONFIG[status].label,
      count: map.get(status) ?? 0,
      color: STATUS_CONFIG[status].color,
    }),
  )

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div
        className="w-full sm:w-1/2 h-[180px]"
        role="img"
        aria-label={`지원 카드 status 분포 — 총 ${total}건. ${chartData.map((d) => `${d.label} ${d.count}건`).join(', ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="label"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              // 도넛 위쪽 고정 — chart 영역 밖이라 slice 가림 X
              wrapperStyle={{
                top: 0,
                left: '50%',
                transform: 'translate(-50%, -110%)',
                pointerEvents: 'none',
              }}
              position={{ x: 0, y: 0 }}
              contentStyle={{
                backgroundColor: 'rgb(var(--surface))',
                border: '1px solid rgb(var(--line))',
                borderRadius: '8px',
                fontSize: '12px',
                padding: '6px 10px',
              }}
              formatter={(value, name) => [`${value as number}건`, name as string]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full sm:w-1/2 space-y-1.5">
        {chartData.map((entry) => {
          const pct = Math.round((entry.count / total) * 100)
          return (
            <div key={entry.status} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-text-secondary">{entry.label}</span>
              </div>
              <span className="text-text-primary font-mono">
                {entry.count}건 <span className="text-text-quaternary">({pct}%)</span>
              </span>
            </div>
          )
        })}
        <div className="border-t border-line pt-1.5 mt-2 flex items-center justify-between text-xs">
          <span className="text-text-secondary">총</span>
          <span className="text-text-primary font-mono font-semibold">{total}건</span>
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="border border-line bg-surface-2 rounded-xl p-5">
      <div className="h-4 w-24 bg-card animate-pulse rounded mb-4" />
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 rounded-full bg-card animate-pulse" />
        <div className="flex-1 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 bg-card animate-pulse rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

