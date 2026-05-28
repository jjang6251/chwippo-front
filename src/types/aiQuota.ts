/** 백엔드 LlmFeature enum 과 sync — admin 통제 가능한 모든 LLM feature */
export type LlmFeature =
  | 'note_summary'
  | 'coverletter'
  | 'coverletter_draft_v2'
  | 'coverletter_feedback'
  | 'coverletter_recommend'
  | 'interview_prep_session'
  | 'interview_prep_followup'
  | 'company_research'

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
