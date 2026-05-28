import { apiClient } from './client'

export interface AlertThresholds {
  id: number
  dailyCostThresholdUsd: number
  hourlyErrorRateThreshold: number
  vsYesterdayIncreaseThreshold: number
  enabled: boolean
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
