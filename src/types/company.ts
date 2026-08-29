/**
 * W2 — 회사 자동완성 type.
 *
 * source:
 *   - 'dart' = DART 상장사 + 수동 도메인 매핑 (src/data/companies.json)
 *   - 'research' = 회사 조사 시드에 이미 조사가 있는 회사 (DART 목록 밖도 들어온다)
 *   - 'user_added' = applications.company_name DISTINCT (다른 사용자 누적)
 *
 * 🔴 **`boost` 는 삭제됐다** — signup 직군 매칭 점수로 「맞춤 추천」 섹션을 만들던 값인데,
 * 직군 자체를 걷어내면서 근거가 사라졌다. 부수 효과로 「빈 검색어일 때 `boost>0` 필터에
 * 걸려 후보가 0개」 결함도 같이 없어진다.
 */
export interface AutocompleteCompany {
  name: string
  domain?: string
  industry?: string
  market?: 'KOSPI' | 'KOSDAQ' | 'KONEX' | 'OTC'
  source: 'dart' | 'research' | 'user_added'
  /** user_added 만 — 해당 회사를 추가한 다른 사용자 수 (count DESC 정렬) */
  userCount?: number
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
