import { apiClient } from './client'

export interface ResetAiQuotaDto {
  /** undefined = 전체 사용자, UUID = 그 사용자만 */
  userId?: string
}

export interface ResetAiQuotaResult {
  affected: number
  scope: 'all_users' | 'single_user'
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/** F6 PR 2 Phase 5.6.9 — admin AI quota reset */
export const quotaResetApi = {
  reset: (dto: ResetAiQuotaDto) =>
    apiClient
      .post<{ data: ResetAiQuotaResult }>('/admin/ai-quota-reset', dto)
      .then(unwrap),
}
