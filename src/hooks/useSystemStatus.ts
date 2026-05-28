import { useQuery } from '@tanstack/react-query'
import { systemStatusApi } from '@/api/systemStatus'

/** F6 PR 2 Phase 5.6.3 — admin 시스템 상태 (DB · provider key). 30초 refetch */
export function useSystemStatus() {
  return useQuery({
    queryKey: ['admin', 'system-status'],
    queryFn: systemStatusApi.get,
    refetchInterval: 30_000,
    staleTime: 25_000,
  })
}
