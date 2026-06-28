import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const agreeTerms = () =>
  apiClient.post('/users/me/terms').then(() => undefined)

export const markOnboarded = () =>
  apiClient.post('/users/me/onboard').then(() => undefined)

// AI 사용 동의 (PIPA 26조). 서버의 CURRENT_AI_CONSENT_VERSION 과 동일해야 저장됨.
export const CURRENT_AI_CONSENT_VERSION = 'v1'

export const agreeAiConsent = (version: string = CURRENT_AI_CONSENT_VERSION) =>
  apiClient
    .post('/users/me/ai-consent', { version })
    .then(() => undefined)

export const withdrawAiConsent = () =>
  apiClient.delete('/users/me/ai-consent').then(() => undefined)

export const updateNickname = (nickname: string) =>
  apiClient.patch('/users/me/nickname', { nickname }).then(unwrap<{ nickname: string }>)

export const deleteAccount = () => apiClient.delete('/users/me')

// W1 — signup 1 질문 (관심 직군) 답변 + 가상 회사 샘플 자동 생성
export interface SignupAnswerBody {
  jobCategories: string[]
  otherText?: string
}
export const postSignupAnswer = (body: SignupAnswerBody) =>
  apiClient.post('/users/me/signup-answer', body).then(() => undefined)

// W1 — 샘플 카드 전체 숨기기 (멱등)
export const dismissAllSampleCards = () =>
  apiClient.post('/users/me/sample-cards/dismiss').then(() => undefined)

export interface DashboardSection {
  id: string
  visible: boolean
}

export interface DashboardConfig {
  sections: DashboardSection[]
}

/**
 * 백엔드 UpdateDashboardConfigDto의 VALID_SECTION_IDS와 동기화.
 * 옛 버전 앱에서 만들어진 orphan section ID(예: deprecated된 'myinfo_progress')가
 * 사용자 DB에 남아있다가 reorder 시 그대로 echo back되면 400. 저장 직전 화이트리스트로 필터.
 */
export const KNOWN_DASHBOARD_SECTION_IDS = [
  'stats',
  'dday',
  'todos',
  'today_schedule',
  'top_applications',
  'goals',
  'calendar_mini',
  'cover_letter_quick',
] as const

export const getDashboardConfig = (): Promise<DashboardConfig> =>
  apiClient.get('/users/me/dashboard-config').then(unwrap<DashboardConfig>)

export const patchDashboardConfig = (config: DashboardConfig): Promise<DashboardConfig> => {
  const sanitized: DashboardConfig = {
    sections: config.sections.filter((s) =>
      (KNOWN_DASHBOARD_SECTION_IDS as readonly string[]).includes(s.id),
    ),
  }
  return apiClient
    .patch('/users/me/dashboard-config', sanitized)
    .then(unwrap<DashboardConfig>)
}
