import { apiClient } from './client'
import type {
  BulkCreateQuestionsDto,
  CompanyResearchResult,
  CreateFollowupDto,
  CreateSessionDto,
  GenerateAnswerResult,
  GenerateFollowupResult,
  GenerateSessionDto,
  GenerateSessionResult,
  InterviewPrepQuestion,
  InterviewPrepSession,
  RegenerateQuestionResult,
  SessionRefsExpanded,
  UpdateQuestionDto,
  UpdateSessionDto,
} from '@/types/interviewPrep'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * 자소서가 없어 막힌 차단인가 — **계약 해석이라 API 경계에 둔다** (타입 파일은 모양만 적는다).
 *
 * 🔴 `reason` 문자열을 보지 않는다. 서버가 audit 로그에만 `NEED_COVERLETTER:` 접두어를
 * 쓰고 클라이언트 응답은 `code` 필드로 주기 때문이다 (백엔드 실측 2026-08-11). 문구로
 * 판별하면 카피를 다듬는 순간 조용히 깨지고, 그때 사용자는 **자소서를 쓰러 갈 길을 잃는다.**
 *
 * 면접 AI **4경로가 같은 코드를 쓴다** — 생성(`GenerateSessionResult`)·↻
 * (`RegenerateQuestionResult`)·답변(`GenerateAnswerResult`)·꼬리(`GenerateFollowupResult`).
 * 네 결과가 `status`·`code` 를 같은 모양으로 갖고 있어 하나의 파라미터 타입으로 받는다.
 */
export const isNeedCoverletterBlocked = (
  result: Pick<GenerateSessionResult, 'status' | 'code'>,
): boolean => result.status === 'blocked' && result.code === 'NEED_COVERLETTER'

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
   * AI 질문 생성 — **비파괴 추가형** (질문 은행 D1b).
   *
   * 🔴 `regenerate` 를 **보내지 않는다.** 서버는 옛 프론트 호환으로 아직 받아 주지만
   * (받아도 무시한다) 새 프론트가 보낼 이유가 없다. 생성은 이제 아무것도 지우지
   * 않으므로 "파괴적 의사표시" 라는 개념 자체가 없어졌다.
   */
  generate: (sessionId: string, dto: GenerateSessionDto = {}) =>
    apiClient
      .post<{ data: GenerateSessionResult }>(
        `/interview-prep-sessions/${sessionId}/generate`,
        dto,
      )
      .then(unwrap),

  /**
   * 질문 은행 D1 — **내가 직접 적은 질문 1~50개**를 한 번에 추가 (AI 무관·코인 미차감).
   *
   * 단건(✍️ 직접 적기)·붙여넣기(📋)가 같은 엔드포인트를 쓴다 — 서버도 한 메서드다.
   * 비파괴 추가형이라 기존 질문·답변을 아무것도 지우지 않는다 (`generate` 와 다른 점).
   */
  bulkCreateQuestions: (sessionId: string, dto: BulkCreateQuestionsDto) =>
    apiClient
      .post<{ data: InterviewPrepQuestion[] }>(
        `/interview-prep-sessions/${sessionId}/questions/bulk`,
        dto,
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
   * 질문 은행 D2b — 질문 삭제 (AI·내 질문 모두 · 자손 CASCADE).
   *
   * 🔴 **AI 무관이다** — 코인·쿼터를 건드리지 않는다. 204 라 본문이 없다.
   * "답변과 꼬리 N개가 함께 사라진다" 는 확인은 **프론트 몫**이다 (서버는 플래그를
   * 요구하지 않는다 — 같은 판단이 두 곳에 생기지 않게).
   */
  deleteQuestion: (questionId: string) =>
    apiClient.delete(`/interview-prep-questions/${questionId}`),

  /**
   * 질문 은행 D2b — ↻ 낱개 교체. 이 질문 하나를 같은 자리에서 새 AI 질문으로 바꾼다.
   * body 없음 (질문 id 만으로 충분).
   *
   * 🔴 **답변·꼬리가 함께 사라지는 유일한 경로다.** 확인은 프론트 몫.
   * 🔴 서버가 `source: 'user'` 와 `depth !== 0` 을 **400** 으로 막는다 — 화면은 ↻ 를
   *    `source === 'ai' && depth === 0` 에만 그려 그 400 에 도달하지 않게 한다.
   * 🔴 세션 생성과 겹치면 **409** (`{ code: 'GENERATION_IN_PROGRESS', message }`).
   */
  regenerateQuestion: (questionId: string) =>
    apiClient
      .post<{ data: RegenerateQuestionResult }>(
        `/interview-prep-questions/${questionId}/regenerate`,
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
