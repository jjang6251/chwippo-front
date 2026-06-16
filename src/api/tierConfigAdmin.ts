import { apiClient } from '@/api/client'
import type { CoinTier } from '@/types/coinSystem'

/**
 * PR_B2 Phase 3 — admin tier_configs 매트릭스 수정 API.
 */

export interface TierConfig {
  tier: CoinTier
  monthlyCoinLimit: string
  inputTokenCapPerCall: number
  defaultCooldownSeconds: number
  companyResearchDailyCap: number
  noteSummaryCooldownMinutes: number
  priceKrw: number | null
  active: boolean
  updatedAt: string
}

export interface UpdateTierConfigDto {
  monthlyCoinLimit?: number
  inputTokenCapPerCall?: number
  defaultCooldownSeconds?: number
  companyResearchDailyCap?: number
  noteSummaryCooldownMinutes?: number
  priceKrw?: number
  active?: boolean
  applyMode: 'immediate' | 'next_reset'
}

export interface TierConfigPreview {
  affectedUsers: number
  sample: Array<{ userId: string; balance: number }>
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data

export const tierConfigAdminApi = {
  listAll: () =>
    apiClient.get<{ data: TierConfig[] }>('/admin/tier-configs').then(unwrap),

  getOne: (tier: CoinTier) =>
    apiClient.get<{ data: TierConfig }>(`/admin/tier-configs/${tier}`).then(unwrap),

  getPreview: (tier: CoinTier) =>
    apiClient
      .get<{ data: TierConfigPreview }>(`/admin/tier-configs/${tier}/preview`)
      .then(unwrap),

  update: (tier: CoinTier, dto: UpdateTierConfigDto) =>
    apiClient
      .patch<{
        data: { updated: TierConfig; affectedUsers: number }
      }>(`/admin/tier-configs/${tier}`, dto)
      .then(unwrap),
}
