import { apiClient } from '@/api/client'

/**
 * PR_B2 Phase 2b — 신규 admin AI 사용량 metrics API (period 5 + 전기 비교).
 *
 * Backend endpoints:
 * - GET /admin/ai-usage?period&from&to
 * - GET /admin/ai-usage/top-users
 * - GET /admin/ai-usage/by-feature
 * - GET /admin/ai-usage/by-model
 */

export type AiUsagePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

export const AI_USAGE_PERIODS: Array<{ key: AiUsagePeriod; label: string }> = [
  { key: 'day', label: '일' },
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'quarter', label: '분기' },
  { key: 'year', label: '년' },
]

export interface AiUsageMetrics {
  period: AiUsagePeriod
  from: string
  to: string
  totalCostUsd: number
  totalCalls: number
  cacheHitRate: number
  errorRate: number
  delta: {
    previousCostUsd: number
    previousCalls: number
    costDeltaPct: number
    callsDeltaPct: number
  }
}

export interface AiUsageTopUser {
  userId: string
  nickname: string | null
  totalCostUsd: number
  totalCalls: number
}

export interface AiUsageByFeature {
  feature: string
  totalCostUsd: number
  totalCalls: number
}

export interface AiUsageByModel {
  model: string
  totalCostUsd: number
  totalCalls: number
}

export const aiUsageMetricsApi = {
  metrics: (period: AiUsagePeriod): Promise<AiUsageMetrics> =>
    apiClient
      .get<{ data: AiUsageMetrics }>('/admin/ai-usage', { params: { period } })
      .then((r) => r.data.data),

  topUsers: (period: AiUsagePeriod, limit = 20): Promise<AiUsageTopUser[]> =>
    apiClient
      .get<{ data: AiUsageTopUser[] }>('/admin/ai-usage/top-users', {
        params: { period, limit },
      })
      .then((r) => r.data.data),

  byFeature: (period: AiUsagePeriod): Promise<AiUsageByFeature[]> =>
    apiClient
      .get<{ data: AiUsageByFeature[] }>('/admin/ai-usage/by-feature', {
        params: { period },
      })
      .then((r) => r.data.data),

  byModel: (period: AiUsagePeriod): Promise<AiUsageByModel[]> =>
    apiClient
      .get<{ data: AiUsageByModel[] }>('/admin/ai-usage/by-model', {
        params: { period },
      })
      .then((r) => r.data.data),
}
