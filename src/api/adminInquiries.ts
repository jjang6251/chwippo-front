import { apiClient } from '@/api/client'

export interface AdminInquiry {
  id: string
  user_id: string
  category: string
  title: string
  content: string
  status: string
  user_unread: number
  admin_unread: number
  assignedTo: string | null
  priority: 'high' | 'medium' | 'low'
  slaDeadlineAt: string | null
  created_at: string
}

export interface AssignInquiryDto {
  assignedTo: string | null
}

export interface SetPriorityDto {
  priority: 'high' | 'medium' | 'low'
  recalcSla?: boolean
}

export interface SetSlaDto {
  deadlineAt: string
}

export interface NotificationBadges {
  inquiriesOpen: number
  inquiriesUnassigned: number
  slaOverdue: number
  adminUnread: number
}

export interface AdminListEntry {
  id: string
  nickname: string
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data

export const adminInquiriesApi = {
  listAdmins: () =>
    apiClient
      .get<{ data: AdminListEntry[] }>('/admin/inquiry-ops/admins')
      .then(unwrap),

  getSlaOverdue: () =>
    apiClient
      .get<{ data: AdminInquiry[] }>('/admin/inquiry-ops/sla-overdue')
      .then(unwrap),

  assign: (id: string, dto: AssignInquiryDto) =>
    apiClient
      .patch<{ data: AdminInquiry }>(`/admin/inquiry-ops/${id}/assign`, dto)
      .then(unwrap),

  setPriority: (id: string, dto: SetPriorityDto) =>
    apiClient
      .patch<{ data: AdminInquiry }>(`/admin/inquiry-ops/${id}/priority`, dto)
      .then(unwrap),

  setSla: (id: string, dto: SetSlaDto) =>
    apiClient
      .patch<{ data: AdminInquiry }>(`/admin/inquiry-ops/${id}/sla`, dto)
      .then(unwrap),

  getBadges: () =>
    apiClient
      .get<{ data: NotificationBadges }>('/admin/notifications/badges')
      .then(unwrap),
}
