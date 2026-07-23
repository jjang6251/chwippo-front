import { apiClient } from './client'

/**
 * 공고 요건 파싱 — 자소서 페이지 전용 (feature-jobposting-parse).
 *
 * API 계약 (백·프 공통 고정). 아래 shape 은 apiClient unwrap 후 payload 기준.
 *  1. POST /applications/:id/job-posting/parse  body { rawText } (trim·min 30·max 10000)
 *       → { jobPosting, quota } | { notPosting: true, quota } | { blocked: true, code, quota }
 *  2. PATCH /applications/:id/job-posting        body Partial<JobPosting> → { jobPosting }
 *  3. DELETE /applications/:id/job-posting        → 204
 *
 * ⚠️ 원문(rawText) 은 저장·응답 모두 미포함 (파싱 입력으로만 사용 후 폐기).
 */

/** 구조화된 공고 요건 (스키마 job_posting JSONB 와 1:1). */
export interface JobPosting {
  responsibilities: string | null
  requirements: string[]
  preferred: string[]
  techStack: string[]
  qualifications: string[]
  keywords: string[]
  /** ISO — 정리(파싱) 시각 */
  parsedAt: string
}

/** 잔여 조회용 — parse 응답에 동봉 (실시간 캡션 N/limit). */
export interface JobPostingQuota {
  used: number
  limit: number
}

export interface JobPostingParseSuccess {
  jobPosting: JobPosting
  quota: JobPostingQuota
}

export interface JobPostingParseNotPosting {
  notPosting: true
  quota: JobPostingQuota
}

export interface JobPostingParseBlocked {
  blocked: true
  /**
   * QUOTA_EXCEEDED — 오늘 한도 소진 (200 + blocked 봉투).
   * ALREADY_PARSING — 이미 정리 중 (다른 요청/새로고침 재진입). LLM 미호출·차감 없음.
   */
  code: 'QUOTA_EXCEEDED' | 'ALREADY_PARSING' | 'CONSENT_REQUIRED'
  reason?: string
  quota: JobPostingQuota
}

export type JobPostingParseResult =
  | JobPostingParseSuccess
  | JobPostingParseNotPosting
  | JobPostingParseBlocked

/** parse 응답이 "한도 소진" 인지 판별 (200 + blocked 봉투 — 기존 chat 패턴) */
export function isParseBlocked(
  r: JobPostingParseResult,
): r is JobPostingParseBlocked {
  return 'blocked' in r && r.blocked === true
}

/** parse 응답이 "공고 아님" 인지 판별 */
export function isNotPosting(
  r: JobPostingParseResult,
): r is JobPostingParseNotPosting {
  return 'notPosting' in r && r.notPosting === true
}

/** 표시할 만한 공고 요건 데이터가 있는지 (한 섹션이라도 채워짐) */
export function hasJobPostingData(jp: JobPosting | null | undefined): boolean {
  return (
    !!jp &&
    (!!jp.responsibilities?.trim() ||
      jp.requirements.length > 0 ||
      jp.preferred.length > 0 ||
      jp.techStack.length > 0 ||
      jp.qualifications.length > 0 ||
      jp.keywords.length > 0)
  )
}

/** 정리된 요건 항목 총개수 (담당업무 1 + 각 리스트/칩 길이 합) — 접힘 힌트용 */
export function countJobPostingItems(jp: JobPosting): number {
  return (
    (jp.responsibilities?.trim() ? 1 : 0) +
    jp.requirements.length +
    jp.preferred.length +
    jp.techStack.length +
    jp.qualifications.length +
    jp.keywords.length
  )
}

// ResponseTransformInterceptor 가 { data, message } 로 감쌈 → 두 단계 unwrap.
const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const jobPostingApi = {
  parse: (applicationId: string, rawText: string) =>
    apiClient
      .post(`/applications/${applicationId}/job-posting/parse`, { rawText })
      .then(unwrap<JobPostingParseResult>),

  update: (applicationId: string, patch: Partial<JobPosting>) =>
    apiClient
      .patch(`/applications/${applicationId}/job-posting`, patch)
      .then(unwrap<{ jobPosting: JobPosting }>),

  remove: (applicationId: string) =>
    apiClient
      .delete(`/applications/${applicationId}/job-posting`)
      .then(() => undefined),
}
