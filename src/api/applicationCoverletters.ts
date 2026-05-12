import { apiClient } from './client'
import type {
  ApplicationCoverletter,
  CoverletterReuseOption,
  CreateCoverletterDto,
  UpdateCoverletterDto,
} from '@/types/coverletter'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const applicationCoverlettersApi = {
  list: (applicationId: string) =>
    apiClient
      .get<{ data: ApplicationCoverletter[] }>(`/applications/${applicationId}/coverletters`)
      .then(unwrap),

  reuseOptions: (applicationId: string, category?: string) =>
    apiClient
      .get<{ data: CoverletterReuseOption[] }>(
        `/applications/${applicationId}/coverletters/reuse-options`,
        { params: category ? { category } : undefined },
      )
      .then(unwrap),

  create: (applicationId: string, dto: CreateCoverletterDto) =>
    apiClient
      .post<{ data: ApplicationCoverletter }>(`/applications/${applicationId}/coverletters`, dto)
      .then(unwrap),

  update: (applicationId: string, clId: string, dto: UpdateCoverletterDto) =>
    apiClient
      .patch<{ data: ApplicationCoverletter }>(
        `/applications/${applicationId}/coverletters/${clId}`,
        dto,
      )
      .then(unwrap),

  remove: (applicationId: string, clId: string) =>
    apiClient.delete(`/applications/${applicationId}/coverletters/${clId}`),
}
