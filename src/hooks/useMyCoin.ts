import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { coinApi } from '@/api/coin'

const QUERY_KEY = ['me', 'coin-balance'] as const

/**
 * PR_B1b — 본인 코인 잔여 + tier + next_reset.
 *
 * 헤더 CoinChip + 호출 후 toast (잔여 갱신) + 코인 부족 modal 등에서 공유.
 * React Query dedup. staleTime 5초 (호출 직후 빠른 refetch 위해 짧게).
 *
 * **invalidate 시점**:
 * - 자소서·면접·답변·노트요약·회사조사 mutation onSuccess
 * - 사용자가 chip 클릭 시 (수동 refetch)
 */
export function useMyCoinBalance() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: coinApi.getMyBalance,
    staleTime: 5_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
}

/** Onboarding modal 닫기 → users.onboarded_coin_at = NOW */
export function useSetCoinOnboarded() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: coinApi.setOnboarded,
    onSuccess: () => {
      // user 정보 invalidate (refresh response 의 onboardedCoinAt 갱신)
      qc.invalidateQueries({ queryKey: ['auth', 'user'] })
    },
  })
}
