import { apiClient } from './client'
import type { InquiryDetail } from './inquiries'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface AdminStats {
  totalUsers: number
  newUsersMonth: number
  newUsersWeek: number
  pendingInquiries: number
}

export interface AdminInquiry {
  id: string
  user_id: string | null
  category: string
  title: string
  content: string
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
  user_unread: number
  admin_unread: number
  created_at: string
}

export interface InquiriesResult {
  items: AdminInquiry[]
  total: number
  page: number
  limit: number
}

export const getAdminStats = () =>
  apiClient.get('/admin/stats').then(unwrap<AdminStats>)

export const getAdminInquiries = (params?: { status?: string; category?: string; page?: number }) =>
  apiClient.get('/admin/inquiries', { params }).then(unwrap<InquiriesResult>)

export const getAdminInquiryDetail = (id: string) =>
  apiClient.get(`/admin/inquiries/${id}`).then(unwrap<InquiryDetail>)

export const addAdminComment = (id: string, content: string) =>
  apiClient.post(`/admin/inquiries/${id}/comments`, { content }).then(unwrap<{ id: string }>)

export const closeInquiry = (id: string) =>
  apiClient.patch(`/admin/inquiries/${id}/close`, {}).then(unwrap<AdminInquiry>)
