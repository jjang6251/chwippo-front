import { apiClient } from './client'
import { useAuthStore } from '@/stores/authStore'
import type { CompanyResearchResult } from '@/types/interviewPrep'

/**
 * F1 자소서 풀페이지 — application 단위 endpoint 모음.
 * Phase B: research (cache 우선 + miss/expired 시 LLM fetch).
 * Phase D: chat / messages (DB 영구 + 90일 KST cron).
 */

export type CoverletterChatRole = 'user' | 'assistant'

export interface CoverletterSuggestedUpdate {
  clId: string
  newAnswer: string
}

export interface CoverletterCitations {
  /** user role 일 때 */
  selectedLogIds?: string[]
  /** assistant role 일 때 — AI 활용 log */
  citedLogIds?: string[]
  /** assistant role 일 때 — 회사 조사 활용 여부 */
  citedResearch?: boolean
}

export interface CoverletterChatMessage {
  id: string
  applicationId: string
  role: CoverletterChatRole
  content: string
  suggestedUpdates: CoverletterSuggestedUpdate[] | null
  citations: CoverletterCitations | null
  createdAt: string
}

/** myinfo 자소서 소재 6 카테고리 + custom:<uuid> 형태 */
export type MyinfoFieldKey =
  | 'personality'
  | 'background'
  | 'job_competency'
  | 'own_strength'
  | 'collaboration'
  | 'challenge'
  | `custom:${string}`

export interface ChatSendDto {
  userMessage: string
  selectedLogIds?: string[]
  /** myinfo 자소서 소재 — sidebar 에서 선택한 카테고리·custom 키. backend 가 IDOR 검증 후 prompt inject */
  selectedMyinfoFieldKeys?: MyinfoFieldKey[]
  /** myinfo 수상 — sidebar 에서 선택한 award id 들. backend 가 본인 user 검증 후 prompt inject */
  selectedAwardIds?: string[]
}

export type ChatAssistantStatus =
  | 'ok'
  | 'truncated'
  | 'blocked_consent'
  | 'blocked_quota'
  | 'blocked_moderation'
  | 'error'
  | 'fallback_ok'

export interface ChatResult {
  userMessage: CoverletterChatMessage
  assistantMessage: CoverletterChatMessage
  assistantStatus: ChatAssistantStatus
  /** error/blocked/truncated 시 한국어 사유. UI 토스트·bubble 라벨에 사용 */
  assistantStatusReason?: string
}

// Backend ResponseTransformInterceptor 가 모든 응답을 `{data, message: 'ok'}` envelope 으로 감쌈.
// 따라서 axios res.data = envelope, envelope.data = 실제 payload. 두 단계 unwrap 필요.
const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const coverletterDocApi = {
  // ── research ──
  getResearch: (applicationId: string) =>
    apiClient
      .get(`/applications/${applicationId}/coverletter/research`)
      .then(unwrap<CompanyResearchResult | null>),

  // ── chat ──
  listMessages: (applicationId: string) =>
    apiClient
      .get(`/applications/${applicationId}/coverletter/messages`)
      .then(unwrap<CoverletterChatMessage[]>),

  sendChat: (applicationId: string, dto: ChatSendDto) =>
    apiClient
      .post(`/applications/${applicationId}/coverletter/chat`, dto)
      .then(unwrap<ChatResult>),

  /**
   * Phase 4 — Streaming chat (SSE).
   * fetch + ReadableStream reader (EventSource 는 Authorization header 미지원).
   *
   * Event types (backend coverletter-chat.service.chatStream):
   * - 'user_saved' { userMessage } — user message DB 저장 직후 (optimistic placeholder 교체)
   * - 'partial' { reply, suggestedUpdates? } — chunk 마다 partial JSON
   * - 'done' { assistantMessage, assistantStatus, assistantStatusReason } — 종료
   * - 'error' { message } — provider 또는 검증 실패
   *
   * Caller 가 abortSignal 로 cancel 가능. fetch 가 reject 하면 onError 콜백.
   */
  sendChatStream: async (
    applicationId: string,
    dto: ChatSendDto,
    handlers: {
      onUserSaved: (userMessage: CoverletterChatMessage) => void
      onPartial: (data: {
        reply?: string
        suggestedUpdates?: CoverletterSuggestedUpdate[]
      }) => void
      onDone: (data: {
        assistantMessage: CoverletterChatMessage
        assistantStatus: ChatAssistantStatus
        assistantStatusReason?: string
      }) => void
      onError: (message: string) => void
      signal?: AbortSignal
    },
  ): Promise<void> => {
    // Authorization 헤더 — apiClient 인스턴스의 store 에서 직접 가져옴
    const token = useAuthStore.getState().accessToken
    const url = `${import.meta.env.VITE_API_URL}/applications/${applicationId}/coverletter/chat/stream`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(dto),
      credentials: 'include',
      signal: handlers.signal,
    })
    if (!res.ok || !res.body) {
      handlers.onError(`HTTP ${res.status}`)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE event 단위 parse: \n\n 으로 split. event: <type>\ndata: <json>
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const evtBlock of events) {
        const lines = evtBlock.split('\n')
        let eventType = ''
        let dataLine = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) eventType = line.slice(7)
          else if (line.startsWith('data: ')) dataLine = line.slice(6)
        }
        if (!eventType || !dataLine) continue
        try {
          const data = JSON.parse(dataLine) as Record<string, unknown>
          if (eventType === 'user_saved') {
            handlers.onUserSaved(data.userMessage as CoverletterChatMessage)
          } else if (eventType === 'partial') {
            handlers.onPartial({
              reply: data.reply as string | undefined,
              suggestedUpdates: data.suggestedUpdates as
                | CoverletterSuggestedUpdate[]
                | undefined,
            })
          } else if (eventType === 'done') {
            handlers.onDone({
              assistantMessage: data.assistantMessage as CoverletterChatMessage,
              assistantStatus: data.assistantStatus as ChatAssistantStatus,
              assistantStatusReason: data.assistantStatusReason as string | undefined,
            })
          } else if (eventType === 'error') {
            handlers.onError((data.message as string) ?? 'unknown')
          }
        } catch {
          // 빈 줄·잘못된 chunk → skip
        }
      }
    }
  },

  deleteMessages: (applicationId: string) =>
    apiClient
      .delete(`/applications/${applicationId}/coverletter/messages`)
      .then(unwrap<{ ok: boolean }>),
}
