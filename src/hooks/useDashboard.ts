import { useQuery } from '@tanstack/react-query'
import { getDashboardStats, getDdayList } from '@/api/dashboard'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
  })
}

export function useDdayList() {
  return useQuery({
    queryKey: ['dashboard', 'dday'],
    queryFn: getDdayList,
  })
}
