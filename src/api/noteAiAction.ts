import { apiClient } from './client'

/**
 * 노트 AI 패널 — 선택 영역 변환 / 무선택 생성 (feature `note_ai_action`).
 *
 * API 계약 (백·프 공통 고정):
 *   POST /study-notes/:id/ai-action
 *   POST /applications/:appId/steps/:stepId/ai-action
 *   body  { action, selectionMd?, instruction?, history? }
 *   200   { status: 'ok', markdown, cached?, quota }
 *         | { status: 'blocked_*', code?, reason?, quota }
 *         | { status: 'error', errorKind?, reason?, quota }
 *
 * 🔴 **이 층은 얇다.** 상태 분기·문구·토스트는 `useNoteAiAction` 이 맡는다 —
 * 에러 문구는 서버가 정하고(`serverMessage`), 여기서 만들어 덮지 않는다.
 *
 * 🔴 **D6 — 대화는 서버에 저장되지 않는다.** 히스토리는 클라이언트가 들고 다니며
 * 요청마다 실어 보낸다(무상태 멀티턴). 조회 엔드포인트가 없는 이유다.
 */

/** 액션 5종. `free` = 자유 지시(선택 변환·무선택 생성 공용) */
export type NoteAiActionKind = 'easy' | 'concise' | 'table' | 'qa_toggle' | 'free'

/** 무상태 멀티턴 컨텍스트 1항목. 서버는 이걸 신뢰 경계 밖으로 취급한다 */
export interface NoteAiHistoryItem {
  role: 'user' | 'result'
  text: string
}

export interface NoteAiActionBody {
  action: NoteAiActionKind
  /** 선택 영역(최상위 블록으로 확장 후 직렬화한 마크다운). 없으면 생성 모드 */
  selectionMd?: string
  /** 자유 지시·이어서 고치기 */
  instruction?: string
  /** 최근 3턴 (= 최대 6항목). 오래된 턴은 클라이언트가 잘라 보낸다 */
  history?: NoteAiHistoryItem[]
}

/**
 * 서버가 응답에 동봉하는 잔여 스냅샷 (`{ used, limit }`).
 *
 * 화면의 단일 소스는 `['me','ai-quotas']`(= `AiQuotaChip`) 이고 이건 그 순간의 참고치다.
 */
export interface NoteAiQuotaSnapshot {
  used: number
  limit: number
}

/** audit 추적용 — 캐시 hit 이면 LLM 을 안 불렀으므로 `callLogId` 가 null 이다 */
export interface NoteAiMeta {
  callLogId: string | null
}

export interface NoteAiActionOk {
  status: 'ok'
  /** 결과 마크다운 (html:false 파서 경유 — 원문 HTML 은 들어오지 않는다) */
  markdown: string
  /** 입력 hash 24h 캐시 hit — 코인 무차감 */
  cached?: boolean
  /**
   * 출력 한도에서 잘렸다 (`finish_reason === 'length'`).
   *
   * 🔴 **성공이지만 온전하지 않다.** 조용히 넘기면 사용자는 뒷부분이 빠진 표를 그대로
   * 본문에 넣는다 — 결과 카드에 경고를 띄워 「나눠서 다시」로 안내한다.
   */
  truncated?: boolean
  quota?: NoteAiQuotaSnapshot
  meta?: NoteAiMeta
}

/** 차단 계열. 🔴 `ALREADY_RUNNING` 은 `blocked_quota` + `code` 로 온다 (선분기 필요) */
export interface NoteAiActionBlocked {
  status:
    | 'blocked_consent'
    | 'blocked_quota'
    | 'blocked_moderation'
    | 'blocked_input_cap'
    /** feature·사용자 일 cost cap 도달 — 한도(횟수)와 별개 축이다 */
    | 'blocked_cost_quota'
  code?: 'ALREADY_RUNNING' | 'QUOTA_EXCEEDED' | 'CONSENT_REQUIRED' | string
  /** 서버 한국어 사유 — 프론트 문구보다 **우선**한다 */
  reason?: string
  quota?: NoteAiQuotaSnapshot
}

/** 실패. 🔴 provider 장애는 `error` + `errorKind: 'provider_outage'` 다 (blocked 아님) */
export interface NoteAiActionError {
  status: 'error'
  errorKind?: 'provider_outage' | string
  reason?: string
  quota?: NoteAiQuotaSnapshot
}

export type NoteAiActionResult =
  | NoteAiActionOk
  | NoteAiActionBlocked
  | NoteAiActionError

export function isNoteAiOk(r: NoteAiActionResult): r is NoteAiActionOk {
  return r.status === 'ok'
}

export function isNoteAiBlocked(r: NoteAiActionResult): r is NoteAiActionBlocked {
  return r.status.startsWith('blocked_')
}

/** 어느 노트에 붙은 패널인가 — 엔드포인트 2개를 하나의 호출부로 묶는다 */
export type NoteAiResource =
  | { type: 'study_note'; noteId: string }
  | { type: 'application_step'; appId: string; stepId: string }

export function noteAiActionPath(resource: NoteAiResource): string {
  return resource.type === 'study_note'
    ? `/study-notes/${resource.noteId}/ai-action`
    : `/applications/${resource.appId}/steps/${resource.stepId}/ai-action`
}

// ResponseTransformInterceptor 가 { data, message } 로 감쌈 → 두 단계 unwrap.
const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const noteAiActionApi = {
  run: (resource: NoteAiResource, body: NoteAiActionBody) =>
    apiClient
      .post(noteAiActionPath(resource), body)
      .then(unwrap<NoteAiActionResult>),
}
