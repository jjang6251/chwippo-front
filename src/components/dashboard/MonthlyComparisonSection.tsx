import { ClipboardList, PenLine, NotebookPen, type LucideIcon } from 'lucide-react'
import { useGrowthMetrics } from '@/hooks/useGrowthMetrics'
import type { MetricDelta } from '@/api/dashboard'

/**
 * 회고=성장 페이지 Phase A — 이번 달 vs 지난 달 활동량 비교.
 *
 * UX:
 *   - 3 지표 (지원 신규 · 활동일지 · 활동 회고) 각각 이번 달 값 + Δ vs 지난 달
 *   - Δ 색상: 양수 = success 강조. 음수·0 = 중립 (text-text-tertiary)
 *     ↳ 격려 톤 원칙: 하락도 붉은 warning 색으로 표시하면 취준생 심리에 부정적.
 *       Duolingo·습관 앱 표준 (증가 강조, 하락 중립).
 *   - 두 달 모두 0 이면 섹션 자체 hide (신규 사용자 소음 방지)
 *   - 401·503 silent hide (streak 패턴 동일)
 *   - 월 표기: "(KST)" 라벨 명시 (memory [[kst_local_date]] 준수)
 */
interface MetricRow {
  key: 'applications' | 'activityLogs' | 'reflections'
  label: string
  icon: LucideIcon
}

const METRICS: MetricRow[] = [
  { key: 'applications', label: '지원 카드 신규', icon: ClipboardList },
  { key: 'activityLogs', label: '활동일지 작성', icon: PenLine },
  { key: 'reflections', label: '활동 회고 작성', icon: NotebookPen },
]

export function MonthlyComparisonSection() {
  const { data, isLoading, error } = useGrowthMetrics()

  if (error || (!isLoading && !data)) return null
  if (isLoading) return <Skeleton />
  if (!data) return null

  const { monthlyComparison } = data
  const allZero = METRICS.every(
    (m) =>
      monthlyComparison[m.key].current === 0 &&
      monthlyComparison[m.key].previous === 0,
  )
  if (allZero) return null

  const [, currentMonth] = monthlyComparison.currentYearMonth.split('-')
  const [, prevMonth] = monthlyComparison.previousYearMonth.split('-')
  const curM = parseInt(currentMonth, 10)
  const prevM = parseInt(prevMonth, 10)

  return (
    <section
      aria-labelledby="monthly-comparison-heading"
      className="border border-line bg-surface-2 rounded-xl p-5"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="monthly-comparison-heading" className="text-text-primary text-sm font-semibold">
          이번 달 활동
        </h2>
        <span className="text-text-quaternary text-[10px] tabular-nums">
          {prevM}월 → {curM}월 (KST)
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {METRICS.map((m) => (
          <MetricCard
            key={m.key}
            label={m.label}
            icon={m.icon}
            data={monthlyComparison[m.key]}
          />
        ))}
      </div>
    </section>
  )
}

function MetricCard({
  label,
  icon: Icon,
  data,
}: {
  label: string
  icon: LucideIcon
  data: MetricDelta
}) {
  // 격려 톤 — 증가만 강조, 하락·유지는 중립. 취준생 심리 상 하락에 danger 붉은색 X.
  const deltaColor =
    data.delta > 0 ? 'text-success' : 'text-text-tertiary'
  const sign = data.delta > 0 ? '+' : data.delta < 0 ? '−' : ''
  const deltaAbs = Math.abs(data.delta)

  return (
    <div className="bg-card border border-line rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
        <span className="text-text-tertiary text-[11px]">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-text-primary text-2xl font-bold tabular-nums">
          {data.current}
        </span>
        <span className={`text-[11px] font-semibold tabular-nums ${deltaColor}`}>
          {sign}
          {deltaAbs}
        </span>
      </div>
      <p className="text-text-quaternary text-[10px] mt-1 tabular-nums">
        지난 달 {data.previous}
      </p>
    </div>
  )
}

function Skeleton() {
  return (
    <section className="border border-line bg-surface-2 rounded-xl p-5">
      <div className="h-4 w-24 bg-line rounded animate-pulse mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-line rounded-lg p-3 h-20 animate-pulse" />
        ))}
      </div>
    </section>
  )
}
