import { apiClient } from './client'

export interface CalendarEvent {
  date: string
  type: 'deadline' | 'interview'
  applicationId: string
  companyName: string
  stepName: string | null
  location: string | null
}

export const getCalendarEvents = (year: number, month: number) =>
  apiClient
    .get<{ data: CalendarEvent[] }>('/calendar/events', { params: { year, month } })
    .then((r) => r.data.data)
