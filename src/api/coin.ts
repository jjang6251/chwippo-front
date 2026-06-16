import type { CoinBalance } from '@/types/coinSystem'
import { apiClient } from './client'

/**
 * PR_B1b — 본인 코인 정보 + onboarding 상태.
 *
 * **GET /me/coin-balance**: 잔여 + tier + next_reset. 신규 user → 백엔드 자동 createInitialBalance 후 150 반환.
 * **POST /me/coin-onboarded**: onboarding modal 닫음 → users.onboarded_coin_at = NOW.
 *
 * **응답 unwrap**: backend 의 global ResponseTransformInterceptor 가 `{ data: {...} }` 로 wrap.
 *   frontend 는 한 번 더 풀어 실제 payload 만 반환 (다른 api 들과 일관).
 */
const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const coinApi = {
  getMyBalance: () =>
    apiClient
      .get<{ data: CoinBalance }>('/me/coin-balance')
      .then(unwrap),

  setOnboarded: () =>
    apiClient
      .post<{ data: { onboardedAt: string } }>('/me/coin-onboarded')
      .then(unwrap),
}
