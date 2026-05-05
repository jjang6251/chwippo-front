import { apiClient } from './client'

export interface CalendarEvent {
  date: string
  time: string | null
  type: 'deadline' | 'interview'
  applicationId: string
  companyName: string
  stepName: string | null
  location: string | null
}

export interface DailyNote {
  id: string
  date: string
  hourSlot: number
  content: string
  isDone: boolean
  createdAt: string
}

export const getCalendarEvents = (year: number, month: number) =>
  apiClient
    .get<{ data: CalendarEvent[] }>('/calendar/events', { params: { year, month } })
    .then((r) => r.data.data)

export const getDailyNotes = (date: string) =>
  apiClient
    .get<{ data: DailyNote[] }>('/calendar/daily-notes', { params: { date } })
    .then((r) => r.data.data)

export const createDailyNote = (body: { date: string; hourSlot: number; content: string }) =>
  apiClient.post<{ data: DailyNote }>('/calendar/daily-notes', body).then((r) => r.data.data)

export const updateDailyNote = (id: string, body: { content?: string; isDone?: boolean }) =>
  apiClient.patch<{ data: DailyNote }>(`/calendar/daily-notes/${id}`, body).then((r) => r.data.data)

export const deleteDailyNote = (id: string) =>
  apiClient.delete(`/calendar/daily-notes/${id}`)
