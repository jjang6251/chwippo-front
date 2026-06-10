import { apiClient } from '@/api/client'

export interface AuditLogRow {
  id: string
  action: string
  targetType: string
  targetId: string
  adminUserId: string | null
  detail: Record<string, unknown>
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface AuditLogSearchParams {
  action?: string
  adminId?: string
  targetId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface AuditLogSearchResponse {
  rows: AuditLogRow[]
  total: number
  page: number
  limit: number
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data

export const adminAuditLogsApi = {
  search: (params: AuditLogSearchParams) =>
    apiClient
      .get<{ data: AuditLogSearchResponse }>('/admin/audit-logs', { params })
      .then(unwrap),
}
