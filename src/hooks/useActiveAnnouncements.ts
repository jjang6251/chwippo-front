import { useQuery } from '@tanstack/react-query'
import { getActiveAnnouncements } from '@/api/announcements'

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: getActiveAnnouncements,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
