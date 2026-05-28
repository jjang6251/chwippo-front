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
  legacyExperienceId: string | null
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

export type UpdateActivityDto = Partial<CreateActivityDto>

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

export type UpdateActivityLogDto = Partial<CreateActivityLogDto>

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
