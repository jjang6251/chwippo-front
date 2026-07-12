import { apiClient } from './client'

// ─── 요약 ────────────────────────────────────────────────────────────────────

export interface ResearchVersionDist {
  version: string | null
  count: number
}

export interface ResearchSummary {
  /** companies.json 전체 회사 수 (커버리지 분모) */
  totalCompanies: number
  /** 조사(ai_research) 반영된 회사 수 (별칭 제외 — 커버리지 분자) */
  researchedCount: number
  /** 조사 반영된 전체 이름 수 (별칭 포함) */
  researchedNames: number
  /** researchedCount / totalCompanies (0~1) */
  coverageRate: number
  /** seed 버전별 분포 — 재시작 반영 확인용 */
  versionDistribution: ResearchVersionDist[]
  optOutCount: number
  /** 30일 내 만료 예정 */
  expiringSoonCount: number
  expiredCount: number
  /** ai_research 항목 평균 채움율 (0~1) — 구 metrics fill-rate 편입 */
  avgFillRate: number
}

// ─── 통합 목록 (조사 캐시 ∪ 지원 카드) ────────────────────────────────────────

export type ResearchFilter =
  | 'all'
  | 'unresearched'
  | 'expiring'
  | 'expired'
  | 'optout'
export type ResearchSort =
  | 'name'
  | 'applicants'
  | 'cards'
  | 'hitCount'
  | 'updatedAt'
  | 'inferredCount'
export type ResearchOrder = 'asc' | 'desc'

export interface ResearchRow {
  companyName: string
  /** ai_research 조사 반영 여부 */
  researched: boolean
  seedVersion: string | null
  /** 지원자 수 (DISTINCT user_id) */
  applicants: number
  /** 지원 카드 수 (진행중·합격·불합격) */
  cards: number
  /** 조사 캐시 조회수 */
  hitCount: number
  updatedAt: string | null
  expiresAt: string | null
  /** inferredFields jsonb 배열 길이 (품질 낮음 지표). 조사 없으면 null */
  inferredCount: number | null
  optOut: boolean
}

export interface ResearchListParams {
  search?: string
  filter?: ResearchFilter
  sort?: ResearchSort
  order?: ResearchOrder
  page?: number
  limit?: number
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data

export const adminResearchApi = {
  summary: () =>
    apiClient
      .get<{ data: ResearchSummary }>('/admin/company-research/summary')
      .then(unwrap),

  unified: (params: ResearchListParams) =>
    apiClient
      .get<{ data: { items: ResearchRow[]; total: number } }>(
        '/admin/company-research/unified',
        { params },
      )
      .then(unwrap),
}
