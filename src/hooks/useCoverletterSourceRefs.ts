import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { coverletterSourceRefsApi } from '@/api/coverletterSourceRefs'
import type {
  CreateCoverletterSourceRefDto,
  GenerateAiDraftDto,
} from '@/types/coverletterSourceRef'

/**
 * F6 PR 1 — coverletter source-refs / ai-draft React Query hooks.
 * cache key: `['coverletter-source-refs', clId]` (per-coverletter).
 * ai-draft 응답 후 source-refs invalidate (AI 추천 ref 자동 저장됨).
 */

const key = (clId: string) => ['coverletter-source-refs', clId] as const

export function useCoverletterSourceRefs(clId: string, enabled = true) {
  return useQuery({
    queryKey: key(clId),
    queryFn: () => coverletterSourceRefsApi.list(clId),
    enabled,
  })
}

export function useCreateCoverletterSourceRef(clId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateCoverletterSourceRefDto) =>
      coverletterSourceRefsApi.create(clId, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(clId) }),
  })
}

export function useRemoveCoverletterSourceRef(clId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (refId: string) => coverletterSourceRefsApi.remove(clId, refId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(clId) }),
  })
}

export function useGenerateAiDraft(clId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: GenerateAiDraftDto) =>
      coverletterSourceRefsApi.generateDraft(clId, dto),
    onSuccess: () => {
      // AI 추천 ref 가 자동 저장되므로 source-refs 캐시 무효화 (출처 칩 즉시 갱신)
      qc.invalidateQueries({ queryKey: key(clId) })
      // application coverletter answer 도 변경됨 (answer 저장) — caller 가 적절히 invalidate
    },
  })
}
