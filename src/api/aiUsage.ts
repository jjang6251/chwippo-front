import { apiClient } from './client'
import type {
  AiUsageByUserRow,
  AiUsageCallLog,
  AiUsageOverview,
} from '@/types/aiUsage'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface AiUsageQuery {
  startDate?: string
  endDate?: string
  feature?: string
}

export const aiUsageApi = {
  overview: (q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: AiUsageOverview }>('/admin/ai-usage', { params: q })
      .then(unwrap),

  byUser: (q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: AiUsageByUserRow[] }>('/admin/ai-usage/users', { params: q })
      .then(unwrap),

  userDetail: (userId: string, q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: AiUsageCallLog[] }>(`/admin/ai-usage/users/${userId}`, {
        params: q,
      })
      .then(unwrap),

  // ── F6 PR 2 Phase 5.3 — v2 메트릭 ──
  byModel: (q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: ByModelRow[] }>('/admin/ai-usage/v2/by-model', { params: q })
      .then(unwrap),
  byHour: (q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: ByHourRow[] }>('/admin/ai-usage/v2/by-hour', { params: q })
      .then(unwrap),
  hallucination: (q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: HallucinationRow[] }>('/admin/ai-usage/v2/hallucination', {
        params: q,
      })
      .then(unwrap),
  cacheHit: () =>
    apiClient
      .get<{ data: CacheHitResponse }>('/admin/ai-usage/v2/cache-hit')
      .then(unwrap),
  monthEstimate: () =>
    apiClient
      .get<{ data: MonthEstimateResponse }>('/admin/ai-usage/v2/month-estimate')
      .then(unwrap),
  /**
   * 기능별 **이달 누적 / 이달 예상** (KST 월 경계).
   *
   * 🔴 `overview` 와 **다른 엔드포인트**인 이유: overview 는 사용자가 고른 기간(1d·7d·30d)을
   * 보는데, 「이달 얼마 나갔나」는 그 기간과 무관한 **고정 창**이다. 한 응답에 섞으면
   * 기간 필터를 바꿀 때마다 월 숫자가 따라 움직이는 것처럼 보인다.
   */
  featureMonth: () =>
    apiClient
      .get<{ data: FeatureMonthResponse }>('/admin/ai-usage/v2/feature-month')
      .then(unwrap),
}

export interface ByModelRow {
  provider: string
  model: string
  calls: number
  costUsd: number
}
export interface ByHourRow {
  hour: string
  calls: number
  costUsd: number
}
export interface HallucinationRow {
  feature: string
  total: number
  redacted: number
  ratio: number
}
export interface CacheHitResponse {
  noteSummary: { totalLogs: number; withSummary: number; ratio: number }
  companyResearch: {
    cacheRows: number
    totalHits: number
    avgHitsPerRow: number
  }
}
/** 한 기능의 이달 비용 (USD) — `avgCostPerCall` 은 호출 0 건이면 `null` (나눌 수가 없다) */
export interface FeatureMonthRow {
  feature: string
  calls: number
  monthToDateCost: number
  monthProjectedCost: number
  avgCostPerCall: number | null
}

export interface FeatureMonthResponse {
  /** 이달 시작 (KST) */
  monthStart: string
  daysElapsed: number
  daysInMonth: number
  rows: FeatureMonthRow[]
}

export interface MonthEstimateResponse {
  monthStart: string
  daysElapsed: number
  daysInMonth: number
  cumulativeCostUsd: number
  estimatedMonthEndUsd: number
}
