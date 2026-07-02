import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { getGrowthMetrics } from '@/api/dashboard'

/**
 * 회고=성장 페이지 Phase A — 이번 달 vs 지난 달 활동량 + 개인 funnel.
 *
 * - staleTime 5min: 백엔드 5분 캐시 동일 주기
 * - 401·503 retry off
 */
export function useGrowthMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'growth-metrics'],
    queryFn: getGrowthMetrics,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof AxiosError) {
        const s = error.response?.status
        if (s === 401 || s === 503) return false
      }
      return failureCount < 1
    },
  })
}
