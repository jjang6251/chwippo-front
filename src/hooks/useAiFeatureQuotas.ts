import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiFeatureQuotasApi } from '@/api/aiFeatureQuotas'
import type {
  LlmFeature,
  QuotaTier,
  UpdateFeatureQuotaDto,
} from '@/types/aiQuota'

const QUERY_KEY = ['admin', 'ai-feature-quotas'] as const

/** F6 PR 2 Phase 5.2 — admin 매트릭스 전체 로드 (캐시 X 정책 — 변경 즉시 효과 검증 용이) */
export function useAiFeatureQuotas() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: aiFeatureQuotasApi.listAll,
    staleTime: 0,
  })
}

export function useUpdateAiFeatureQuota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      feature,
      tier,
      dto,
    }: {
      feature: LlmFeature
      tier: QuotaTier
      dto: UpdateFeatureQuotaDto
    }) => aiFeatureQuotasApi.update(feature, tier, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      // user 본인 quota 도 영향 받을 수 있어 함께 invalidate
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
    },
  })
}
