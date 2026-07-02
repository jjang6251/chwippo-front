import { useGrowthMetrics } from '@/hooks/useGrowthMetrics'

/**
 * 회고=성장 페이지 Phase A — 개인 인사이트 (분석가 톤).
 *
 * 백엔드가 threshold 만족 시만 값 반환 (표본 부족 = null). 프론트는 있는 인사이트만 렌더.
 * 모든 인사이트가 null 이면 섹션 hide.
 *
 * 확장 가이드: 백엔드 insights 필드 추가 시 이 배열에 정의만 추가.
 */
export function InsightsSection() {
  const { data, isLoading, error } = useGrowthMetrics()

  if (error || (!isLoading && !data)) return null
  if (isLoading) return <Skeleton />
  if (!data) return null

  const { insights } = data
  const items: { icon: string; label: string; value: string; hint?: string }[] = []

  if (insights.mostActiveWeekday) {
    items.push({
      icon: '📅',
      label: '가장 활발한 요일',
      value: `${insights.mostActiveWeekday.weekday}요일`,
      hint: `전체 활동의 ${insights.mostActiveWeekday.sharePercent}%`,
    })
  }
  if (insights.topJobCategory) {
    items.push({
      icon: '🎯',
      label: '가장 많이 지원한 직군',
      value: insights.topJobCategory.category,
      hint: `${insights.topJobCategory.count}건`,
    })
  }

  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="insights-heading"
      className="border border-line bg-surface-2 rounded-xl p-5"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="insights-heading" className="text-text-primary text-sm font-semibold">
          내 활동 패턴
        </h2>
        <span className="text-text-quaternary text-[10px]">패턴 분석</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="bg-card border border-line rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span aria-hidden="true">{item.icon}</span>
              <span className="text-text-tertiary text-[11px]">{item.label}</span>
            </div>
            <p className="text-text-primary text-lg font-bold tracking-tight">
              {item.value}
            </p>
            {item.hint && (
              <p className="text-text-quaternary text-[10px] mt-1 tabular-nums">
                {item.hint}
              </p>
            )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-line rounded-lg p-3 h-20 animate-pulse" />
        ))}
      </div>
    </section>
  )
}
