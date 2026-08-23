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
/**
 * 🔴 **서버 응답을 화면이 믿을 수 있는 모양으로** — 배열 필드가 비어 와도 `[]` 로 채운다.
 *
 * `JobPosting` 은 배열 필드를 **non-optional 로 선언**하지만, 실제 값은 LLM 파싱 결과를
 * 담은 `job_posting` JSONB 다. 지금 백엔드는 두 쓰기 경로(`cleanArray`·PATCH 병합) 모두
 * 정규화하지만, **타입이 「항상 있다」고 말하는데 런타임에 없을 수 있는 상태**는
 * 2026-08-01 자소서 점검 크래시의 **근본 원인** 그 자체였다(`CoverletterFeedback.strengths`).
 * `as` 단언은 컴파일러만 통과시키고 아무것도 보증하지 않는다.
 *
 * 방어를 `?? []` 로 흩뿌리지 않고 **읽기 경계에서 한 번** 정규화한다 — 소비처가 늘어날 때마다
 * 빠뜨릴 자리가 생기지 않게. 이걸 통과한 뒤에는 타입이 참이다.
 */
export function normalizeJobPosting(
  jp: JobPosting | null | undefined,
): JobPosting | null {
  if (!jp) return null
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  return {
    responsibilities: typeof jp.responsibilities === 'string' ? jp.responsibilities : null,
    requirements: arr(jp.requirements),
    preferred: arr(jp.preferred),
    techStack: arr(jp.techStack),
    qualifications: arr(jp.qualifications),
    keywords: arr(jp.keywords),
    parsedAt: typeof jp.parsedAt === 'string' ? jp.parsedAt : '',
  }
}

export function hasJobPostingData(jp: JobPosting | null | undefined): boolean {
  const n = normalizeJobPosting(jp)
  return (
    !!n &&
    (!!n.responsibilities?.trim() ||
      n.requirements.length > 0 ||
      n.preferred.length > 0 ||
      n.techStack.length > 0 ||
      n.qualifications.length > 0 ||
      n.keywords.length > 0)
  )
}

/** 정리된 요건 항목 총개수 (담당업무 1 + 각 리스트/칩 길이 합) — 접힘 힌트용 */
export function countJobPostingItems(input: JobPosting): number {
  const jp = normalizeJobPosting(input)
  if (!jp) return 0
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
