import { apiClient } from './client'
import type {
  Application,
  CreateApplicationDto,
  GenerateCoverletterResult,
  UpdateApplicationDto,
  UpdateStepsDto,
} from '@/types/application'

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

  /**
   * PR_B1c — 자소서 생성 (회사조사 trigger + 50 코인 차감).
   * status 'completed' / 'already_in_progress' / 'already_completed' / 'coin_insufficient'
   * LLM 실패 시 500 throw → axios catch
   */
  generateCoverletter: (id: string) =>
    apiClient
      .post<{ data: GenerateCoverletterResult }>(
        `/applications/${id}/generate-coverletter`,
      )
      .then(unwrap),
}
