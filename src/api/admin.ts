import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface AdminStats {
  totalUsers: number
  newUsersMonth: number
  newUsersWeek: number
  pendingInquiries: number
}

export interface Inquiry {
  id: string
  user_id: string | null
  category: string
  title: string
  content: string
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'
  admin_reply: string | null
  replied_at: string | null
  created_at: string
}

export interface InquiriesResult {
  items: Inquiry[]
  total: number
  page: number
  limit: number
}

export const getAdminStats = () =>
  apiClient.get('/admin/stats').then(unwrap<AdminStats>)

export const getAdminInquiries = (params?: { status?: string; page?: number }) =>
  apiClient.get('/admin/inquiries', { params }).then(unwrap<InquiriesResult>)

export const updateAdminInquiry = (id: string, dto: { status: string; adminReply?: string }) =>
  apiClient.patch(`/admin/inquiries/${id}`, dto).then(unwrap<Inquiry>)
