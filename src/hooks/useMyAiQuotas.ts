import { useQuery } from '@tanstack/react-query'
import { aiQuotaApi } from '@/api/aiQuota'
import type { LlmFeature, MyAiQuotaRow } from '@/types/aiQuota'

const QUERY_KEY = ['me', 'ai-quotas'] as const

/**
 * F6 PR 2 Phase 5.1 + 5.6.x — 본인 AI feature 한도·사용량.
 *
 * 5곳 (자소서·면접·꼬리·회사조사·노트요약) 에서 공유. React Query 가 같은 queryKey 자동 dedup
 * (동시 mount 시 1 request).
 *
 * **staleTime=0 + refetchOnMount + refetchOnWindowFocus** — admin 가 한도 변경 시 다른
 * 페이지에서 즉시 반영 + 페이지 전환 후에도 최신 사용량 표시 (이전 캐시로 "리셋" 보이는 버그 fix).
 */
export function useMyAiQuotas() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: aiQuotaApi.getMyQuotas,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}

/** 단일 feature 의 quota row 추출 (없으면 undefined) */
export function useMyAiQuota(feature: LlmFeature): MyAiQuotaRow | undefined {
  const { data } = useMyAiQuotas()
  return data?.find((r) => r.feature === feature)
}

/**
 * 부모 버튼 disabled 판단에 사용. quota 미로드 (undefined) 시 blocked=false (silent — 정상 동작).
 * Chip 과 같은 hook 호출이라 React Query dedup 으로 추가 fetch 없음.
 */
export function useAiQuotaBlocked(feature: LlmFeature): { blocked: boolean; reason: string | null } {
  const quota = useMyAiQuota(feature)
  if (!quota) return { blocked: false, reason: null }
  if (!quota.enabled) return { blocked: true, reason: '🚧 일시 중단' }
  if (quota.nextAvailableAt && new Date(quota.nextAvailableAt) > new Date()) {
    return { blocked: true, reason: '⏳ 잠시 후 다시' }
  }
  if (quota.dayUsed >= quota.dayLimit) return { blocked: true, reason: '오늘 한도 소진' }
  if (quota.monthUsed >= quota.monthLimit) return { blocked: true, reason: '이번 달 한도 소진' }
  return { blocked: false, reason: null }
}
