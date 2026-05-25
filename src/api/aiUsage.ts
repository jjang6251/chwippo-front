import { apiClient } from './client'
import type {
  AiUsageByUserRow,
  AiUsageCallLog,
  AiUsageOverview,
} from '@/types/aiUsage'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface AiUsageQuery {
  startDate?: string
  endDate?: string
  feature?: string
}

export const aiUsageApi = {
  overview: (q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: AiUsageOverview }>('/admin/ai-usage', { params: q })
      .then(unwrap),

  byUser: (q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: AiUsageByUserRow[] }>('/admin/ai-usage/users', { params: q })
      .then(unwrap),

  userDetail: (userId: string, q: AiUsageQuery = {}) =>
    apiClient
      .get<{ data: AiUsageCallLog[] }>(`/admin/ai-usage/users/${userId}`, {
        params: q,
      })
      .then(unwrap),
}
