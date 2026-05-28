import { useQuery } from '@tanstack/react-query'
import { aiQuotaApi } from '@/api/aiQuota'
import type { LlmFeature, MyAiQuotaRow } from '@/types/aiQuota'

const QUERY_KEY = ['me', 'ai-quotas'] as const

/**
 * F6 PR 2 Phase 5.1 — 본인 AI feature 한도·사용량.
 *
 * 5곳 (자소서·면접·꼬리·회사조사·노트요약) 에서 공유. React Query 가 자동 dedup,
 * 5분 staleTime 으로 화면 전환 시 재호출 안 함.
 */
export function useMyAiQuotas() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: aiQuotaApi.getMyQuotas,
    staleTime: 5 * 60 * 1000,
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
