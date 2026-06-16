/** 백엔드 LlmFeature enum 과 sync — admin 통제 가능한 모든 LLM feature.
 * 5.6.1 — seed 12 feature 전체 (legacy/deprecated 포함). FEATURE_LABEL 매트릭스도 1:1.
 */
export type LlmFeature =
  | 'note_summary'
  | 'coverletter' // legacy
  | 'interview' // legacy
  | 'interview_followup' // legacy
  | 'score' // deprecated
  | 'analysis' // deprecated
  | 'auto_tag' // deprecated
  | 'coverletter_draft_v2'
  | 'coverletter_feedback'
  | 'coverletter_recommend'
  | 'interview_prep_session'
  | 'interview_prep_followup'
  | 'company_research'
  | 'coverletter_chat'

/** GET /me/ai-quotas 응답 row */
export interface MyAiQuotaRow {
  feature: LlmFeature
  enabled: boolean
  dayUsed: number
  dayLimit: number
  monthUsed: number
  monthLimit: number
  cooldownSeconds: number
  nextAvailableAt: string | null
}

/** admin 통제 가능 tier. PR_B2 Phase 0 — CoinTier 통일 ('pro'→'lite', 'enterprise'→'standard') */
export type QuotaTier = 'free' | 'lite' | 'standard'

/** admin/ai-feature-quotas 매트릭스 row */
export interface FeatureQuotaConfig {
  feature: LlmFeature
  tier: QuotaTier
  dayLimit: number
  monthLimit: number
  cooldownSeconds: number
  enabled: boolean
  /** 5.6.8 — 리소스별 24h 한도 (note_summary 만 사용). NULL = 미사용 */
  perResourceDayLimit: number | null
  updatedBy: string | null
  updatedAt: string
}

export interface UpdateFeatureQuotaDto {
  dayLimit?: number
  monthLimit?: number
  cooldownSeconds?: number
  enabled?: boolean
  perResourceDayLimit?: number
}
