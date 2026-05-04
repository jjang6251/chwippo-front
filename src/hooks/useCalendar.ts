import { useQuery } from '@tanstack/react-query'
import { getCalendarEvents } from '@/api/calendar'

export function useCalendarEvents(year: number, month: number) {
  return useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => getCalendarEvents(year, month),
    staleTime: 60_000,
  })
}
