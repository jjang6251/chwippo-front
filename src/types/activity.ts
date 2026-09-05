// mock (plans/activity-journal-mock.html) 와 backend entity 와 1:1.

export type ActivityType =
  | 'intern'
  // ── 경력 3종 — 지원서의 「경력사항」 칸은 인턴·알바만으로 안 채워진다 (대장 44) ──
  | 'fulltime'
  | 'contract'
  | 'freelance'
  | 'club'
  | 'study'
  | 'project'
  | 'sideproject'
  | 'contest'
  | 'research'
  | 'parttime'
  | 'volunteer'
  | 'overseas'
  | 'bootcamp'
  | 'other'

/**
 * 경력 5유형 — 「경력」과 「경험」을 가르는 단 하나의 기준 (CEO 2026-09-06).
 *
 * 저장소는 `activities` 하나지만 화면·모달·게이지는 이 집합으로 둘로 갈린다.
 * `TYPE_GROUPS` 첫 그룹(💼 경력)과 같은 목록이라, 여기를 고치면 그쪽도 같이 봐야 한다.
 * 화면 파일이 아니라 타입 파일에 두는 이유: 창고 화면·폼·게이지 셋이 같은 기준을 봐야 한다.
 */
export const CAREER_TYPES: ReadonlySet<ActivityType> = new Set<ActivityType>([
  'intern', 'parttime', 'fulltime', 'contract', 'freelance',
])

/** 값이 없으면(`null`·미지정) 경력이 아니다 — 분류를 못 한 활동은 경험 쪽에 남는다 */
export const isCareerType = (t?: ActivityType | null): boolean => !!t && CAREER_TYPES.has(t)

export type LogCategory =
  // 취준 실전 3종 (auto-tagger v2)
  | 'coding_test'
  | 'interview'
  | 'apply'
  | 'develop'
  | 'meeting'
  | 'presentation'
  | 'collaboration'
  | 'conflict_resolution'
  | 'learning'
  | 'leadership'
  | 'volunteer'
  | 'customer'
  | 'analysis'
  | 'creative'
  | 'other'
  // activity-redesign — 쉬어가기
  | 'rest'

export type LogComp =
  | 'technical'
  | 'leadership'
  | 'communication'
  | 'planning'
  | 'analytical'
  | 'problem_solving'
  | 'collaboration'
  | 'creativity'
  | 'responsibility'
  | 'adaptability'

export type CoverletterTag =
  | 'personality'
  | 'background'
  | 'job_competency'
  | 'own_strength'
  | 'collaboration'
  | 'challenge'

export type LogMood = 'proud' | 'learning' | 'frustrated' | 'neutral'

export type QuantValue =
  | { type: 'before-after'; before: string; after: string; unit?: string }
  | { type: 'count'; value: string; unit: string; metric?: string }
  | { type: 'raw'; raw: string }

export interface Activity {
  id: string
  userId: string
  name: string
  type: ActivityType | null
  org: string | null
  role: string | null
  resultUrl: string | null
  outcome: string | null
  startedAt: string | null
  endedAt: string | null
  archivedAt: string | null
  /** activity-redesign — 유저별 숨김 기본함 (미분류 로그 컨테이너) */
  isInbox?: boolean
  legacyExperienceId: string | null
  /** 활동 총괄 회고 (베타 피드백 2026-06-23) — 끝난 활동 wrap up. NULL=미작성. 5000자 cap */
  summaryReflection: string | null
  /**
   * 지원서용 요약 (≤500자) — 내 정보 「경험」의 경량 폼이 쓰는 칸.
   * 총괄 회고(5000자·나를 위한 글)와 다르다: 이건 **지원서 칸에 그대로 옮겨 적을 문장**이다.
   */
  applicationSummary?: string | null
  /** 해외 경험의 국가 */
  country?: string | null
  /** 경력 유형의 부서 (≤100) — 지원서 경력 칸이 회사·부서·직위를 함께 묻는다 */
  orgDepartment?: string | null
  /** 재직 중 — `true` 면 서버가 `endedAt` 을 null 로 저장한다 */
  isCurrent?: boolean | null
  logs?: ActivityLog[]
  reflections?: ActivityReflection[]
  createdAt: string
  updatedAt: string
}

export interface ActivityLog {
  id: string
  activityId: string
  userId: string
  content: string
  occurredAt: string
  cat: LogCategory | null
  comps: LogComp[]
  cl: CoverletterTag[]
  quant: QuantValue | null
  mood: LogMood | null
  keywords: string[]
  note: Record<string, unknown> | null
  noteSummary: string | null
  noteSummaryHash: string | null
  noteSummaryAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityReflection {
  id: string
  activityId: string
  userId: string
  content: string
  weekStart: string | null
  growth: string[]
  challenges: string[]
  nextActions: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateActivityDto {
  name: string
  type: ActivityType
  org?: string
  role?: string
  resultUrl?: string
  outcome?: string
  startedAt?: string
  endedAt?: string
  /** 지원서용 요약 (≤500자) — 내 정보 「경험」 경량 폼 입구 */
  applicationSummary?: string
  /** 해외 경험의 국가 */
  country?: string
  /** 경력 유형의 부서 (≤100) */
  orgDepartment?: string
  /** 재직 중 — 서버가 `endedAt` 을 null 로 저장한다 */
  isCurrent?: boolean
}

export type UpdateActivityDto = Omit<
  Partial<CreateActivityDto>,
  'applicationSummary' | 'country' | 'orgDepartment'
> & {
  /** 활동 총괄 회고 — null 또는 빈 string 으로 clear */
  summaryReflection?: string | null
  /** 지원서용 요약 — null 또는 빈 string 으로 clear */
  applicationSummary?: string | null
  /** 국가 — null 로 clear */
  country?: string | null
  /** 부서 — null 로 clear */
  orgDepartment?: string | null
}

export interface CreateActivityLogDto {
  content: string
  occurredAt: string
  cat?: LogCategory
  mood?: LogMood
  comps?: LogComp[]
  cl?: CoverletterTag[]
  quant?: QuantValue | null
  keywords?: string[]
  note?: Record<string, unknown>
}

// activityId — 로그의 활동 이동 (기본함 → 활동 등, activity-redesign)
export type UpdateActivityLogDto = Partial<CreateActivityLogDto> & {
  activityId?: string
}

export interface CreateActivityReflectionDto {
  content: string
  weekStart?: string
  growth?: string[]
  challenges?: string[]
  nextActions?: string[]
}

export type UpdateActivityReflectionDto = Partial<CreateActivityReflectionDto>

export interface SummarizeNoteResult {
  status: 'ok' | 'cached' | 'blocked'
  summary: string | null
  cached: boolean
  reason?: string
  remainingPerNote?: number
  /** 5.6.8 — admin 통제 per-note 한도 (백엔드 응답). UI 가 "N/M" 의 M 동적 표시 */
  perNoteLimit?: number
}

/** activity-redesign — 타임라인 항목 (GET /activity-logs) */
export interface TimelineLogItem {
  id: string
  content: string
  occurredAt: string
  cat: string | null
  cl: string[]
  comps: string[]
  mood: string | null
  quant: QuantValue | null
  keywords: string[]
  hasNote: boolean
  createdAt: string
  activityId: string
  activityName: string
  activityIsInbox: boolean
  relatedStepId: string | null
  stepName: string | null
  companyName: string | null
}

export interface TimelinePage {
  items: TimelineLogItem[]
  nextCursor: string | null
}

/** activity-redesign — 퀵캡처 생성 (활동 미지정 → 기본함) */
export interface QuickCreateLogDto {
  content?: string
  activityId?: string
  relatedStepId?: string
  isRest?: boolean
  occurredAt?: string
}
