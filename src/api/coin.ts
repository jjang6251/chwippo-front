import type { CoinBalance } from '@/types/coinSystem'
import { apiClient } from './client'

/**
 * PR_B1b — 본인 코인 정보 + onboarding 상태.
 *
 * **GET /me/coin-balance**: 잔여 + tier + next_reset. 신규 user → 백엔드 자동 createInitialBalance 후 150 반환.
 * **POST /me/coin-onboarded**: onboarding modal 닫음 → users.onboarded_coin_at = NOW.
 */
export const coinApi = {
  getMyBalance: () =>
    apiClient.get<CoinBalance>('/me/coin-balance').then((r) => r.data),

  setOnboarded: () =>
    apiClient
      .post<{ onboardedAt: string }>('/me/coin-onboarded')
      .then((r) => r.data),
}
