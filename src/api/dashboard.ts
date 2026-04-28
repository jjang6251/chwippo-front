import { apiClient } from './client'

export interface DashboardStats {
  total: number
  interviews: number
  passed: number
}

export interface DdayItem {
  type: 'deadline' | 'interview'
  applicationId: string
  companyName: string
  stepName?: string
  date: string
  dday: number
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const getDashboardStats = () =>
  apiClient.get('/dashboard/stats').then(unwrap<DashboardStats>)

export const getDdayList = () =>
  apiClient.get('/dashboard/dday').then(unwrap<DdayItem[]>)
