import { apiClient } from './client'
import type {
  Activity,
  ActivityLog,
  ActivityReflection,
  CreateActivityDto,
  CreateActivityLogDto,
  CreateActivityReflectionDto,
  SummarizeNoteResult,
  UpdateActivityDto,
  UpdateActivityLogDto,
  UpdateActivityReflectionDto,
} from '@/types/activity'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const activityApi = {
  list: (includeArchived = false) =>
    apiClient
      .get<{ data: Activity[] }>('/activities', {
        params: includeArchived ? { includeArchived: '1' } : undefined,
      })
      .then(unwrap),

  get: (id: string) =>
    apiClient.get<{ data: Activity }>(`/activities/${id}`).then(unwrap),

  create: (dto: CreateActivityDto) =>
    apiClient.post<{ data: Activity }>('/activities', dto).then(unwrap),

  update: (id: string, dto: UpdateActivityDto) =>
    apiClient.patch<{ data: Activity }>(`/activities/${id}`, dto).then(unwrap),

  archive: (id: string) =>
    apiClient
      .post<{ data: Activity }>(`/activities/${id}/archive`)
      .then(unwrap),

  unarchive: (id: string) =>
    apiClient
      .post<{ data: Activity }>(`/activities/${id}/unarchive`)
      .then(unwrap),

  /** Hard delete. server 가 409 Conflict 면 axios 에러 promise reject — caller 가 err.response.status 로 분기 */
  remove: (id: string) => apiClient.delete(`/activities/${id}`),

  // logs
  listLogs: (activityId: string) =>
    apiClient
      .get<{ data: ActivityLog[] }>(`/activities/${activityId}/logs`)
      .then(unwrap),

  createLog: (activityId: string, dto: CreateActivityLogDto) =>
    apiClient
      .post<{ data: ActivityLog }>(`/activities/${activityId}/logs`, dto)
      .then(unwrap),

  updateLog: (logId: string, dto: UpdateActivityLogDto) =>
    apiClient
      .patch<{ data: ActivityLog }>(`/activity-logs/${logId}`, dto)
      .then(unwrap),

  /** Hard delete (source_refs 있으면 409). caller 가 ConfirmModal swap */
  removeLog: (logId: string) => apiClient.delete(`/activity-logs/${logId}`),

  archiveLog: (logId: string) =>
    apiClient
      .post<{ data: ActivityLog }>(`/activity-logs/${logId}/archive`)
      .then(unwrap),

  unarchiveLog: (logId: string) =>
    apiClient
      .post<{ data: ActivityLog }>(`/activity-logs/${logId}/unarchive`)
      .then(unwrap),

  summarizeLog: (logId: string, force = false) =>
    apiClient
      .post<{ data: SummarizeNoteResult }>(
        `/activity-logs/${logId}/summarize`,
        { force },
      )
      .then(unwrap),

  // reflections
  listReflections: (activityId: string) =>
    apiClient
      .get<{ data: ActivityReflection[] }>(
        `/activities/${activityId}/reflections`,
      )
      .then(unwrap),

  createReflection: (activityId: string, dto: CreateActivityReflectionDto) =>
    apiClient
      .post<{ data: ActivityReflection }>(
        `/activities/${activityId}/reflections`,
        dto,
      )
      .then(unwrap),

  updateReflection: (refId: string, dto: UpdateActivityReflectionDto) =>
    apiClient
      .patch<{ data: ActivityReflection }>(
        `/activity-reflections/${refId}`,
        dto,
      )
      .then(unwrap),

  removeReflection: (refId: string) =>
    apiClient.delete(`/activity-reflections/${refId}`),
}
