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
export interface MonthEstimateResponse {
  monthStart: string
  daysElapsed: number
  daysInMonth: number
  cumulativeCostUsd: number
  estimatedMonthEndUsd: number
}
