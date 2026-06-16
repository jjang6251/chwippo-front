import { useQuery } from '@tanstack/react-query'
import { aiUsageApi, type AiUsageQuery } from '@/api/aiUsage'

export function useAiUsageOverview(q: AiUsageQuery = {}) {
  return useQuery({
    queryKey: ['ai-usage', 'overview', q],
    queryFn: () => aiUsageApi.overview(q),
  })
}

export function useAiUsageByUser(q: AiUsageQuery = {}) {
  return useQuery({
    queryKey: ['ai-usage', 'by-user', q],
    queryFn: () => aiUsageApi.byUser(q),
  })
}

export function useAiUsageUserDetail(
  userId: string | undefined,
  q: AiUsageQuery = {},
) {
  return useQuery({
    queryKey: ['ai-usage', 'user-detail', userId, q],
    queryFn: () => aiUsageApi.userDetail(userId as string, q),
    enabled: !!userId,
  })
}

// ── F6 PR 2 Phase 5.3 — v2 메트릭 ──
export function useAiUsageByModel(q: AiUsageQuery = {}) {
  return useQuery({
    queryKey: ['ai-usage', 'v2', 'by-model', q],
    queryFn: () => aiUsageApi.byModel(q),
  })
}
export function useAiUsageByHour(q: AiUsageQuery = {}) {
  return useQuery({
    queryKey: ['ai-usage', 'v2', 'by-hour', q],
    queryFn: () => aiUsageApi.byHour(q),
  })
}
export function useAiUsageHallucination(q: AiUsageQuery = {}) {
  return useQuery({
    queryKey: ['ai-usage', 'v2', 'hallucination', q],
    queryFn: () => aiUsageApi.hallucination(q),
  })
}
export function useAiUsageCacheHit() {
  return useQuery({
    queryKey: ['ai-usage', 'v2', 'cache-hit'],
    queryFn: () => aiUsageApi.cacheHit(),
  })
}
export function useAiUsageMonthEstimate() {
  return useQuery({
    queryKey: ['ai-usage', 'v2', 'month-estimate'],
    queryFn: () => aiUsageApi.monthEstimate(),
  })
}
