import { apiClient } from './client'
import type {
  CompanyResearchResult,
  CreateFollowupDto,
  CreateSessionDto,
  GenerateAnswerResult,
  GenerateFollowupResult,
  GenerateSessionResult,
  InterviewPrepQuestion,
  InterviewPrepSession,
  SessionRefsExpanded,
  UpdateQuestionDto,
  UpdateSessionDto,
} from '@/types/interviewPrep'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * F6 PR 2 Phase 4 — 면접 준비 API.
 * 백엔드 `src/interview-prep/` controller 2종 (sessions + questions).
 */
export const interviewPrepApi = {
  // ── sessions ──
  list: (applicationId: string) =>
    apiClient
      .get<{ data: InterviewPrepSession[] }>(
        `/interview-prep-sessions?applicationId=${applicationId}`,
      )
      .then(unwrap),

  create: (dto: CreateSessionDto) =>
    apiClient
      .post<{ data: InterviewPrepSession }>(`/interview-prep-sessions`, dto)
      .then(unwrap),

  findOne: (id: string) =>
    apiClient
      .get<{ data: InterviewPrepSession }>(`/interview-prep-sessions/${id}`)
      .then(unwrap),

  update: (id: string, dto: UpdateSessionDto) =>
    apiClient
      .patch<{ data: InterviewPrepSession }>(
        `/interview-prep-sessions/${id}`,
        dto,
      )
      .then(unwrap),

  remove: (id: string) =>
    apiClient.delete(`/interview-prep-sessions/${id}`),

  // ── questions ──
  listQuestions: (sessionId: string) =>
    apiClient
      .get<{ data: InterviewPrepQuestion[] }>(
        `/interview-prep-sessions/${sessionId}/questions`,
      )
      .then(unwrap),

  /** Phase 4 — coverletter/log id 를 title·카테고리로 expand */
  listRefs: (sessionId: string) =>
    apiClient
      .get<{ data: SessionRefsExpanded }>(
        `/interview-prep-sessions/${sessionId}/refs`,
      )
      .then(unwrap),

  /**
   * AI 일괄 생성 (메인 20개).
   *
   * 🔴 `regenerate` 는 **파괴적 의사표시**다. 생성은 기존 질문과 사용자가 쓴 답변을
   * 전부 지우므로, 이미 질문이 있는 세션은 이 값 없이는 서버가 거절한다
   * (`code: 'REGENERATE_REQUIRED'`).
   */
  generate: (sessionId: string, regenerate = false) =>
    apiClient
      .post<{ data: GenerateSessionResult }>(
        `/interview-prep-sessions/${sessionId}/generate`,
        { regenerate },
      )
      .then(unwrap),

  updateQuestion: (questionId: string, dto: UpdateQuestionDto) =>
    apiClient
      .patch<{ data: InterviewPrepQuestion }>(
        `/interview-prep-questions/${questionId}`,
        dto,
      )
      .then(unwrap),

  /**
   * v2 — 질문 1개의 예상 답변 생성 (on-demand).
   *
   * 세션 생성이 질문만 만들기 때문에 답변은 사용자가 `AI 도움` 을 눌렀을 때만 만들어진다.
   * 이미 답변이 있으면 재생성해 덮어쓴다 (코인이 다시 차감된다).
   */
  generateAnswer: (questionId: string) =>
    apiClient
      .post<{ data: GenerateAnswerResult }>(
        `/interview-prep-questions/${questionId}/answer`,
      )
      .then(unwrap),

  /** on-demand 꼬리질문 1개 생성 (parent.depth 0 또는 1) */
  createFollowup: (parentQuestionId: string, dto: CreateFollowupDto = {}) =>
    apiClient
      .post<{ data: GenerateFollowupResult }>(
        `/interview-prep-questions/${parentQuestionId}/followups`,
        dto,
      )
      .then(unwrap),

  // ── Phase 4 단계 B — 회사 조사 ──

  /** cache 조회 (LLM 호출 X). 없으면 null → "🔍 회사 조사" 버튼 노출 */
  getCompanyResearch: (sessionId: string) =>
    apiClient
      .get<{ data: CompanyResearchResult | null }>(
        `/interview-prep-sessions/${sessionId}/research`,
      )
      .then(unwrap),

  /** 사용자 자유 메모 update (AI 정보와 분리) */
  updateUserResearchNotes: (sessionId: string, notes: string | null) =>
    apiClient.patch(`/interview-prep-sessions/${sessionId}/user-notes`, {
      notes,
    }),
}
