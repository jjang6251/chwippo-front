import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/myinfo'

const QUERY_KEY = ['myinfo', 'storage-usage'] as const

export function useStorageUsage() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: api.getStorageUsage,
    staleTime: 30_000, // 30초 캐시 — 다른 mutation에서 invalidate로 강제 갱신
  })
}

/**
 * 파일 업로드·삭제·항목 추가/삭제 등 사용량이 변하는 작업 후 호출해 캐시 무효화.
 * mutation의 onSuccess에서 사용.
 */
export function useInvalidateStorageUsage() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: QUERY_KEY })
}
