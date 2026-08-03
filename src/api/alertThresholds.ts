import { apiClient } from './client'

export interface AlertThresholds {
  id: number
  dailyCostThresholdUsd: number
  hourlyErrorRateThreshold: number
  vsYesterdayIncreaseThreshold: number
  enabled: boolean
  // PR_B2 Phase 1 — admin grant alert (S1)
  adminGrantPerHourAlert: number
  adminGrantSingleAlert: number
  // PR_B2 Phase 2 — 신규 4 임계치 (Q5)
  inquirySlaHours: number
  abuserSuspectDailyCalls: number
  /** G-8 — finish_reason='length' (출력 잘림) 1h 누적 임계 */
  outputTruncationCount1h: number
  /** G-8 — 코인 차감 후 실패 1h 누적 임계 */
  chargedFailureCount1h: number
  freeUserSignupSpikePct: number
  costOutlierStddev: number
  // AI cost guard — per-user / per-feature daily USD cap
  perUserDailyCostUsd: number
  perFeatureDailyCostUsd: number
  updatedBy: string | null
  updatedAt: string
}

export interface AlertHistoryRow {
  id: string
  alertType:
    | 'daily_cost'
    | 'hourly_error_rate'
    | 'vs_yesterday'
    | 'abuser_ban'
    | 'test'
    | 'provider_down'
    | 'provider_up'
  triggeredValue: number
  thresholdValue: number
  message: string
  webhookStatus:
    | 'sent'
    | 'failed'
    | 'skipped_dedup'
    | 'skipped_no_webhook'
  createdAt: string
}

export interface AlertThresholdsResponse {
  thresholds: AlertThresholds
  history: AlertHistoryRow[]
}

export interface UpdateAlertThresholdsDto {
  dailyCostThresholdUsd?: number
  hourlyErrorRateThreshold?: number
  vsYesterdayIncreaseThreshold?: number
  enabled?: boolean
  // PR_B2 Phase 1
  adminGrantPerHourAlert?: number
  adminGrantSingleAlert?: number
  // PR_B2 Phase 2
  inquirySlaHours?: number
  abuserSuspectDailyCalls?: number
  outputTruncationCount1h?: number
  chargedFailureCount1h?: number
  freeUserSignupSpikePct?: number
  costOutlierStddev?: number
  // AI cost guard
  perUserDailyCostUsd?: number
  perFeatureDailyCostUsd?: number
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const alertThresholdsApi = {
  get: () =>
    apiClient
      .get<{ data: AlertThresholdsResponse }>('/admin/alert-thresholds')
      .then(unwrap),

  update: (dto: UpdateAlertThresholdsDto) =>
    apiClient
      .patch<{ data: AlertThresholds }>('/admin/alert-thresholds', dto)
      .then(unwrap),

  test: () =>
    apiClient
      .post<{ data: { status: string } }>('/admin/alert-thresholds/test')
      .then(unwrap),
}
