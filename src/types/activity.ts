// mock (plans/activity-journal-mock.html) 와 backend entity 와 1:1.

export type ActivityType =
  | 'intern'
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
}

export type UpdateActivityDto = Partial<CreateActivityDto> & {
  /** 활동 총괄 회고 — null 또는 빈 string 으로 clear */
  summaryReflection?: string | null
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
