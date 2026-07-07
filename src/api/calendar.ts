import { apiClient } from './client'

export interface CalendarEvent {
  date: string
  time: string | null
  type: 'step' | 'exam' | 'note'
  applicationId: string | null
  stepId: string | null
  examId: string | null
  noteId: string | null
  companyName: string | null
  stepName: string | null
  location: string | null
  content: string | null
  /**
   * 캘린더 UX 재구성 — step 타입 전용. Application.isStarred 값.
   * 아젠다 즐겨찾기 필터에서 사용.
   */
  isStarred?: boolean
}

export interface DailyNote {
  id: string
  date: string
  hourSlot: number | null
  content: string
  isDone: boolean
  createdAt: string
}

export const getCalendarEvents = (year: number, month: number) =>
  apiClient
    .get<{ data: CalendarEvent[] }>('/calendar/events', { params: { year, month } })
    .then((r) => r.data.data)

export const getDailyNotes = (params: { date: string } | { startDate: string; endDate: string }) =>
  apiClient
    .get<{ data: DailyNote[] }>('/calendar/daily-notes', { params })
    .then((r) => r.data.data)

export const createDailyNote = (body: { date: string; hourSlot?: number | null; content: string }) =>
  apiClient.post<{ data: DailyNote }>('/calendar/daily-notes', body).then((r) => r.data.data)

export const updateDailyNote = (id: string, body: { content?: string; isDone?: boolean }) =>
  apiClient.patch<{ data: DailyNote }>(`/calendar/daily-notes/${id}`, body).then((r) => r.data.data)

export const deleteDailyNote = (id: string) =>
  apiClient.delete(`/calendar/daily-notes/${id}`)

export const carryOverDailyNote = (id: string) =>
  apiClient.patch<{ data: DailyNote }>(`/calendar/daily-notes/${id}/carry-over`).then((r) => r.data.data)

/** A3 — D-3 이내 스텝의 미완 체크리스트 (오늘 할 일 자동 합류, read-through) */
export interface UrgentChecklistItem {
  itemId: string
  content: string
  stepId: string
  stepName: string
  applicationId: string
  companyName: string
  /** 스텝 날짜 (KST YYYY-MM-DD) */
  date: string
}

export const getUrgentChecklist = () =>
  apiClient
    .get<{ data: UrgentChecklistItem[] }>('/calendar/urgent-checklist')
    .then((r) => r.data.data)
