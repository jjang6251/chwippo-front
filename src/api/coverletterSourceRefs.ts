import { apiClient } from './client'
import type {
  AiDraftResult,
  CoverletterSourceRef,
  CreateCoverletterSourceRefDto,
  GenerateAiDraftDto,
} from '@/types/coverletterSourceRef'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * F6 PR 1 — coverletter source-refs CRUD + AI 초안 생성 endpoint.
 * 백엔드 `src/applications/coverletter-source-refs.controller.ts` + `ai-coverletter.controller.ts`.
 */
export const coverletterSourceRefsApi = {
  list: (clId: string) =>
    apiClient
      .get<{ data: CoverletterSourceRef[] }>(`/coverletters/${clId}/source-refs`)
      .then(unwrap),

  create: (clId: string, dto: CreateCoverletterSourceRefDto) =>
    apiClient
      .post<{ data: CoverletterSourceRef }>(`/coverletters/${clId}/source-refs`, dto)
      .then(unwrap),

  remove: (clId: string, refId: string) =>
    apiClient.delete(`/coverletters/${clId}/source-refs/${refId}`),

  /** POST /coverletters/:clId/ai-draft — LlmService coverletter_draft_v2 + AI 추천 coverletter_recommend */
  generateDraft: (clId: string, dto: GenerateAiDraftDto) =>
    apiClient
      .post<{ data: AiDraftResult }>(`/coverletters/${clId}/ai-draft`, dto)
      .then(unwrap),
}
