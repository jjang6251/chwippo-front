/**
 * 모든 admin 페이지의 LLM feature 이름을 한국어 라벨로 변환.
 *
 * **사용 정책 (절대 원칙)**: admin 페이지의 모든 feature·model·status·alert_type
 * 표시는 enum 값 그대로 X. **반드시 한국어 라벨로 변환**.
 *
 * 새 feature 추가 시 본 매트릭스에 등록 의무. 미등록은 fallback (원본 그대로) — 단 admin 시각 권장.
 */

export const FEATURE_LABEL_KR: Record<string, string> = {
  // 활성
  note_summary: '노트 요약',
  coverletter_draft_v2: '자소서 AI 답변',
  coverletter_feedback: '자소서 피드백',
  coverletter_recommend: '자소서 추천',
  coverletter_chat: '자소서 채팅',
  interview_prep_session: '면접 질문 생성',
  interview_prep_followup: '면접 꼬리질문',
  company_research: '회사 조사',
  jobposting_parse: '공고 요건 정리',
  // legacy / deprecated
  coverletter: '자소서 (legacy)',
  interview: '면접 (legacy)',
  interview_followup: '면접 꼬리 (legacy)',
  score: '점수 (deprecated)',
  analysis: '분석 (deprecated)',
  auto_tag: '자동 태그 (deprecated)',
}

export function featureLabel(feature: string): string {
  return FEATURE_LABEL_KR[feature] ?? feature
}

/** LLM model 의 짧은 한국어 표기 (admin dashboard). */
export const MODEL_LABEL_KR: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  mock: 'Mock (테스트)',
}

export function modelLabel(model: string): string {
  return MODEL_LABEL_KR[model] ?? model
}

/** Audit log action 의 한국어 라벨 + icon + tone. UserDetailPage / AuditLogs page 공용. */
export const AUDIT_ACTION_KR: Record<
  string,
  {
    label: string
    icon: string
    tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  }
> = {
  grant_coin: { label: '코인 지급', icon: '🪙', tone: 'info' },
  revoke_coin: { label: '코인 환수', icon: '⚖️', tone: 'warning' },
  suspend: { label: '정지', icon: '⛔', tone: 'danger' },
  unsuspend: { label: '정지 해제', icon: '✅', tone: 'success' },
  update_suspend_reason: { label: '정지 사유 변경', icon: '✏️', tone: 'warning' },
  auto_unsuspend: { label: '자동 해제 (만료)', icon: '⏱️', tone: 'success' },
  grant_admin: { label: '관리자 권한 부여', icon: '🛡️', tone: 'info' },
  revoke_admin: { label: '관리자 권한 박탈', icon: '🛡️', tone: 'warning' },
  rename: { label: '닉네임 강제 변경', icon: '✏️', tone: 'neutral' },
  delete: { label: '삭제', icon: '🗑️', tone: 'danger' },
  warn: { label: '경고', icon: '⚠️', tone: 'warning' },
  export: { label: '데이터 export', icon: '📤', tone: 'neutral' },
  update_tier: { label: 'Tier 변경', icon: '⬆️', tone: 'info' },
  reset_ai_quota: { label: 'AI 한도 리셋', icon: '🔄', tone: 'neutral' },
  auto_ban_ai: { label: 'AI 자동 ban', icon: '🚫', tone: 'danger' },
  set_user_ai_quota_override: { label: 'AI 개별 한도 설정', icon: '🎚️', tone: 'warning' },
  clear_user_ai_quota_override: { label: 'AI 개별 한도 해제', icon: '🎚️', tone: 'neutral' },
  update_ai_quota: { label: 'AI 한도 매트릭스 변경', icon: '📊', tone: 'info' },
  update_alert_thresholds: { label: '알람 임계치 변경', icon: '🚨', tone: 'info' },
  close_inquiry: { label: '문의 종료', icon: '📨', tone: 'neutral' },
  reply_inquiry: { label: '문의 답변', icon: '💬', tone: 'info' },
  view_inquiry: { label: '문의 조회', icon: '👁', tone: 'neutral' },
  publish_announcement: { label: '공지 발행', icon: '📣', tone: 'info' },
  update_announcement: { label: '공지 수정', icon: '✏️', tone: 'neutral' },
  delete_announcement: { label: '공지 삭제', icon: '🗑️', tone: 'warning' },
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_KR[action]?.label ?? action
}

/** Alert history 의 alert_type 한국어 라벨. */
export const ALERT_TYPE_KR: Record<string, string> = {
  daily_cost: '일 누적 비용 초과',
  hourly_error_rate: '시간당 에러율 초과',
  vs_yesterday: '전일 대비 비용 폭증',
  abuser_ban: '어뷰저 자동 ban',
  test: '테스트 알람',
  provider_down: 'AI provider 장애',
  provider_up: 'AI provider 복구',
  cost_quota_user: '사용자 일 cost cap 도달',
  cost_quota_feature: 'feature 일 cost cap 도달',
}

export function alertTypeLabel(type: string): string {
  return ALERT_TYPE_KR[type] ?? type
}

/** feature → 카테고리 (AI 한도·사용량 페이지 그룹핑 공용 — AiUsage 필터 optgroup 과 동일 분류) */
export const FEATURE_CATEGORY_KR: Record<string, string> = {
  coverletter_draft_v2: '자소서',
  coverletter_chat: '자소서',
  coverletter_feedback: '자소서',
  coverletter_recommend: '자소서',
  jobposting_parse: '자소서',
  interview_prep_session: '면접',
  interview_prep_followup: '면접',
  company_research: '회사 조사',
  note_summary: '노트',
}

/** 카테고리 표시 순서 — 미분류(legacy 등)는 '기타' 로 맨 뒤 */
export const FEATURE_CATEGORY_ORDER = ['자소서', '면접', '회사 조사', '노트', '기타']

export function featureCategory(feature: string): string {
  return FEATURE_CATEGORY_KR[feature] ?? '기타'
}
