import { useQuery } from '@tanstack/react-query'
import {
  aiUsageMetricsApi,
  type AiUsagePeriod,
} from '@/api/aiUsageMetrics'

/**
 * PR_B2 Phase 2b — 신규 admin AI 사용량 metrics hooks.
 *
 * - useAiUsageMetricsPeriod — period 5 + 전기 비교
 * - useAiUsageTopUsersPeriod — top N user
 * - useAiUsageByFeaturePeriod — feature 별 group
 * - useAiUsageByModelPeriod — model 별 group
 */

export function useAiUsageMetricsPeriod(period: AiUsagePeriod) {
  return useQuery({
    queryKey: ['admin', 'ai-usage', 'metrics', period],
    queryFn: () => aiUsageMetricsApi.metrics(period),
  })
}

export function useAiUsageTopUsersPeriod(period: AiUsagePeriod, limit = 20) {
  return useQuery({
    queryKey: ['admin', 'ai-usage', 'top-users', period, limit],
    queryFn: () => aiUsageMetricsApi.topUsers(period, limit),
  })
}

export function useAiUsageByFeaturePeriod(period: AiUsagePeriod) {
  return useQuery({
    queryKey: ['admin', 'ai-usage', 'by-feature', period],
    queryFn: () => aiUsageMetricsApi.byFeature(period),
  })
}

export function useAiUsageByModelPeriod(period: AiUsagePeriod) {
  return useQuery({
    queryKey: ['admin', 'ai-usage', 'by-model', period],
    queryFn: () => aiUsageMetricsApi.byModel(period),
  })
}
