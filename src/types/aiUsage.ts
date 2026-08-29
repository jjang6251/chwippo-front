/**
 * 기능별 한 줄 (선택한 기간 기준).
 *
 * 🔴 `avgCostPerCall` 은 **옵셔널**이다 — 프론트가 백엔드보다 먼저 뜨는 배포 창엔 없다.
 * 없는 값을 `0` 으로 채우지 않는다: 「측정했는데 0원」과 「아직 못 받았다」는 완전히 다른
 * 말이고, 이 화면은 그 숫자로 기능을 켜고 끄는 곳이다 (`adminCardFields` 와 같은 판단).
 * 호출 0 건이면 서버가 `null` 을 준다 — 나눌 수가 없어서다.
 *
 * 이달 누적·예상은 여기 없다 — 기간 필터와 무관한 고정 창이라 `/v2/feature-month` 가 따로 준다.
 */
export interface AiUsageFeatureRow {
  feature: string
  calls: number
  costUsd: number
  /** 호출당 평균 비용 — 「이 기능 한 번이 얼마짜리인가」 */
  avgCostPerCall?: number | null
}

export interface AiUsageOverview {
  totalCalls: number
  totalCostUsd: number
  byFeature: AiUsageFeatureRow[]
  byStatus: Array<{ status: string; count: number }>
}

export interface AiUsageByUserRow {
  userId: string
  totalCalls: number
  totalCostUsd: number
  totalPromptTokens: number
  totalCompletionTokens: number
}

export interface AiUsageCallLog {
  id: string
  userId: string
  feature: string
  model: string
  promptTokens: number
  completionTokens: number
  costUsd: string
  latencyMs: number
  status: string
  errorMessage: string | null
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}
