import type {
  FeatureQuotaConfig,
  LlmFeature,
  QuotaTier,
  UpdateFeatureQuotaDto,
} from '@/types/aiQuota'
import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/** F6 PR 2 Phase 5.2 — admin /ops/ai-quotas 페이지 전용 */
export const aiFeatureQuotasApi = {
  /** 전체 feature × tier 매트릭스 (admin 페이지 진입 시 일괄 로드) */
  listAll: () =>
    apiClient
      .get<{ data: FeatureQuotaConfig[] }>('/admin/ai-feature-quotas')
      .then(unwrap),

  update: (feature: LlmFeature, tier: QuotaTier, dto: UpdateFeatureQuotaDto) =>
    apiClient
      .patch<{ data: FeatureQuotaConfig }>(
        `/admin/ai-feature-quotas/${feature}/${tier}`,
        dto,
      )
      .then(unwrap),
}
