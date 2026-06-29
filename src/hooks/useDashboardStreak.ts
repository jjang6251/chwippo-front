import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { getDashboardStreak } from '@/api/dashboard'

/**
 * W3 — Dashboard streak·heatmap·status 분포.
 *
 * - staleTime 1h: 백엔드 5분 캐시와 별개로 클라 측 polling 차단
 * - 401·503 retry off
 */
export function useDashboardStreak() {
  return useQuery({
    queryKey: ['dashboard', 'streak'],
    queryFn: getDashboardStreak,
    staleTime: 60 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof AxiosError) {
        const s = error.response?.status
        if (s === 401 || s === 503) return false
      }
      return failureCount < 1
    },
  })
}
