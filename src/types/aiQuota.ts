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
  // v2 (2026-08-06) — 세션·꼬리질문이 질문만 만들게 되면서 신설. 답변 1개 on-demand 생성
  | 'interview_prep_answer'
  | 'company_research'
  | 'coverletter_chat'
  | 'jobposting_parse'
  // 노트 AI 패널 (2026-08-19) — 공부 노트·준비 노트 본문 선택 변환 / 무선택 생성
  | 'note_ai_action'

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

/**
 * GET /me/ai-costs 응답 — 백엔드 `src/ai/my-ai-costs.controller.ts` `AiCostEstimate` 와 1:1.
 *
 * 🔴 **단가를 프론트에 박지 않으려고 있는 API 다.** admin 이 `feature_coin_meta` 를 고치면
 * 화면 숫자도 같이 움직여야 한다.
 */
export interface AiCostEstimate {
  feature: LlmFeature
  /** false = 우리 부담 (차감 0) */
  chargesCoins: boolean
  /**
   * 🔴 **예약치이지 청구액이 아니다.** 실제 차감은 끝난 뒤 토큰 실비로 환산하므로
   * 보통 이보다 적다. 화면 문구도 "약 N코인" 처럼 근사로 쓴다.
   */
  estimatedCoins: number
  /**
   * 예약치가 `count` 에 따라 달라지는가. 지금은 항상 false —
   * false 면 슬라이더를 움직여도 **재조회할 필요가 없다.**
   */
  countSensitive: boolean
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
