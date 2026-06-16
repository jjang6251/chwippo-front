/**
 * F6 PR 1 — coverletter_source_refs 타입.
 * 백엔드 src/applications/coverletter-source-ref.entity.ts 와 일치.
 */
export interface CoverletterSourceRef {
  id: string
  coverletterId: string
  /** XOR with sourceReflectionId */
  sourceLogId: string | null
  sourceReflectionId: string | null
  snippetText: string | null
  partialRange: Record<string, unknown> | null
  /** AI 자동 추천 vs 사용자 명시 (사이드 패널 "AI 추천 칩" 표시 결정) */
  aiRecommended: boolean
  createdAt: string
}

/** POST 입력 — XOR (sourceLogId 또는 sourceReflectionId 정확히 하나) */
export interface CreateCoverletterSourceRefDto {
  sourceLogId?: string
  sourceReflectionId?: string
  snippetText?: string
  partialRange?: Record<string, unknown>
  /** 일반 사용자 명시 추가 시 생략 (default false). ai-draft service 가 true 로 bulk insert */
  aiRecommended?: boolean
}

/** POST /coverletters/:clId/ai-draft 입력 */
export interface GenerateAiDraftDto {
  /** 사용자가 사이드 패널에서 체크한 ref ID 들 (priority 1) */
  selectedSourceRefIds?: string[]
  /** true 면 AI 추천 단계 skip (사용자가 본인 선택만으로 진행) */
  skipRecommend?: boolean
}

/** POST /coverletters/:clId/ai-draft 응답 */
export interface AiDraftResult {
  status: 'ok' | 'blocked'
  /** blocked 시 null */
  answer: string | null
  /** blocked 사유 (사용자 표시용) */
  reason?: string
  meta?: {
    draftCallLogId: string
    recommendCallLogId: string | null
    estimatedInputTokens: number
    logsUsed: number
    reflectionsUsed: number
    droppedCount: number
    /** drop 된 ref id (UI "컨텍스트에 안 들어감" 표시) */
    droppedRefIds: string[]
    /** 새로 생성된 ref id (selected + AI 추천) */
    createdRefIds: string[]
  }
}
