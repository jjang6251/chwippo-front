import type { MyAiQuotaRow } from '@/types/aiQuota'
import { apiClient } from './client'

export const aiQuotaApi = {
  /** F6 PR 2 Phase 5 — 본인 모든 feature 의 사용량·한도. AiQuotaChip 가 사용. */
  getMyQuotas: () =>
    apiClient.get<MyAiQuotaRow[]>('/me/ai-quotas').then((r) => r.data),
}
