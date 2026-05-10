import { useQuery } from '@tanstack/react-query'
import { getDashboardStats, getDdayList, getInterviewReview } from '@/api/dashboard'

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

export function useInterviewReview() {
  return useQuery({
    queryKey: ['dashboard', 'interview-review'],
    queryFn: getInterviewReview,
  })
}
