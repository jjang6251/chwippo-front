import { apiClient } from '@/api/client'

export interface FillRateRow {
  field: string
  filled: number
  total: number
  rate: number
}

export interface CostTrendRow {
  date: string
  cost: number
  calls: number
}

export interface CacheStats {
  total: number
  active: number
  expired: number
  optOut: number
}

export interface TopCompany {
  companyName: string
  hitCount: number
  expiresAt: string
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data

export const companyResearchMetricsApi = {
  fillRate: () =>
    apiClient
      .get<{ data: FillRateRow[] }>('/admin/company-research/fill-rate')
      .then(unwrap),

  costTrend: (days?: number) =>
    apiClient
      .get<{ data: CostTrendRow[] }>('/admin/company-research/cost-trend', {
        params: days ? { days } : undefined,
      })
      .then(unwrap),

  cacheStats: () =>
    apiClient
      .get<{ data: CacheStats }>('/admin/company-research/cache-stats')
      .then(unwrap),

  topCompanies: (limit?: number) =>
    apiClient
      .get<{ data: TopCompany[] }>('/admin/company-research/top-companies', {
        params: limit ? { limit } : undefined,
      })
      .then(unwrap),
}
