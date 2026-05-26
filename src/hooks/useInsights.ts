import { useQuery } from '@tanstack/react-query'
import { insightsApi } from '@/api/insights'

/**
 * F6 PR 1 — `GET /activity/insights` hook.
 * 백엔드 5분 in-memory cache + React Query 5분 staleTime → 사용자 sub-tab 전환 시 추가 호출 없음.
 */
export function useInsights() {
  return useQuery({
    queryKey: ['activity-insights'],
    queryFn: () => insightsApi.get(),
    staleTime: 5 * 60 * 1000, // 5min
  })
}
