import { useGrowthMetrics } from '@/hooks/useGrowthMetrics'

/**
 * 회고=성장 페이지 Phase A — 개인 지원 funnel (지원 → 면접 도달 → 합격).
 *
 * UX:
 *   - 3단계 horizontal bar (전체 대비 %)
 *   - total=0 이면 섹션 hide
 *   - total<5 이면 "데이터 쌓이는 중" (통계로 신뢰하기엔 표본 부족)
 *   - 401·503 silent hide
 */
export function PersonalFunnelSection() {
  const { data, isLoading, error } = useGrowthMetrics()

  if (error || (!isLoading && !data)) return null
  if (isLoading) return <Skeleton />
  if (!data) return null

  const { funnel } = data
  if (funnel.total === 0) return null

  const passedPct =
    funnel.total > 0 ? Math.round((funnel.passed / funnel.total) * 100) : 0
  const interviewPct =
    funnel.total > 0
      ? Math.round((funnel.reachedInterview / funnel.total) * 100)
      : 0

  const stages = [
    {
      key: 'total',
      label: '지원',
      count: funnel.total,
      pct: 100,
      color: 'bg-text-secondary',
    },
    {
      key: 'interview',
      label: '면접 도달',
      count: funnel.reachedInterview,
      pct: interviewPct,
      color: 'bg-brand',
    },
    {
      key: 'passed',
      label: '합격',
      count: funnel.passed,
      pct: passedPct,
      color: 'bg-success',
    },
  ]

  const sparseData = funnel.total < 5

  return (
    <section
      aria-labelledby="personal-funnel-heading"
      className="border border-line bg-surface-2 rounded-xl p-5"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="personal-funnel-heading" className="text-text-primary text-sm font-semibold">
          나의 지원 흐름
        </h2>
        {sparseData && (
          <span className="text-text-quaternary text-[10px]">
            데이터 쌓이는 중
          </span>
        )}
      </div>
      <div className="space-y-3">
        {stages.map((stage) => (
          <div key={stage.key}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-text-secondary text-xs">{stage.label}</span>
              <span className="text-text-tertiary text-[11px] tabular-nums">
                <span className="text-text-primary font-semibold">{stage.count}</span>
                {stage.key !== 'total' && (
                  <span className="text-text-quaternary ml-1.5">{stage.pct}%</span>
                )}
              </span>
            </div>
            <div className="h-2 bg-line rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${stage.color}`}
                style={{ width: `${Math.max(stage.pct, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Skeleton() {
  return (
    <section className="border border-line bg-surface-2 rounded-xl p-5">
      <div className="h-4 w-24 bg-line rounded animate-pulse mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="h-3 w-full bg-line rounded animate-pulse mb-1.5" />
            <div className="h-2 w-full bg-surface-3 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  )
}
