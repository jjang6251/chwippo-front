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
  '지원동기': 'text-sky-400 bg-sky-400/10 border-sky-400/25',
  '성장과정·가치관': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  '입사후포부': 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  '직무역량·핵심경험': 'text-violet-400 bg-violet-400/10 border-violet-400/25',
  '협업·갈등경험': 'text-rose-400 bg-rose-400/10 border-rose-400/25',
  '도전·실패경험': 'text-orange-400 bg-orange-400/10 border-orange-400/25',
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

export interface CoverletterFeedback {
  strengths: string[]
  issues: CoverletterFeedbackIssue[]
  suggestions: Array<{ target: string; improved: string }>
  summary: string
}

export interface CoverletterFeedbackResult {
  status: 'ok' | 'blocked' | 'error'
  reason?: string
  feedback?: CoverletterFeedback
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
