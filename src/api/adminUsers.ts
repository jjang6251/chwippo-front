import { apiClient } from './client'

export interface AdminUser {
  id: string
  nickname: string
  email: string | null
  role: string
  createdAt: string
  lastActiveAt: string | null
  suspendedAt: string | null
}

export interface AdminUserStorageStats {
  usedBytes: number
  limitBytes: number
  usedMB: number
  limitMB: number
  percentage: number
}

export interface AdminUserMyinfoCount {
  cert: number
  award: number
  languageCert: number
  experience: number
  coverletterCustom: number
  document: number
  education: number
}

export interface AdminUserStats {
  storage: AdminUserStorageStats
  applicationCount: number
  myinfoCount: AdminUserMyinfoCount
}

export interface AdminUserDetail extends AdminUser {
  stats: AdminUserStats
  /** 일부 운영 페이지의 기존 사용 — backend는 보내지 않을 수 있음 */
  cardsCount?: number
  recentInquiries?: {
    id: string
    title: string
    status: string
    created_at: string
  }[]
}

export interface UpdateAdminUserDto {
  suspended?: boolean
  role?: 'user' | 'admin'
  nickname?: string
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const getAdminUsers = (params: {
  page?: number
  limit?: number
  search?: string
  role?: string
  suspended?: boolean
}) =>
  apiClient
    .get<{ data: { data: AdminUser[]; total: number } }>('/admin/users', { params })
    .then(unwrap)

export const getAdminUser = (id: string) =>
  apiClient
    .get<{ data: AdminUserDetail }>(`/admin/users/${id}`)
    .then(unwrap)

export const updateAdminUser = (id: string, dto: UpdateAdminUserDto) =>
  apiClient.patch(`/admin/users/${id}`, dto).then((r) => r.data)

export const deleteAdminUser = (id: string) =>
  apiClient.delete(`/admin/users/${id}`)

export const warnAdminUser = (id: string, message: string) =>
  apiClient.post(`/admin/users/${id}/warn`, { message }).then((r) => r.data)

export const exportAdminUser = (id: string) =>
  apiClient
    .post(`/admin/users/${id}/export`, {}, { responseType: 'blob' })
    .then((r) => r.data as Blob)

export interface AdminUserExportData {
  user: Record<string, unknown>
  applications: {
    id: string
    companyName: string
    jobTitle: string | null
    status: string
    currentStepIndex: number
    createdAt: string
  }[]
  inquiries: {
    id: string
    title: string
    status: string
    created_at: string
  }[]
  myinfo: {
    profile: Record<string, unknown> | null
    educations: Record<string, unknown>[]
    experiences: Record<string, unknown>[]
    certs: Record<string, unknown>[]
    languageCerts: Record<string, unknown>[]
    awards: Record<string, unknown>[]
    documents: Record<string, unknown>[]
    coverletters: Record<string, unknown>[]
  }
}

export const viewAdminUserData = (id: string) =>
  apiClient
    .post<{ data: AdminUserExportData }>(`/admin/users/${id}/export`, {})
    .then(unwrap)
