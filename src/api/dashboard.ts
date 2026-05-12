import { apiClient } from './client'

export interface DashboardStats {
  total: number               // 지원한 회사 (IN_PROGRESS + PASSED + FAILED)
  inProgress: number          // 진행 중
  interviewsAttended: number  // 면접 본 횟수 (면접 스텝 중 KST 날짜가 과거)
  passed: number              // 합격
}

export interface DdayItem {
  type: 'deadline' | 'interview' | 'exam'
  applicationId?: string
  stepId?: string
  examId?: string
  companyName: string
  stepName?: string
  date: string
  scheduledTime?: string
  dday: number
  pinnedContent?: string | null
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export interface InterviewReviewItem {
  stepId: string
  stepName: string
  applicationId: string
  companyName: string
}

export const getDashboardStats = () =>
  apiClient.get('/dashboard/stats').then(unwrap<DashboardStats>)

export const getDdayList = () =>
  apiClient.get('/dashboard/dday').then(unwrap<DdayItem[]>)

export const getInterviewReview = () =>
  apiClient.get('/dashboard/interview-review').then(unwrap<InterviewReviewItem[]>)
