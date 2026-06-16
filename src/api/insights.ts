import { apiClient } from './client'
import type { InsightsResponse } from '@/types/insights'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const insightsApi = {
  /** GET /activity/insights — 5분 cache (백엔드). 단일 응답 (strengths/sources/heatmap/trend) */
  get: () =>
    apiClient.get<{ data: InsightsResponse }>('/activity/insights').then(unwrap),
}
