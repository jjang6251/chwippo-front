import { apiClient } from './client'
import type {
  Application,
  CreateApplicationDto,
  UpdateApplicationDto,
  UpdateStepsDto,
  InterviewNudge,
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
    apiClient
      .patch<{ data: Application & { interviewNudge?: InterviewNudge } }>(
        `/applications/${id}/step`,
        { stepIndex },
      )
      .then(unwrap),

  /** 면접 유도 모달을 이 스텝에서 띄웠다고 기록 (멱등). 닫는 방법 4가지가 전부 여기로 온다 */
  markInterviewNudgeShown: (id: string, stepId: string) =>
    apiClient.post(`/applications/${id}/steps/${stepId}/interview-nudge-shown`),

  updateSteps: (id: string, dto: UpdateStepsDto) =>
    apiClient.put<{ data: Application }>(`/applications/${id}/steps`, dto).then(unwrap),

  remove: (id: string) => apiClient.delete(`/applications/${id}`),

  /** W1 — 개별 sample 카드 숨김 (soft delete). 진짜 카드는 400 */
  dismissSample: (id: string) =>
    apiClient.post(`/applications/${id}/sample-dismiss`).then(() => undefined),

}
