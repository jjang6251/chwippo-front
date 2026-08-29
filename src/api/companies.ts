import { apiClient } from './client'
import type { AutocompleteCompany, CompanyDetails } from '@/types/company'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * W2 — 회사명 자동완성.
 *
 * - q 1+ char → DART JSON + 조사 시드 + 사용자 누적 통합 검색
 * - limit 11+ → 10 cap (backend)
 * - rate limit 분당 60회
 */
export const autocompleteCompanies = (
  q: string,
  limit = 10,
): Promise<AutocompleteCompany[]> => {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  params.set('limit', String(limit))
  return apiClient
    .get<{ data: AutocompleteCompany[] }>(`/companies/autocomplete?${params.toString()}`)
    .then(unwrap)
}

/**
 * W2 — DART 기반 회사 정보 (CEO·재무·공시).
 * 매핑되지 않은 회사명 → 404 (BoardDetail 에서 catch 후 섹션 미렌더).
 * 메모리 90일 캐시. 빈도 낮음 → React Query staleTime 1h.
 */
export const getCompanyDetails = (name: string): Promise<CompanyDetails> => {
  const params = new URLSearchParams({ name })
  return apiClient
    .get<{ data: CompanyDetails }>(`/companies/details?${params.toString()}`)
    .then(unwrap)
}
