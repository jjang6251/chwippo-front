import { apiClient } from './client'
import type {
  Application,
  ApplicationStep,
  PostingExtraDate,
  PostingMeta,
} from '@/types/application'

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

// ────────────────────────────────────────────────────────────────────────
// 공고 붙여넣기 → 카드 자동 생성 (`plans/jobposting-card.md`)
//
// 위 `jobposting_parse` 와 **다른 기능**이다. 저건 카드가 이미 있을 때 요건만 정리하고,
// 이건 카드 자체를 만든다 (회사·직무·전형·날짜·요건 한 번에 · feature `jobposting_card`).
//
// 🔴 원문(rawText) 은 여기서도 저장·응답 어디에도 남지 않는다.
// ────────────────────────────────────────────────────────────────────────

/** 붙여넣기 칸 길이 계약 — DTO 와 같은 값 (양쪽이 어긋나면 400 문구가 화면과 다르게 나온다) */
export const POSTING_RAW_MIN = 30
export const POSTING_RAW_MAX = 10000

/** 서버가 카드를 못 만든 이유 — 각각 화면 문구가 다르다 (generic 뭉개기 금지) */
export type FromPostingBlockCode =
  | 'CONSENT_REQUIRED'
  | 'QUOTA_EXCEEDED'
  | 'TOO_MANY_PENDING'
  | 'ERROR'

/** 보완 질문 — 한 가지만 묻고 바로 만든다 */
export type PostingNeeds = 'company' | 'job'

/**
 * `POST /applications/from-posting` 의 4갈래 봉투를 **판별 가능한 한 벌**로 접은 것.
 *
 * 🔴 서버 봉투(`{card}` / `{needs}` / `{notPosting}` / `{blocked}`)를 그대로 쓰면 소비처마다
 * `'card' in res` 같은 판정을 다시 쓴다. 읽기 경계(`normalizeFromPosting`)에서 한 번만 갈라
 * 그 뒤로는 `kind` 하나만 본다.
 */
export type FromPostingResult =
  | { kind: 'card'; card: Application }
  | { kind: 'needs'; needs: PostingNeeds; hash: string; candidates: string[] }
  | { kind: 'notPosting' }
  | { kind: 'blocked'; code: FromPostingBlockCode; reason: string | null }

/** 보완 대기 중인 초안 — 새로고침 후 「생성 중」 카드를 되살리는 재료 (서버 Redis 10분) */
export interface PendingPostingDraft {
  hash: string
  needs: PostingNeeds
  candidates: string[]
  /** 파서가 찾은 값 — 직무 보완 카드에 「회사는 이미 알아요」를 보여주려고 */
  companyName: string | null
  jobTitle: string | null
  createdAt: string | null
}

// ── 읽기 경계 정규화 ─────────────────────────────────────────
//
// 🔴 `as` 로 타입을 거짓말시키지 않는다. LLM 파싱 결과가 그대로 실려 오는 응답이라
// 「타입이 있다고 말하는데 런타임에 없는」 상태가 가장 비싼 실패다 (`normalizeJobPosting` 주석).

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

function normalizeExtraDates(v: unknown): PostingExtraDate[] {
  if (!Array.isArray(v)) return []
  const out: PostingExtraDate[] = []
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const label = str(r.label)
    const date = str(r.date)
    const noteId = str(r.noteId)
    // 셋 중 하나라도 없으면 화면에 그릴 수 없다 — 빈 줄을 만들지 않는다
    if (!label || !date || !noteId) continue
    out.push({ label, date, noteId })
  }
  return out
}

const JOB_PICKED = ['profile', 'single', 'chosen', 'typed'] as const
const COMPANY_SOURCE = ['parsed', 'typed'] as const
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null
}

export function normalizePostingMeta(v: unknown): PostingMeta | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  return {
    filled: strArr(r.filled),
    deadlineKind: str(r.deadlineKind),
    jobPicked: oneOf(r.jobPicked, JOB_PICKED),
    companySource: oneOf(r.companySource, COMPANY_SOURCE),
    editedFields: strArr(r.editedFields),
    reviewedAt: str(r.reviewedAt),
    extraDates: normalizeExtraDates(r.extraDates),
    orderConflict: r.orderConflict === true,
    callCount: typeof r.callCount === 'number' ? r.callCount : 1,
  }
}

function normalizeStep(v: unknown, index: number): ApplicationStep | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const id = str(r.id)
  const name = str(r.name)
  if (!id || name === null) return null
  return {
    id,
    applicationId: str(r.applicationId) ?? '',
    orderIndex: typeof r.orderIndex === 'number' ? r.orderIndex : index,
    name,
    scheduledDate: str(r.scheduledDate),
    location: str(r.location),
    notes: str(r.notes),
    pinnedContent: str(r.pinnedContent),
    dateHint: str(r.dateHint),
  }
}

/**
 * 응답의 `card` → 화면이 믿어도 되는 `Application`.
 *
 * 필수 셋(`id`·`companyName`·`steps` 배열)이 없으면 **카드로 치지 않는다** — 반쪽짜리를
 * 보드에 얹느니 「잠시 후 다시」가 정직하다. 나머지는 목록 refetch 가 곧 덮어쓰므로
 * 여기선 렌더가 죽지 않을 기본값을 채운다.
 */
export function normalizePostingCard(v: unknown): Application | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const id = str(r.id)
  const companyName = str(r.companyName)
  if (!id || !companyName) return null
  const steps = Array.isArray(r.steps)
    ? r.steps
        .map((s, i) => normalizeStep(s, i))
        .filter((s): s is ApplicationStep => s !== null)
    : []
  const status = r.status
  return {
    id,
    userId: str(r.userId) ?? '',
    companyName,
    jobTitle: str(r.jobTitle),
    jobCategory: str(r.jobCategory),
    status:
      status === 'PLANNED' || status === 'PASSED' || status === 'FAILED'
        ? status
        : 'IN_PROGRESS',
    jobUrl: str(r.jobUrl),
    memo: str(r.memo),
    currentStepIndex: typeof r.currentStepIndex === 'number' ? r.currentStepIndex : 0,
    needsDetail: r.needsDetail === true,
    isStarred: r.isStarred === true,
    createdVia: 'paste_posting',
    steps,
    jobPosting: normalizeJobPosting(r.jobPosting as JobPosting | null | undefined),
    postingMeta: normalizePostingMeta(r.postingMeta),
    createdAt: str(r.createdAt) ?? '',
    updatedAt: str(r.updatedAt) ?? '',
  }
}

const BLOCK_CODES: readonly FromPostingBlockCode[] = [
  'CONSENT_REQUIRED',
  'QUOTA_EXCEEDED',
  'TOO_MANY_PENDING',
  'ERROR',
]

/**
 * 🔴 **읽기 경계 1회 정규화.** 여기를 통과한 뒤로는 타입이 참이다.
 *
 * 알아볼 수 없는 모양이면 `blocked/ERROR` 로 떨어뜨린다 — 「모르는 응답」을 성공으로도
 * 보완 질문으로도 볼 수 없고, 생성 중 카드가 영원히 도는 게 가장 나쁘다.
 */
export function normalizeFromPosting(raw: unknown): FromPostingResult {
  if (!raw || typeof raw !== 'object') {
    return { kind: 'blocked', code: 'ERROR', reason: null }
  }
  const r = raw as Record<string, unknown>

  if (r.blocked === true) {
    const code = BLOCK_CODES.find((c) => c === r.code) ?? 'ERROR'
    return { kind: 'blocked', code, reason: str(r.reason) }
  }
  if (r.notPosting === true) return { kind: 'notPosting' }

  const needs = r.needs
  if (needs === 'company' || needs === 'job') {
    const hash = str(r.hash)
    // hash 없이는 commit 도 2차 파싱도 못 한다 — 물어볼 수 없는 질문은 띄우지 않는다
    if (!hash) return { kind: 'blocked', code: 'ERROR', reason: null }
    return { kind: 'needs', needs, hash, candidates: strArr(r.candidates) }
  }

  const card = normalizePostingCard(r.card)
  if (card) return { kind: 'card', card }

  return { kind: 'blocked', code: 'ERROR', reason: null }
}

/** `GET /applications/from-posting/pending` 응답 → 화면이 믿어도 되는 목록 */
export function normalizePendingDrafts(raw: unknown): PendingPostingDraft[] {
  if (!raw || typeof raw !== 'object') return []
  const drafts = (raw as Record<string, unknown>).drafts
  if (!Array.isArray(drafts)) return []
  const out: PendingPostingDraft[] = []
  for (const d of drafts) {
    if (!d || typeof d !== 'object') continue
    const r = d as Record<string, unknown>
    const hash = str(r.hash)
    const needs = r.needs
    if (!hash || (needs !== 'company' && needs !== 'job')) continue
    out.push({
      hash,
      needs,
      candidates: strArr(r.candidates),
      companyName: str(r.companyName),
      jobTitle: str(r.jobTitle),
      createdAt: str(r.createdAt),
    })
  }
  return out
}

export interface ParseForCardBody {
  rawText: string
  /** 직무 보완 후 2차 파싱 — 그 부문 기준으로 요건을 다시 정리한다 */
  jobContext?: string
}

export interface CommitCardBody {
  /**
   * 🔴 초안 **본문을 되돌려 보내지 않는다** — 서버 Redis 의 hash 참조만 보낸다.
   * 클라가 초안을 들고 있다가 되보내면 조작된 초안으로 카드를 만들 수 있다.
   */
  hash: string
  companyName?: string
  jobContext?: string
}

export const jobPostingCardApi = {
  parse: (body: ParseForCardBody) =>
    apiClient
      .post('/applications/from-posting', body)
      .then(unwrap<unknown>)
      .then(normalizeFromPosting),

  commit: (body: CommitCardBody) =>
    apiClient
      .post('/applications/from-posting/commit', body)
      .then(unwrap<unknown>)
      .then(normalizeFromPosting),

  pending: () =>
    apiClient
      .get('/applications/from-posting/pending')
      .then(unwrap<unknown>)
      .then(normalizePendingDrafts),

  /** 「좋아요」·[확인]·인라인 수정 — 멱등 */
  patchMeta: (
    applicationId: string,
    body: { reviewed?: boolean; editedFields?: string[] },
  ) =>
    apiClient
      .patch(`/applications/${applicationId}/posting-meta`, body)
      .then(unwrap<{ postingMeta: unknown }>)
      .then((r) => normalizePostingMeta(r?.postingMeta)),
}
