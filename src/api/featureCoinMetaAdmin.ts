import { apiClient } from '@/api/client'

export interface FeatureCoinMeta {
  feature: string
  chargesCoins: boolean
  avgCoinCost: string
  fixedCoinCost: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateFeatureCoinMetaDto {
  chargesCoins?: boolean
  fixedCoinCost?: number | null
  avgCoinCost?: number
  description?: string | null
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data

export const featureCoinMetaAdminApi = {
  listAll: () =>
    apiClient
      .get<{ data: FeatureCoinMeta[] }>('/admin/feature-coin-meta')
      .then(unwrap),

  getOne: (feature: string) =>
    apiClient
      .get<{ data: FeatureCoinMeta }>(`/admin/feature-coin-meta/${feature}`)
      .then(unwrap),

  update: (feature: string, dto: UpdateFeatureCoinMetaDto) =>
    apiClient
      .patch<{ data: FeatureCoinMeta }>(`/admin/feature-coin-meta/${feature}`, dto)
      .then(unwrap),
}
