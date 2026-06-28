import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { getCompanyDetails } from '@/api/companies'

/**
 * W2 — DART 회사 정보 (BoardDetail "회사 정보" 섹션).
 *
 * - 매핑되지 않은 회사명 (DART corp_code 없음) → 404. retry 안 함, error.status=404 로 UI 가 섹션 미렌더.
 * - 메모리 90일 캐시 (backend) + React Query staleTime 1h → 같은 회사 반복 진입 시 0 호출.
 * - enabled 옵션 — 회사명 비어있으면 disabled.
 */
export function useCompanyDetails(companyName: string | undefined | null) {
  const trimmed = (companyName ?? '').trim()
  return useQuery({
    queryKey: ['companies', 'details', trimmed],
    queryFn: () => getCompanyDetails(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 60 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof AxiosError && (error.response?.status === 404 || error.response?.status === 503)) {
        return false
      }
      return failureCount < 1
    },
  })
}
