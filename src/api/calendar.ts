import { apiClient } from './client'

export interface CalendarEvent {
  date: string
  time: string | null
  type: 'deadline' | 'interview' | 'exam'
  applicationId: string | null
  stepId: string | null
  examId: string | null
  companyName: string
  stepName: string | null
  location: string | null
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
