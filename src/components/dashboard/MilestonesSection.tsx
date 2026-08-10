import { ClipboardList, Mic, PenLine, NotebookPen, type LucideIcon } from 'lucide-react'
import { useGrowthMetrics } from '@/hooks/useGrowthMetrics'
import type { GrowthMetricsResponse } from '@/api/dashboard'

/**
 * 회고=성장 페이지 Phase A — 개인 마일스톤.
 *
 * 임계값 기반 배지 산출 (프론트 로직 — 백엔드는 원시 count 만 반환).
 * 항상 뭔가 표시 (신규 사용자엔 "다음 목표" 강조 · 성과 없는 상태에서도 sparse 안 보이게).
 *
 * 확장 가이드: MILESTONES 배열에 항목 추가만 하면 자동 렌더.
 */

interface MilestoneDef {
  id: string
  /** 기능 아이콘은 lucide 컴포넌트, 감정 아이콘(🌱💪🎉🔥)은 이모지 문자열 유지 */
  icon: LucideIcon | string
  label: string
  /** 이 값 도달 시 달성 */
  threshold: number
  /** GrowthMetricsResponse.milestoneCounts 필드 이름 */
  countField: keyof GrowthMetricsResponse['milestoneCounts']
}

const MILESTONES: MilestoneDef[] = [
  { id: 'first_application', icon: '🌱',           label: '첫 지원 완료',       threshold: 1,  countField: 'applications' },
  { id: 'apps_5',            icon: ClipboardList,  label: '5개 지원 달성',       threshold: 5,  countField: 'applications' },
  { id: 'apps_10',           icon: '💪',           label: '10개 지원 달성',      threshold: 10, countField: 'applications' },
  { id: 'first_interview',   icon: Mic,            label: '첫 면접 도달',        threshold: 1,  countField: 'reachedInterview' },
  { id: 'first_pass',        icon: '🎉',           label: '첫 합격!',            threshold: 1,  countField: 'passed' },
  { id: 'logs_10',           icon: PenLine,        label: '활동일지 10개 작성',  threshold: 10, countField: 'activityLogs' },
  { id: 'logs_30',           icon: '🔥',           label: '활동일지 30개 작성',  threshold: 30, countField: 'activityLogs' },
  { id: 'reflections_5',     icon: NotebookPen,    label: '회고 5개 작성',       threshold: 5,  countField: 'reflections' },
]

export function MilestonesSection() {
  const { data, isLoading, error } = useGrowthMetrics()

  if (error || (!isLoading && !data)) return null
  if (isLoading) return <Skeleton />
  if (!data) return null

  const counts = data.milestoneCounts

  const achieved = MILESTONES.filter((m) => counts[m.countField] >= m.threshold)
  const nextTarget = MILESTONES.find(
    (m) => counts[m.countField] < m.threshold,
  )

  // 다 달성한 극단 케이스 - achieved 도 다 표시하되 다음 목표 없음 표시
  const allDone = !nextTarget

  return (
    <section
      aria-labelledby="milestones-heading"
      className="border border-line bg-surface-2 rounded-xl p-5"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="milestones-heading" className="text-text-primary text-sm font-semibold">
          내 마일스톤
        </h2>
        <span className="text-text-quaternary text-[10px] tabular-nums">
          {achieved.length} / {MILESTONES.length}
        </span>
      </div>

      {/* 다음 목표 — 항상 상단 강조 (신규 사용자엔 첫 지원, 진행 중엔 다음 챌린지) */}
      {!allDone && (
        <div className="mb-4 rounded-lg bg-brand/6 border border-brand/25 px-4 py-3">
          <div className="flex items-center gap-2">
            {typeof nextTarget.icon === 'string' ? (
              <span className="text-lg" aria-hidden="true">{nextTarget.icon}</span>
            ) : (
              <nextTarget.icon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-brand text-[10px] font-medium uppercase tracking-wider mb-0.5">
                다음 목표
              </p>
              <p className="text-text-primary text-sm font-semibold">
                {nextTarget.label}
              </p>
              <p className="text-text-tertiary text-[11px] mt-0.5 tabular-nums">
                진행 {counts[nextTarget.countField]} / {nextTarget.threshold}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 달성 배지 그리드 */}
      {achieved.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {achieved.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.id}
                className="bg-card border border-line rounded-lg p-2.5 flex flex-col items-center text-center"
                title={m.label}
              >
                {typeof Icon === 'string' ? (
                  <span className="text-xl mb-1" aria-hidden="true">{Icon}</span>
                ) : (
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="mb-1" />
                )}
                <p className="text-text-secondary text-[10px] font-medium leading-tight">
                  {m.label}
                </p>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-text-tertiary text-xs text-center py-3">
          아직 달성한 마일스톤이 없어요. 위 목표부터 도전해봐요.
        </p>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <section className="border border-line bg-surface-2 rounded-xl p-5">
      <div className="h-4 w-24 bg-line rounded animate-pulse mb-4" />
      <div className="mb-4 rounded-lg bg-surface-3 h-16 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-line rounded-lg h-16 animate-pulse" />
        ))}
      </div>
    </section>
  )
}
