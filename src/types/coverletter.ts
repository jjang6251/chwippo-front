export const COVERLETTER_CATEGORIES = [
  '지원동기',
  '성장과정·가치관',
  '입사후포부',
  '직무역량·핵심경험',
  '협업·갈등경험',
  '도전·실패경험',
  '기타',
] as const

export type CoverletterCategory = (typeof COVERLETTER_CATEGORIES)[number]

export const COVERLETTER_CATEGORY_EMOJI: Record<string, string> = {
  '지원동기': '🎯',
  '성장과정·가치관': '🌱',
  '입사후포부': '🚀',
  '직무역량·핵심경험': '🛠️',
  '협업·갈등경험': '🤝',
  '도전·실패경험': '🔥',
  '기타': '🏷️',
}

export const COVERLETTER_CATEGORY_STYLE: Record<string, string> = {
  '지원동기': 'text-sky-800 bg-sky-800/10 border-sky-800/25 dark:text-sky-300 dark:bg-sky-300/10 dark:border-sky-300/25',
  '성장과정·가치관': 'text-emerald-800 bg-emerald-800/10 border-emerald-800/25 dark:text-emerald-300 dark:bg-emerald-300/10 dark:border-emerald-300/25',
  '입사후포부': 'text-amber-800 bg-amber-800/10 border-amber-800/25 dark:text-amber-300 dark:bg-amber-300/10 dark:border-amber-300/25',
  '직무역량·핵심경험': 'text-violet-800 bg-violet-800/10 border-violet-800/25 dark:text-violet-300 dark:bg-violet-300/10 dark:border-violet-300/25',
  '협업·갈등경험': 'text-rose-800 bg-rose-800/10 border-rose-800/25 dark:text-rose-300 dark:bg-rose-300/10 dark:border-rose-300/25',
  '도전·실패경험': 'text-orange-800 bg-orange-800/10 border-orange-800/25 dark:text-orange-300 dark:bg-orange-300/10 dark:border-orange-300/25',
  '기타': 'text-text-tertiary bg-card border-line',
}

export const coverletterCategory = (c: string | null) =>
  c && COVERLETTER_CATEGORY_STYLE[c] ? c : '기타'

/** A1 — AI 심층 점검 결과 (짚어주기: 잘한 점 + 인용 지적 + 예시 + 총평). */
export interface CoverletterFeedbackIssue {
  kind:
    | 'ai_tone'
    | 'structure'
    | 'question_mismatch'
    | 'company_mismatch'
    | 'over_limit'
    | 'vague'
  quote: string
  advice: string
}

/**
 * D0 (2026-08-01 실사고) — 배열·문자열 필드가 전부 **optional** 이다.
 *
 * 백엔드가 정규화를 시작했으므로 *앞으로* 저장되는 값은 완전하지만,
 * **그 이전에 `last_feedback` 에 저장된 불완전한 값이 DB 에 남아 있다.**
 * 재진입 시 그 값을 그대로 읽으므로 타입이 "항상 있다"고 선언하면 tsc 가 아무것도 못 막는다
 * (실제로 `suggestions.length` 에서 크래시했다).
 *
 * 소비 측은 반드시 `?? []` 로 방어할 것.
 */
export interface CoverletterFeedback {
  strengths?: string[]
  issues?: CoverletterFeedbackIssue[]
  suggestions?: Array<{ target: string; improved: string }>
  summary?: string
}

export interface CoverletterFeedbackResult {
  status: 'ok' | 'blocked' | 'error'
  reason?: string
  feedback?: CoverletterFeedback
  /** D0 — 출력 한도로 결과가 일부만 생성됨. 코인은 정상 차감 (부분 결과도 가치 있음) */
  truncated?: boolean
}

export interface ApplicationCoverletter {
  id: string
  applicationId: string
  question: string
  category: string | null
  answer: string | null
  charLimit: number | null
  orderIndex: number
  createdAt: string
  updatedAt: string
  /** A1 — 마지막 AI 점검 결과 (서버 저장). 없으면 null */
  lastFeedback?: CoverletterFeedback | null
  lastFeedbackAt?: string | null
}

export interface CreateCoverletterDto {
  question: string
  category?: string
  answer?: string
  charLimit?: number
}

export interface UpdateCoverletterDto {
  question?: string
  category?: string
  answer?: string
  charLimit?: number | null
}

export interface CoverletterReuseOption {
  id: string
  question: string
  category: string | null
  answer: string
  applicationId: string
  companyName: string
}
