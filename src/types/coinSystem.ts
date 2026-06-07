/**
 * PR_B1b — 치뽀 코인 시스템 타입.
 * 백엔드 `tier_configs` + `user_coin_balances` 와 1:1.
 */

export type CoinTier = 'free' | 'lite' | 'standard'

export interface CoinBalance {
  /** 현재 잔여 코인. 음수 허용 (마이너스 carry-over) */
  balance: number
  tier: CoinTier
  /** 다음 reset 시각 ISO string */
  nextResetAt: string
  /** tier 의 월 한도 (chip 분모 표시용) */
  monthlyCoinLimit: number
  /** 회사 조사 일 cap (tier 별 — Free 2 / Lite 5 / Standard 10) */
  companyResearchDailyCap: number
  /** PR_B2 Phase 1 — Q13 정지 상태 (NULL 이면 정상) */
  suspendedAt?: string | null
  suspendReason?: string | null
  suspendExpiresAt?: string | null
  /** PR_B2 Phase 1 — Q24 사용자 통지 */
  pendingNotification?: {
    type: 'coin_grant' | 'coin_revoke' | 'matrix_change' | 'tier_downgrade' | 'tier_upgrade'
    title: string
    body: string
    createdAt: string
  } | null
}

export const TIER_LABEL: Record<CoinTier, string> = {
  free: 'Free',
  lite: 'Lite',
  standard: 'Standard',
}

export const TIER_PRICE_KRW: Record<CoinTier, number> = {
  free: 0,
  lite: 4900,
  standard: 9900,
}
