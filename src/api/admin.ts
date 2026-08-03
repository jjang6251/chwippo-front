import type { PlatformDistribution } from './adminUsers'
import { apiClient } from './client'
import type { InquiryDetail } from './inquiries'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface GlobalStorage {
  totalUsedBytes: number
  averageBytes: number
  nearCapUserCount: number
  r2FreeLimitGB: number
}

export interface AdminStats {
  totalUsers: number
  newUsersMonth: number
  newUsersWeek: number
  pendingInquiries: number
  globalStorage: GlobalStorage
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
  user_nickname: string | null
  user_email: string | null
  user_short_id: string | null
  // PR_B2 Phase 4
  assignedTo?: string | null
  priority?: 'high' | 'medium' | 'low'
  slaDeadlineAt?: string | null
}

export interface InquiriesResult {
  items: AdminInquiry[]
  total: number
  page: number
  limit: number
}

export const getAdminStats = () =>
  apiClient.get('/admin/stats').then(unwrap<AdminStats>)

/** 사용 환경 분포 — 웹만/앱만/둘다/미접속 (4분류 배타, 합계 = total) */
export const getPlatformDistribution = () =>
  apiClient
    .get('/admin/platform-distribution')
    .then(unwrap<PlatformDistribution>)

export const getAdminInquiries = (params?: { status?: string; category?: string; page?: number }) =>
  apiClient.get('/admin/inquiries', { params }).then(unwrap<InquiriesResult>)

export const getAdminInquiryDetail = (id: string) =>
  apiClient.get(`/admin/inquiries/${id}`).then(unwrap<InquiryDetail>)

export const addAdminComment = (id: string, content: string) =>
  apiClient.post(`/admin/inquiries/${id}/comments`, { content }).then(unwrap<{ id: string }>)

export const closeInquiry = (id: string) =>
  apiClient.patch(`/admin/inquiries/${id}/close`, {}).then(unwrap<AdminInquiry>)

export interface DayData { date: string; count: number }

export interface AdminAnalytics {
  dau: DayData[]
  signups: DayData[]
  cumulative: DayData[]
  cards: DayData[]
  inquiries: DayData[]
  avgReplyHours: number | null
  avgCardsPerUser: number | null
  d7Retention: number | null
  d7CohortSize: number
}

export const getAdminAnalytics = (days: number) =>
  apiClient.get('/admin/analytics', { params: { days } }).then(unwrap<AdminAnalytics>)

// ── A8 Activation 측정 ──

export interface ActivationCohort {
  weekStart: string
  cohortSize: number
  setup: number
  ahaBeta: number
  ahaAi: number
  d7: number
  d30: number
}

export interface ActivationData {
  cohorts: ActivationCohort[]
  funnel: { signup: number; setup: number; ahaBeta: number; d7: number }
  briefing: {
    receivedUserDays: number
    actedRateRead: number | null
    actedRateUnread: number | null
  }
  generatedAt: string
}

export const getAdminActivation = () =>
  apiClient.get('/admin/activation').then(unwrap<ActivationData>)
