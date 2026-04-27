import { apiClient } from './client'
import type { Application, CreateApplicationDto, UpdateApplicationDto, UpdateStepsDto } from '@/types/application'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const applicationsApi = {
  list: () => apiClient.get<{ data: Application[] }>('/applications').then(unwrap),

  get: (id: string) => apiClient.get<{ data: Application }>(`/applications/${id}`).then(unwrap),

  create: (dto: CreateApplicationDto) =>
    apiClient.post<{ data: Application }>('/applications', dto).then(unwrap),

  update: (id: string, dto: UpdateApplicationDto) =>
    apiClient.patch<{ data: Application }>(`/applications/${id}`, dto).then(unwrap),

  updateCurrentStep: (id: string, stepIndex: number) =>
    apiClient.patch<{ data: Application }>(`/applications/${id}/step`, { stepIndex }).then(unwrap),

  updateSteps: (id: string, dto: UpdateStepsDto) =>
    apiClient.put<{ data: Application }>(`/applications/${id}/steps`, dto).then(unwrap),

  remove: (id: string) => apiClient.delete(`/applications/${id}`),
}
