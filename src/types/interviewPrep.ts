/**
 * F6 PR 2 Phase 4 — 면접 준비 타입.
 * 백엔드 `src/interview-prep/` entity·DTO 와 1:1 매핑. 응답 DTO 는 user_id strip 적용 (백 service mapper).
 */

/**
 * 면접 종류 — PRD 6종. 백엔드 `src/interview-prep/interview-types.const.ts` 와 값·순서 동기화.
 *
 * v1 은 `technical`·`personality`·`etc` 3종이었는데 **IT 전제**라, 마케팅·재무·승무원
 * 지원자가 실무 면접 세션을 만들면 고를 게 인성/기타뿐이었다. `job_fit` 이 그 자리다.
 * 기존 3개 값은 저장된 세션이 있어 그대로 둔다.
 */
export type InterviewType =
  | 'job_fit'
  | 'personality'
  | 'technical'
  | 'presentation'
  | 'discussion'
  | 'etc'

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
  /**
   * v2.1 — 질문 생성 진행 상태. **새로고침해도 "생성 중" 을 다시 보여주는 근거**다.
   * 서버가 2분 초과 `in_progress` 를 `idle` 로 보정해 내려주므로 영구 잠김이 없다.
   */
  generationStatus: 'idle' | 'in_progress' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
}

/**
 * 회사 조사 11 항목 (PR 보강 Phase 1 — Phase 4 8 항목 + 신규 3).
 */
export interface CompanyResearchData {
  businessSummary?: string
  coreValues?: string
  visionMission?: string
  recentTrends?: string
  financials?: string
  competitors?: string
  /** 2차 seed (v2026-07.3)부터 — "왜 이 회사인가" 근거 (경쟁사 대비 구조적 차이) */
  differentiators?: string
  jobInsights?: string
  // PR 보강 — InterviewKeyword 객체 (카테고리별 색상) — 기존 cache 호환 위해 string union
  interviewKeywords?: (InterviewKeyword | string)[]
  // PR 보강 — 신규 3 항목
  companyProfile?: CompanyProfile
  talentProfile?: string[]
  productsAndTech?: ProductsAndTech
  // PR 보강 — 응답 JSON 안 inline 저장
  sources?: ResearchSource[]
  inferredFields?: string[]
}

/** PR 보강 — 회사 기본 정보 (hero card) */
export interface CompanyProfile {
  founded?: string
  hq?: string
  industry?: string
  size?: string
}

/** PR 보강 — 제품·기술 스택 */
export interface ProductsAndTech {
  products?: string[]
  techStack?: string[]
}

/**
 * PR 보강 — interviewKeywords 카테고리별 색상 매핑.
 * tech = 파랑 / talent = 초록 / business = 보라 / role = 주황 / issue = 빨강
 */
export interface InterviewKeyword {
  keyword: string
  category: 'tech' | 'talent' | 'business' | 'role' | 'issue'
}

/** PR 보강 — 출처 객체 (Perplexity 식 inline footnote) */
export interface ResearchSource {
  id: number
  title: string
  url: string
  domain: string
  publishedAt?: string
}

export interface CompanyResearchResult {
  status: 'ok' | 'blocked' | 'opt_out'
  research?: CompanyResearchData
  /** PR 보강 — 객체 배열로 확장 (기존 string[] 호환) */
  sources?: ResearchSource[] | string[]
  /** PR 보강 — confirmed/inferred 분리 */
  inferredFields?: string[]
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
  /** F1 v2 — 카테고리 (INTERVIEW_CATEGORIES 중 1). 옛 세션은 null */
  category: string | null
  /**
   * v2.1 — **먼저 준비할 질문** (20문항 중 5~7개).
   *
   * 근거: 신입 면접은 1인 평균 26분이고 자기소개를 빼면 실질 문답이 4분 남짓 —
   * 실제로 받는 질문은 5개 안팎이다. 20개를 다 준비하는 건 현실과 맞지 않아
   * 모델이 "이 면접에서 나올 확률" 기준으로 고른다. 옛 세션은 전부 false.
   */
  mustPrepare: boolean
  /**
   * 꼬리질문이 **무엇을 파고들었는지** (v2.1). 메인 질문은 null.
   *
   * 실제 면접의 꼬리질문은 거의 전부 "내가 한 말" 을 파고든다(`my_memo`·`ai_answer`).
   * `question` 은 답변이 아직 없을 때의 폴백이라 성격이 다르다 — 그걸 구분해 보여줘야
   * 사용자가 "메모를 먼저 쓰는" 순서를 알게 된다.
   */
  followupBasis: 'my_memo' | 'ai_answer' | 'question' | null
  questionText: string
  suggestedAnswer: string | null
  /**
   * AI 답변의 자료 부족 사유. null = 충분.
   *
   * 🔴 **`suggestedAnswer` 에 절대 섞이면 안 되는 내용**이라 필드를 나눴다 — 답변은
   * 면접장에서 그대로 말할 문장인데, 예전엔 모델이 `"자료상 명확한 실패 사례가
   * 있었던 것은 아니지만"` 처럼 본문 안에서 말했다. 면접관은 "자료" 가 뭔지 모른다.
   */
  materialGap: string | null
  sourceLogIds: string[]
  myMemo: string | null
  /**
   * 질문 은행 D1 — **누가 만든 질문인가.** `user` 는 사용자가 직접 적거나 붙여넣은 것이라
   * AI 재생성(전량 삭제)의 대상이 아니고, 화면에도 「내 질문」 배지가 붙는다.
   * 옛 질문은 서버가 `ai` 로 내려준다.
   */
  source: 'ai' | 'user'
  /** 연습(자문자답) 마지막 시각. 아직 안 했으면 null */
  lastPracticedAt: string | null
  /** 연습 자기평가 — `good`(잘함) / `soso`(애매) / `again`(다시). 안 했으면 null */
  lastPracticeResult: 'good' | 'soso' | 'again' | null
  createdAt: string
  updatedAt: string
  /** recursive CTE 결과를 client-side 트리화한 자식 노드 */
  children: InterviewPrepQuestion[]
}

/**
 * 「면접 보기」 자가평가 저장 body — 백엔드 `PracticeQuestionDto` 와 1:1.
 *
 * 🔴 **시각 필드가 없다.** `lastPracticedAt` 은 서버 `now()` 로만 찍힌다 — 임의 필드를
 * 보내면 전역 `forbidNonWhitelisted` 가 400 으로 되돌린다.
 */
export interface RecordPracticeDto {
  result: NonNullable<InterviewPrepQuestion['lastPracticeResult']>
}

/** 질문 은행 D1 — 내가 직접 적은 질문 1건 (`POST .../questions/bulk` items 원소) */
export interface BulkQuestionItem {
  questionText: string
  category?: string | null
  parentQuestionId?: string
}

export interface BulkCreateQuestionsDto {
  items: BulkQuestionItem[]
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

/**
 * 질문 단건 patch. 백엔드 `dto/update-question.dto.ts` 와 1:1.
 *
 * 🔴 **`source: 'user'` 전용은 `questionText` 하나뿐이다.** AI 질문에 보내면 서버가
 * **400** 을 던진다(`'AI 가 만든 질문은 내용을 고칠 수 없어요…'`). 화면은 AI 질문 편집에서
 * 이 키를 **아예 빼서** 그 400 에 도달하지 않게 한다 — 서버 가드는 최후의 방어선이지
 * 사용자가 만나는 문이 아니다.
 *
 * 🔴 **값이 안 바뀌었어도 키를 넣으면 안 된다.** 서버는 `undefined` 여부만 보고 던지고,
 * 그 던짐이 저장보다 먼저라 **같이 보낸 `category` 까지 통째로 날아간다** (부분 반영 없음).
 *
 * `myMemo`·`mustPrepare`·`category` 는 **모든 질문**에서 열려 있다. 셋 다 "AI 가 만든
 * 것인지" 와 무관한 **내가 이 질문을 어떻게 두는가**라서다 — user 전용으로 묶으면
 * 「⭐만」 필터가 직접 추가한 질문에서 영원히 비고, AI 가 잘못 붙인 유형은 흐름 정렬·유형
 * 필터를 어긋난 채 굳힌다 (2026-08-12 백엔드에서 `category` 가 가드 밖으로 나왔다).
 */
export interface UpdateQuestionDto {
  myMemo?: string | null
  questionText?: string
  category?: string | null
  mustPrepare?: boolean
}

/** `POST /interview-prep-sessions/:id/generate` body (질문 은행 D1b) */
export interface GenerateSessionDto {
  /** 이번에 만들 질문 수. 미지정이면 서버 기본 20 */
  count?: number
  /** 지정하면 그 카테고리로 조준 사격. 미지정이면 "부족한 카테고리 위주" */
  category?: string | null
}

export interface CreateFollowupDto {
  hint?: string
}

/**
 * 차단 사유 코드 — **문구가 아니라 코드로 분기한다** (문구로 분기하면 카피를 다듬는
 * 순간 조용히 깨진다). 백엔드 `interview-prep-ai.service.ts` `GenerateBlockCode` 와 1:1.
 *
 * 🔴 `REGENERATE_REQUIRED` 는 **사라졌다** (질문 은행 D1b, 2026-08-11). 그 코드는
 * "생성이 기존 질문·답변을 전부 지운다" 는 전제 위의 가드였는데, 생성이 additive 로
 * 바뀌어 **지울 것 자체가 없어졌다.** 가드를 지운 게 아니라 위험을 지운 것이다.
 */
export type GenerateBlockCode = 'NEED_COVERLETTER'

export interface GenerateSessionResult {
  status: 'ok' | 'blocked'
  /**
   * 차단 사유 문구. **서버가 준다** — 프론트가 고정 문구로 덮으면 진짜 이유
   * (자소서 없음·쿼터·동의·장애)가 사라져 사용자가 막다른 길에 갇힌다.
   */
  reason?: string
  /**
   * `blocked` 일 때만, 그것도 **일부 차단만** 갖는다. 없으면 쿼터·동의·생성 중복 등
   * "코드 없는 차단" 이라 `reason` 을 그대로 보여주는 게 유일한 처리다.
   *
   * 🔴 **`reason` 문자열의 접두어로 오지 않는다.** `NEED_COVERLETTER:` 접두어는
   * 서버가 **audit 로그**(`preBlockedReason`)에만 쓰는 형식이고, 클라이언트 응답은
   * 이 `code` 필드로 온다 (백엔드 실측 2026-08-11).
   */
  code?: GenerateBlockCode
  /**
   * `status: 'ok'` 인데 **요청보다 적게 만든** 경우의 안내 문구 (AI 질문 캡 등).
   * 🔴 문구는 서버가 준다 — 캡 숫자가 바뀌면 프론트도 같이 고쳐야 하는 구조를 만들지 않는다.
   */
  notice?: string
  meta?: {
    callLogId: string
    coverlettersUsed: number
    logsUsed: number
    droppedCount: number
    estimatedInputTokens: number
    mainCount: number
    followupCount: number
    /** 사용자가 요청한 개수 (미지정이면 기본 20) */
    requestedCount: number
    /** 캡을 반영해 실제로 모델에 요청한 개수 */
    effectiveCount: number
    /** 생성 전 기준, 이 세션에 더 만들 수 있는 AI 질문 수 */
    aiCapRemaining: number
  }
}

/**
 * ↻ 낱개 교체 결과 — 교체된 질문 1개를 그대로 돌려준다.
 *
 * 🔴 **`GENERATION_IN_PROGRESS` 는 여기 없다.** 그건 200 blocked 가 아니라 **409 예외**로
 * 온다 (`{ code, message }` 본문). `generateSession` 의 "이미 만들고 있어요" 가 200 blocked
 * 인 것과 **다르다** — 두 경로를 같은 모양으로 다루면 409 를 놓친다.
 */
export interface RegenerateQuestionResult {
  status: 'ok' | 'blocked'
  reason?: string
  code?: GenerateBlockCode
  question?: InterviewPrepQuestion
  meta?: {
    callLogId: string
  }
}

/** ↻ 가 세션 생성과 겹쳤을 때 서버가 409 본문에 담는 코드 */
export const GENERATION_IN_PROGRESS_CODE = 'GENERATION_IN_PROGRESS'

/** 한 세션의 AI 질문 상한 — 백엔드 `MAX_AI_QUESTIONS_PER_SESSION` 과 같은 값이어야 한다 */
export const MAX_AI_QUESTIONS_PER_SESSION = 60

/** 한 번에 만들 수 있는 AI 질문 수 — 백엔드 `GENERATE_COUNT_MIN/MAX` 와 같은 값 */
export const GENERATE_COUNT_MIN = 1
export const GENERATE_COUNT_MAX = 20

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
  /**
   * 생성·↻ 와 **같은 코드다** (백엔드가 면접 AI 4경로에 같은 자소서 게이트를 달았다,
   * 실측 2026-08-11). 있으면 `reason` 토스트 대신 자소서로 가는 길을 띄운다.
   */
  code?: GenerateBlockCode
  question?: InterviewPrepQuestion
  meta?: {
    callLogId: string
  }
}

/**
 * v2 — 답변 1개 생성 결과. `question` 은 답변이 채워진 **갱신된 질문 row** 다.
 *
 * 🔴 `status: 'blocked'` 는 동의 필요·코인 부족·서비스 장애를 **한 값으로 묶는다.**
 * 구분은 서버가 `reason` 문구로 준다 — 프론트가 고정 문구로 덮으면 진짜 이유가 사라져
 * 사용자가 막다른 길에 갇힌다 (2026-07-23 공고정리 실사고).
 */
export interface GenerateAnswerResult {
  status: 'ok' | 'blocked'
  reason?: string
  /**
   * 자소서 게이트만 코드로 온다 — 나머지 차단(동의·코인·장애)은 `reason` 뿐이라
   * 인라인 에러로 그대로 보여주는 게 유일한 처리다 (위 구분이 사라지지 않게).
   */
  code?: GenerateBlockCode
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
  // ── v2 (2026-08-06) ──
  // 🔴 백엔드 `INTERVIEW_CATEGORIES` 에 값을 추가하면 **여기도 같이 추가**해야 한다.
  //    소비처가 `?? cat` 로 폴백해서 화면에 `closing_remark` 슬러그가 그대로 노출된다.
  aspiration: '입사 후 포부',
  closing_remark: '마지막 한마디',
  domain_knowledge: '직무 지식',
  // ── v2.1 (2026-08-07) PT·토론 전용 ──
  presentation_topic: '발표 주제',
  presentation_qa: '발표 질의응답',
  discussion_topic: '토론 논제',
}

/**
 * 질문 유형 색 — **색이 곧 묶음이다** (2026-08-07).
 *
 * 카테고리가 21종이라 한 세션에 칩이 12개쯤 뜬다. 전부 brand 색이면 구분이 안 되고,
 * brand(sage)는 원래 **CTA·active 전용**이라 태그에 쓰는 것 자체가 규칙 위반이었다.
 *
 * 그래서 5개 결로 색을 나눈다 — 사용자는 라벨을 읽기 전에 색으로 "이건 공통, 이건 직무"
 * 를 먼저 안다. 별도 그룹 UI 를 얹지 않고도 묶음 효과가 난다.
 *
 * | 색 | 결 | 왜 |
 * |---|---|---|
 * | info(파랑) | 공통 정형 | 어느 회사든 나오는 것 — 한 번 준비하면 재사용된다 |
 * | violet | 인성·가치관 | 회사·조직 적합성. 답이 회사마다 달라진다 |
 * | success(초록) | 직무 지식 | 직무 fork 가 만든 전문 질문 |
 * | warning(주황) | 자소서 기반 | **내 자료에서 나온 것** — 나만 답할 수 있어 눈에 띄어야 한다 |
 * | 중립 | 마무리 | 역질문·마지막 한마디. 준비 부담이 낮다 |
 *
 * accent(coral)는 쓰지 않는다 — `⭐ 우선` 배지 전용이라 겹치면 그게 안 띈다.
 * 데이터 시각화 예외 (DESIGN.md "단일 브랜드 액센트의 예외").
 */
const COMMON = 'bg-info/10 text-info border border-info/25'
const VALUES = 'bg-violet/10 text-violet border border-violet/25'
const DOMAIN = 'bg-success/10 text-success border border-success/25'
const OWN_MATERIAL = 'bg-warning/10 text-warning border border-warning/25'
const NEUTRAL = 'bg-surface-3 text-text-tertiary border border-line'

export const CATEGORY_STYLE: Record<string, string> = {
  // 공통 정형 — 어느 회사든 나온다
  self_intro: COMMON,
  motivation: COMMON,
  personality: COMMON,
  failure: COMMON,
  collaboration: COMMON,
  aspiration: COMMON,
  // 인성·가치관 — 회사마다 답이 달라진다
  executive: VALUES,
  culture_fit: VALUES,
  company_industry: VALUES,
  // 직무 지식 — fork 가 만든 전문 질문
  cs_tech: DOMAIN,
  business_reasoning: DOMAIN,
  data_metrics: DOMAIN,
  trend_ai: DOMAIN,
  customer_handling: DOMAIN,
  performance: DOMAIN,
  portfolio_decision: DOMAIN,
  design_process: DOMAIN,
  domain_knowledge: DOMAIN,
  // 내 자료 기반 — 나만 답할 수 있다
  coverletter_based: OWN_MATERIAL,
  // PT·토론 — 형식 자체가 다른 준비 재료라 직무 지식과 같은 결로 둔다
  presentation_topic: DOMAIN,
  presentation_qa: DOMAIN,
  discussion_topic: DOMAIN,
  // 마무리
  reverse_question: NEUTRAL,
  closing_remark: NEUTRAL,
}

/**
 * 추궁할 수 있는 답변의 최소 길이 (공백 제외).
 *
 * 🔴 백엔드 `interview-prep-ai.service.ts` `MIN_PROBEABLE_ANSWER_CHARS` 와 **같은 값**이어야
 * 한다. 다르면 "화면엔 안내가 사라졌는데 서버는 질문 심화로 만드는" 어긋남이 생긴다.
 * `ㅏ` 한 글자를 답변으로 치면 모델이 그걸 추궁해 말이 안 되는 질문이 나온다.
 */
export const MIN_PROBEABLE_ANSWER_CHARS = 20

/** 꼬리질문 근거 배지 라벨 — `question` 은 "답변 없이 질문만 보고" 라는 뜻이다 */
export const FOLLOWUP_BASIS_LABEL: Record<string, string> = {
  my_memo: '내 답변 기반',
  ai_answer: 'AI 답변 기반',
  question: '질문 심화',
}

/** 모르는 카테고리(신규 추가 직후 등)는 중립색으로 — 화면이 깨지지 않게 */
export const CATEGORY_STYLE_FALLBACK = NEUTRAL

/**
 * **실제 면접 진행 순서** (2026-08-07).
 *
 * AI 가 만든 순서(`orderIndex`)는 카테고리별로 뭉쳐 나올 뿐 면접 흐름이 아니다.
 * 실제 면접은 자기소개로 열고 마지막 한마디로 닫는 정해진 흐름이 있어서,
 * **그 순서대로 보여야 리허설이 된다.** 번호도 이 순서를 따른다.
 *
 * 🔴 우선순위(`mustPrepare`)로 정렬하지 않는다 — 그러면 "1번 자기소개" 가 중간에 오고
 * 흐름이 깨진다. 우선 질문은 **필터**로 추려 본다 (두 축을 섞지 않는다).
 *
 * 값이 작을수록 앞. 목록에 없는 카테고리는 직무 질문 자리(40)로 본다.
 */
export const CATEGORY_FLOW_ORDER: Record<string, number> = {
  self_intro: 10, // 열기
  motivation: 20,
  coverletter_based: 30, // 면접관이 자소서를 펴고 바로 묻는 자리
  // PT·토론 — 발표/논제가 면접의 본체라 앞쪽에 온다
  presentation_topic: 25,
  discussion_topic: 25,
  presentation_qa: 35,
  // 직무 지식 — fork 가 만든 전문 질문 (40 대)
  cs_tech: 40,
  domain_knowledge: 40,
  business_reasoning: 41,
  data_metrics: 41,
  trend_ai: 42,
  customer_handling: 43,
  performance: 44,
  portfolio_decision: 45,
  design_process: 46,
  // 경험·인성
  failure: 50,
  collaboration: 51,
  personality: 52,
  // 회사·가치관 (후반부)
  company_industry: 60,
  culture_fit: 61,
  executive: 62,
  aspiration: 70,
  // 닫기
  reverse_question: 90,
  closing_remark: 99,
}

/** 흐름 순서를 모르는 카테고리는 직무 질문 자리로 (중간) */
export const CATEGORY_FLOW_FALLBACK = 40

/**
 * 면접 종류 라벨 — 백엔드 `interview-types.const.ts` `INTERVIEW_TYPES` 와 값 1:1.
 * 프롬프트용 라벨은 백엔드 `INTERVIEW_TYPE_GUIDE` 가 따로 들고 있다 (문장이 더 길다).
 */
export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  job_fit: '실무·직무',
  personality: '임원·인성',
  technical: '기술',
  presentation: 'PT·발표',
  discussion: '토론',
  etc: '기타',
}

/**
 * 면접 종류 색 — chip/badge 색상 표준. 라이트·다크 모두 호환 (의미 토큰 + alpha modifier).
 * 데이터 시각화 예외 (DESIGN.md Section: 단일 브랜드 액센트의 예외).
 */
export const INTERVIEW_TYPE_STYLE: Record<InterviewType, string> = {
  job_fit: 'bg-violet/10 border-violet/30 text-violet',
  personality: 'bg-success/10 border-success/30 text-success',
  technical: 'bg-info/10 border-info/30 text-info',
  presentation: 'bg-warning/10 border-warning/30 text-warning',
  discussion: 'bg-accent/10 border-accent/30 text-accent',
  etc: 'bg-surface-3 border-line text-text-tertiary',
}
