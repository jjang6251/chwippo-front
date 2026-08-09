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
/**
 * 🔴 `enabled` 를 받는다 (2026-08-09). `refetchOnMount: 'always'` 라 **마운트만 해도 무조건**
 * 요청이 나가는데, **AI 버튼을 안 그리는 화면에서는 그 값이 쓰이지 않는다** —
 * 면접 읽기 모드(코인 쓰는 버튼이 빠진 화면)와 랜딩이 그렇다.
 * 랜딩에서는 비로그인이라 401 → refresh 재시도까지 연쇄됐다(실측 7건).
 */
export function useMyAiQuotas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: aiQuotaApi.getMyQuotas,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  })
}

/** 단일 feature 의 quota row 추출 (없으면 undefined) */
export function useMyAiQuota(
  feature: LlmFeature,
  options?: { enabled?: boolean },
): MyAiQuotaRow | undefined {
  const { data } = useMyAiQuotas(options)
  return data?.find((r) => r.feature === feature)
}

/**
 * 부모 버튼 disabled 판단에 사용. quota 미로드 (undefined) 시 blocked=false (silent — 정상 동작).
 * Chip 과 같은 hook 호출이라 React Query dedup 으로 추가 fetch 없음.
 */
export function useAiQuotaBlocked(
  feature: LlmFeature,
  options?: { enabled?: boolean },
): { blocked: boolean; reason: string | null } {
  const quota = useMyAiQuota(feature, options)
  if (!quota) return { blocked: false, reason: null }
  if (!quota.enabled) return { blocked: true, reason: '🚧 일시 중단' }
  if (quota.nextAvailableAt && new Date(quota.nextAvailableAt) > new Date()) {
    return { blocked: true, reason: '⏳ 잠시 후 다시' }
  }
  if (quota.dayUsed >= quota.dayLimit) return { blocked: true, reason: '오늘 한도 소진' }
  if (quota.monthUsed >= quota.monthLimit) return { blocked: true, reason: '이번 달 한도 소진' }
  return { blocked: false, reason: null }
}
