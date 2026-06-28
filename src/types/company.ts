/**
 * W2 — 회사 자동완성 type.
 *
 * source:
 *   - 'dart' = DART 상장사 + 수동 도메인 매핑 (src/data/companies.json)
 *   - 'user_added' = applications.company_name DISTINCT (다른 사용자 누적)
 */
export interface AutocompleteCompany {
  name: string
  domain?: string
  industry?: string
  market?: 'KOSPI' | 'KOSDAQ' | 'KONEX' | 'OTC'
  source: 'dart' | 'user_added'
  /** user_added 만 — 해당 회사를 추가한 다른 사용자 수 (count DESC 정렬) */
  userCount?: number
  /** signup 직군 매칭 점수 — 정렬에 사용됨, frontend 시각화는 선택 */
  boost?: number
}

/** W2 — DART 기반 회사 정보 (BoardDetail "회사 정보" 섹션) */
export interface CompanyDetails {
  corpCode: string
  /** epoch ms — 마지막 DART fetch 성공 시각 */
  fetchedAt: number
  /** true 면 SOFT_TTL 초과 후 refresh 실패해서 옛 데이터 반환됨 */
  isStale?: boolean
  profile: {
    corpName: string
    ceoName?: string
    estDate?: string
    address?: string
    homepage?: string
    induty?: string
    indutyCode?: string
    phone?: string
  }
  disclosures: Array<{
    receiptNo: string
    reportName: string
    receiptDate: string
  }>
  financials: {
    bsnsYear: string
    reportName: string
    items: Array<{ sjNm: string; accountNm: string; thstrmAmount: string }>
  } | null
}
