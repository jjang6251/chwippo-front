import { apiClient } from '@/api/client'

export interface StepDetail {
  id: string
  applicationId: string
  orderIndex: number
  name: string
  scheduledDate: string | null
  location: string | null
}

export interface ChecklistItem {
  id: string
  stepId: string
  content: string
  isDone: boolean
  orderIndex: number
  createdAt: string
}

export const updateStep = (appId: string, stepId: string, body: { scheduledDate?: string | null; location?: string | null }) =>
  apiClient.patch<{ data: StepDetail }>(`/applications/${appId}/steps/${stepId}`, body).then((r) => r.data.data)

export const getChecklist = (appId: string, stepId: string) =>
  apiClient.get<{ data: ChecklistItem[] }>(`/applications/${appId}/steps/${stepId}/checklist`).then((r) => r.data.data)

export const createChecklistItem = (appId: string, stepId: string, content: string) =>
  apiClient.post<{ data: ChecklistItem }>(`/applications/${appId}/steps/${stepId}/checklist`, { content }).then((r) => r.data.data)

export const updateChecklistItem = (
  appId: string,
  stepId: string,
  itemId: string,
  body: { content?: string; isDone?: boolean },
) =>
  apiClient
    .patch<{ data: ChecklistItem }>(`/applications/${appId}/steps/${stepId}/checklist/${itemId}`, body)
    .then((r) => r.data.data)

export const deleteChecklistItem = (appId: string, stepId: string, itemId: string) =>
  apiClient.delete(`/applications/${appId}/steps/${stepId}/checklist/${itemId}`)
