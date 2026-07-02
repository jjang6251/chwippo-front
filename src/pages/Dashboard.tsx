import { StatsSection } from '@/components/dashboard/sections/StatsSection'
import { StreakSection } from '@/components/dashboard/StreakSection'
import { StatusDoughnutSection } from '@/components/dashboard/StatusDoughnutSection'
import { InterviewReviewCard } from '@/components/dashboard/InterviewReviewCard'
import { MonthlyComparisonSection } from '@/components/dashboard/MonthlyComparisonSection'
import { PersonalFunnelSection } from '@/components/dashboard/PersonalFunnelSection'
import { InsightsSection } from '@/components/dashboard/InsightsSection'
import { MilestonesSection } from '@/components/dashboard/MilestonesSection'
import { useDashboardStats } from '@/hooks/useDashboard'
import { useDashboardStreak } from '@/hooks/useDashboardStreak'
import { useDashboardConfig } from '@/hooks/useDashboardConfig'
import { useAuthStore } from '@/stores/authStore'
import { useQueryClient } from '@tanstack/react-query'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/common/PullToRefreshIndicator'
import { dismissCalendarHomeIntro } from '@/api/users'

/**
 * 회고 = 성장 페이지 (Phase A "나 vs 나").
 *
 * 홈은 이제 /calendar. 이 페이지는 "지난 달보다 얼마나 성장했는지 돌아보는 곳".
 * 레이아웃 순서 (고정):
 *   1. Stats (4 KPI · 최상단)
 *   2. Milestones (다음 목표 + 달성 배지)               ← 항상 표시 · sparse 사용자 대응
 *   3. Monthly Comparison (이번 달 vs 지난 달 활동량)
 *   4. Insights (가장 활발한 요일 · 직군 등)            ← 표본 있으면 표시
 *   5. Streak + Doughnut (2-col grid 1.4fr : 1fr)
 *   6. Personal Funnel (지원 → 면접 → 합격)
 *   7. Interview Review (어제 면접 회고 유도)
 *
 * Phase A' (F8) — 스텝별 통과율 + 합격 이유 분석은 별도 PR.
 * Phase B (사용자 100+명 이후) — 유사 취준생 벤치마크는 후속 PR.
 * 섹션 visibility toggle 은 DashboardConfig 를 존중하되 순서는 고정.
 */
export function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const qc = useQueryClient()
  const pull = usePullToRefresh(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['applications'] }),
    ])
  })

  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: streak } = useDashboardStreak()
  const streakDays = streak?.streak.current ?? 0
  const { data: config } = useDashboardConfig()

  const showIntroBanner = user?.calendarHomeIntroDismissedAt == null

  function handleDismissIntro() {
    dismissCalendarHomeIntro().then(() => {
      if (user) setUser({ ...user, calendarHomeIntroDismissedAt: new Date().toISOString() })
    })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // 섹션 visibility — config 없으면 default true. 성장 재정의 후 goals·cover_letter_quick 는 제거됨.
  const visibleMap = new Map<string, boolean>()
  ;(config?.sections ?? []).forEach((s) => visibleMap.set(s.id, s.visible))
  const isVisible = (id: string) => visibleMap.get(id) ?? true

  const showStreak = isVisible('activity_streak')
  const showDoughnut = isVisible('status_doughnut')
  const showInterviewReview = isVisible('interview_review')
  const showMonthlyComparison = isVisible('monthly_comparison')
  const showPersonalFunnel = isVisible('personal_funnel')
  const showInsights = isVisible('insights')
  const showMilestones = isVisible('milestones')

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <PullToRefreshIndicator {...pull} />

      {/* 첫 방문 안내 배너 */}
      {showIntroBanner && (
        <div className="mb-4 lg:mb-6 rounded-xl bg-brand/6 border border-brand/20 px-4 py-2.5 flex items-center gap-3">
          <p className="text-xs text-text-secondary flex-1">
            이제 캘린더가 홈이에요. 여긴 성장을 돌아보는 곳이에요.
          </p>
          <button
            onClick={handleDismissIntro}
            aria-label="배너 닫기"
            className="w-6 h-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-secondary"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l6 6M9 3L3 9" />
            </svg>
          </button>
        </div>
      )}

      {/* 헤더 — 회고 페이지 */}
      <div className="mb-8">
        <p className="text-text-quaternary text-[11px] mb-1 tabular-nums">{year}</p>
        <div className="flex items-end justify-between gap-2">
          <h1 className="text-text-primary text-2xl font-bold tracking-tight">
            {month}월 <span className="text-text-tertiary font-medium">회고</span>
          </h1>
          {streakDays >= 2 && (
            <span
              className="text-[11px] font-medium text-brand tabular-nums"
              aria-label={`활동 ${streakDays}일 연속`}
            >
              🔥 {streakDays}일 연속
            </span>
          )}
        </div>
        <p className="text-text-tertiary text-xs mt-1.5">
          {user?.nickname
            ? `${user.nickname}님, 지난 달보다 얼마나 성장했는지 돌아봐요.`
            : '지난 달보다 얼마나 성장했는지 돌아봐요.'}
        </p>
      </div>

      {/* 1. Stats — 항상 최상단 고정 */}
      <div className="mb-6 bg-card border border-line rounded-xl p-4">
        <StatsSection stats={stats} isLoading={statsLoading} />
      </div>

      {/* 2. Milestones — 다음 목표 + 달성 배지 (항상 표시, sparse 사용자엔 CTA 역할) */}
      {showMilestones && (
        <div className="mb-6">
          <MilestonesSection />
        </div>
      )}

      {/* 3. Monthly Comparison — 이번 달 vs 지난 달 활동량 */}
      {showMonthlyComparison && (
        <div className="mb-6">
          <MonthlyComparisonSection />
        </div>
      )}

      {/* 4. Insights — 가장 활발한 요일 · 직군 등 (표본 있으면 표시) */}
      {showInsights && (
        <div className="mb-6">
          <InsightsSection />
        </div>
      )}

      {/* 5. Streak + Doughnut — 2-col grid */}
      {(showStreak || showDoughnut) && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          {showStreak && <StreakSection />}
          {showDoughnut && <StatusDoughnutSection />}
        </div>
      )}

      {/* 6. Personal Funnel — 지원 → 면접 → 합격 */}
      {showPersonalFunnel && (
        <div className="mb-6">
          <PersonalFunnelSection />
        </div>
      )}

      {/* 7. Interview Review — 어제 면접 회고 유도 */}
      {showInterviewReview && (
        <div className="mb-6">
          <InterviewReviewCard />
        </div>
      )}
    </div>
  )
}
