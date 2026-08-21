import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/myinfo'

/**
 * 🔴 `useMyinfo.ts` 의 `STORAGE_KEY` 와 **같은 키**여야 한다 (양쪽에서 무효화한다).
 * 훅 밖(mutation onSuccess)에서도 밀어야 해서 내보낸다 — 세 번째 사본을 만들지 않는다.
 */
export const storageUsageKey = ['myinfo', 'storage-usage'] as const

export function useStorageUsage() {
  return useQuery({
    queryKey: storageUsageKey,
    queryFn: api.getStorageUsage,
    staleTime: 30_000, // 30초 캐시 — 다른 mutation에서 invalidate로 강제 갱신
  })
}

/**
 * 파일 업로드·삭제·항목 추가/삭제 등 사용량이 변하는 작업 후 호출해 캐시 무효화.
 * mutation의 onSuccess에서 사용.
 *
 * 🔴 `useCallback` 으로 **참조를 고정한다** — 노트 이미지 업로더처럼 `useCallback` 안에
 * 들어가는 호출부가 있어서, 매 렌더 새 함수를 주면 그 memo 가 통째로 무의미해진다.
 */
export function useInvalidateStorageUsage() {
  const qc = useQueryClient()
  return useCallback(() => qc.invalidateQueries({ queryKey: storageUsageKey }), [qc])
}
