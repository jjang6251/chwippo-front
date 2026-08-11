import type { AiCostEstimate, LlmFeature, MyAiQuotaRow } from '@/types/aiQuota'
import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const aiQuotaApi = {
  /** F6 PR 2 Phase 5 — 본인 모든 feature 의 사용량·한도. AiQuotaChip 가 사용. */
  getMyQuotas: () =>
    apiClient
      .get<{ data: MyAiQuotaRow[] }>('/me/ai-quotas')
      .then(unwrap),

  /**
   * 질문 은행 D2b — 예상 코인(예약치) 조회.
   *
   * 🔴 서버가 **화이트리스트한 feature 만** 통과한다 (`AI_COST_PUBLIC_FEATURES`).
   * 목록에 없는 값을 보내면 400 이다 — 화면에 "약 N코인" 을 그리는 자리가 생길 때
   * 백엔드 화이트리스트에 그 feature 를 먼저 추가해야 한다.
   */
  getMyAiCosts: (feature: LlmFeature) =>
    apiClient
      .get<{ data: AiCostEstimate }>(`/me/ai-costs?feature=${feature}`)
      .then(unwrap),
}
