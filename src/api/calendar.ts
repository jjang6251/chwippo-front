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
