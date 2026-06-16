import type { MyAiQuotaRow } from '@/types/aiQuota'
import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const aiQuotaApi = {
  /** F6 PR 2 Phase 5 — 본인 모든 feature 의 사용량·한도. AiQuotaChip 가 사용. */
  getMyQuotas: () =>
    apiClient
      .get<{ data: MyAiQuotaRow[] }>('/me/ai-quotas')
      .then(unwrap),
}
