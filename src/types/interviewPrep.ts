/**
 * F6 PR 2 Phase 4 — 면접 준비 타입.
 * 백엔드 `src/interview-prep/` entity·DTO 와 1:1 매핑. 응답 DTO 는 user_id strip 적용 (백 service mapper).
 */

/** F6 PR 2 Phase 4 — 현재 AI Q&A 형식 fit 3종. PT/토론/코딩은 F-후속 별도 기능 */
export type InterviewType = 'technical' | 'personality' | 'etc'

export interface InterviewPrepSession {
  id: string
  applicationId: string
  round: string
  interviewType: InterviewType | null
  coverletterIds: string[]
  extraLogIds: string[]
  myMemo: string | null
  /** Phase 4 — 사용자가 붙여넣은 모집 요강 */
  jobDescription: string | null
  /** Phase 4 — 면접관에게 어필하고 싶은 강점·경험 */
  emphasisPoints: string | null
  /** Phase 4 단계 B — 사용자가 회사 조사 결과 위에 적은 자유 메모 (AI 정보와 분리) */
  userResearchNotes: string | null
  createdAt: string
  updatedAt: string
}

/** Phase 4 단계 B — 회사 조사 8 항목 */
export interface CompanyResearchData {
  businessSummary?: string
  coreValues?: string
  visionMission?: string
  recentTrends?: string
  financials?: string
  competitors?: string
  jobInsights?: string
  interviewKeywords?: string[]
}

export interface CompanyResearchResult {
  status: 'ok' | 'blocked' | 'opt_out'
  research?: CompanyResearchData
  sources?: string[]
  isCached?: boolean
  cachedAt?: string
  reason?: string
}

export interface InterviewPrepQuestion {
  id: string
  sessionId: string
  parentQuestionId: string | null
  depth: 0 | 1 | 2
  orderIndex: number
  /** F1 v2 — 카테고리 (INTERVIEW_CATEGORIES 18종 중 1). 옛 세션은 null */
  category: string | null
  questionText: string
  suggestedAnswer: string | null
  sourceLogIds: string[]
  myMemo: string | null
  createdAt: string
  updatedAt: string
  /** recursive CTE 결과를 client-side 트리화한 자식 노드 */
  children: InterviewPrepQuestion[]
}

export interface CreateSessionDto {
  applicationId: string
  round: string
  interviewType?: InterviewType
  coverletterIds?: string[]
  extraLogIds?: string[]
  jobDescription?: string
  emphasisPoints?: string
}

export interface UpdateSessionDto {
  round?: string
  interviewType?: InterviewType | null
  myMemo?: string | null
  jobDescription?: string | null
  emphasisPoints?: string | null
}

export interface UpdateQuestionDto {
  myMemo?: string | null
}

export interface CreateFollowupDto {
  hint?: string
}

export interface GenerateSessionResult {
  status: 'ok' | 'blocked'
  reason?: string
  meta?: {
    callLogId: string
    coverlettersUsed: number
    logsUsed: number
    droppedCount: number
    estimatedInputTokens: number
    mainCount: number
    followupCount: number
  }
}

/** Phase 4 — coverletter/log id 배열을 title·카테고리로 expand */
export interface SessionRefsExpanded {
  coverletters: Array<{
    id: string
    category: string | null
    question: string
  }>
  logs: Array<{
    id: string
    activityName: string
    occurredAt: string
    content: string
    cat: string | null
  }>
}

export interface GenerateFollowupResult {
  status: 'ok' | 'blocked'
  reason?: string
  question?: InterviewPrepQuestion
  meta?: {
    callLogId: string
  }
}

/**
 * F1 v2 (2026-06-01) — INTERVIEW_CATEGORIES 18종 한국어 라벨.
 * deep research verified base 7 + 직무 fork + 자소서기반/회사/역질문.
 */
export const CATEGORY_LABEL: Record<string, string> = {
  // base 7
  self_intro: '자기소개',
  motivation: '지원동기',
  personality: '인성·장단점',
  failure: '실패 극복',
  collaboration: '협업·갈등',
  executive: '임원·가치관',
  culture_fit: '컬처핏',
  // 직무 fork
  cs_tech: 'CS 기술',
  business_reasoning: '비즈니스 추론',
  data_metrics: '데이터·지표',
  trend_ai: 'AI·트렌드',
  customer_handling: '고객 대응',
  performance: '실적·목표',
  portfolio_decision: '포트폴리오 의사결정',
  design_process: '디자인 프로세스',
  // 공통 추가
  coverletter_based: '자소서 기반',
  company_industry: '회사·산업',
  reverse_question: '역질문',
}

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  technical: '기술 면접',
  personality: '인성 면접',
  etc: '기타',
}

/**
 * 면접 종류 색 — chip/badge 색상 표준. 라이트·다크 모두 호환 (의미 토큰 + alpha modifier).
 * 데이터 시각화 예외 (DESIGN.md Section: 단일 브랜드 액센트의 예외).
 */
export const INTERVIEW_TYPE_STYLE: Record<InterviewType, string> = {
  technical:
    'bg-info/10 border-info/30 text-info',
  personality:
    'bg-success/10 border-success/30 text-success',
  etc: 'bg-surface-3 border-line text-text-tertiary',
}
