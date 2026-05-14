import { useQuery } from '@tanstack/react-query'
import { getActiveAnnouncement } from '@/api/announcements'

export function useActiveAnnouncement() {
  return useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: getActiveAnnouncement,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
