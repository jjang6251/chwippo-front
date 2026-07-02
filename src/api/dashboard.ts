import { apiClient } from './client'
import type { DashboardStreakResponse } from '@/types/dashboardStreak'

export interface DashboardStats {
  total: number               // 지원한 회사 (IN_PROGRESS + PASSED + FAILED)
  inProgress: number          // 진행 중
  interviewsAttended: number  // 면접 본 횟수 (면접 스텝 중 KST 날짜가 과거)
  passed: number              // 합격
}

/**
 * 캘린더 UX 재구성 — Hero CTA 라벨/링크 산출용.
 * - writing_coverletter → "자소서 이어 쓰기" → /board/:id/coverletter
 * - start_coverletter   → "자소서 시작하기" → /board/:id/coverletter
 * - review_company      → "회사 조사 확인" → /board/:id#company-research
 * - confirm_submit      → "최종 검토" → /board/:id
 * - no_action           → "카드 열기" → /board/:id (default)
 */
export type NextAction =
  | 'writing_coverletter'
  | 'start_coverletter'
  | 'review_company'
  | 'confirm_submit'
  | 'no_action'

export interface DdayItem {
  type: 'step' | 'exam'
  applicationId?: string
  stepId?: string
  examId?: string
  companyName: string
  stepName?: string
  date: string
  scheduledTime?: string
  dday: number
  pinnedContent?: string | null
  /** 캘린더 UX 재구성 — Hero CTA 산출용 (step 은 5 enum · exam 은 'no_action') */
  nextAction?: NextAction
  /** 캘린더 UX 재구성 — 자소서 진행률 (writing_coverletter · start_coverletter 등에서만) */
  progress?: { current: number; total: number }
  /** 캘린더 UX 재구성 — Hero 에 "공고 ↗" 링크 노출 (step 만, exam 은 undefined) */
  jobUrl?: string | null
  /** 캘린더 UX 재구성 — 회사 도메인 (favicon 로딩). backend CompaniesService lookup */
  domain?: string | null
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface InterviewReviewItem {
  stepId: string
  stepName: string
  applicationId: string
  companyName: string
}

export const getDashboardStats = () =>
  apiClient.get('/dashboard/stats').then(unwrap<DashboardStats>)

export const getDdayList = () =>
  apiClient.get('/dashboard/dday').then(unwrap<DdayItem[]>)

export const getInterviewReview = () =>
  apiClient.get('/dashboard/interview-review').then(unwrap<InterviewReviewItem[]>)

/**
 * W3 — 통합 streak + 365 heatmap + status 분포.
 * Backend 5분 in-memory 캐시. React Query staleTime 1h 추천.
 */
export const getDashboardStreak = () =>
  apiClient.get('/dashboard/streak').then(unwrap<DashboardStreakResponse>)

/**
 * 회고=성장 페이지 Phase A — 이번 달 vs 지난 달 활동량 + 개인 funnel.
 * Backend 5분 in-memory 캐시. staleTime 5min 추천.
 */
export interface MetricDelta {
  current: number
  previous: number
  delta: number
}

export type Weekday = '일' | '월' | '화' | '수' | '목' | '금' | '토'

export interface GrowthMetricsResponse {
  monthlyComparison: {
    currentYearMonth: string
    previousYearMonth: string
    applications: MetricDelta
    activityLogs: MetricDelta
    reflections: MetricDelta
  }
  funnel: {
    total: number
    reachedInterview: number
    passed: number
  }
  insights: {
    mostActiveWeekday: {
      weekday: Weekday
      count: number
      sharePercent: number
    } | null
    topJobCategory: {
      category: string
      count: number
    } | null
  }
  milestoneCounts: {
    applications: number
    reachedInterview: number
    passed: number
    activityLogs: number
    reflections: number
  }
}

export const getGrowthMetrics = () =>
  apiClient.get('/dashboard/growth-metrics').then(unwrap<GrowthMetricsResponse>)
