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
