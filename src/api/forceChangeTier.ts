import { apiClient } from '@/api/client'
import type { CoinTier } from '@/types/coinSystem'

/**
 * PR_B2 Phase 3 — admin 의 사용자 tier 강제 변경.
 */

export interface ForceChangeTierDto {
  newTier: CoinTier
  planExpiresAt?: string
  applyMode: 'immediate' | 'next_cycle'
  reason: string
}

export interface ForceChangeTierResponse {
  tier: CoinTier
  planExpiresAt: string | null
  applyMode: 'immediate' | 'next_cycle'
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data

export const forceChangeTierApi = {
  change: (userId: string, dto: ForceChangeTierDto) =>
    apiClient
      .patch<{ data: ForceChangeTierResponse }>(`/admin/users/${userId}/tier`, dto)
      .then(unwrap),
}
