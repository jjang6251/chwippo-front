import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { coverletterDocApi } from '@/api/coverletterDoc'
import type {
  ChatAssistantStatus,
  ChatSendDto,
  CoverletterChatMessage,
  CoverletterSuggestedUpdate,
} from '@/api/coverletterDoc'

/**
 * F1 자소서 풀페이지 — application 단위 React Query hooks.
 * Phase B: 회사 조사 (cache + fetch).
 *
 * cache key: `['coverletter-doc-research', applicationId]`
 */

const researchKey = (applicationId: string) =>
  ['coverletter-doc-research', applicationId] as const

/**
 * 캐시 조회 (LLM 호출 X). 페이지 mount 시 자동 호출.
 * null 응답 = cache miss → 사용자 또는 자동 fetch 트리거.
 */
export function useCompanyResearchCache(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: researchKey(applicationId),
    queryFn: () => coverletterDocApi.getResearch(applicationId),
    enabled: enabled && !!applicationId,
    staleTime: 60 * 60 * 1000, // 1시간 — 캐시 자체가 90일 TTL 이라 충분
  })
}

/**
 * LLM fetch 트리거 (cache miss/expired 시 자동, 또는 사용자 수동).
 * 성공 시 cache invalidate → useCompanyResearchCache 재조회.
 */
export function useFetchCompanyResearch(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => coverletterDocApi.fetchResearch(applicationId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: researchKey(applicationId) }),
  })
}

// ── chat ──
const messagesKey = (applicationId: string) =>
  ['coverletter-doc-messages', applicationId] as const

/**
 * 채팅 이력 — DB 영구 (90일 KST cron). 페이지 mount 시 자동 로드.
 * 다른 디바이스에서도 동일 application 진입 시 같은 이력 표시.
 */
export function useCoverletterMessages(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: messagesKey(applicationId),
    queryFn: () => coverletterDocApi.listMessages(applicationId),
    enabled: enabled && !!applicationId,
  })
}

/** UI 가 pending placeholder 를 식별하기 위한 reserved id. */
export const PENDING_USER_MSG_ID = '__pending_user__'
export const PENDING_ASSISTANT_MSG_ID = '__pending_assistant__'

/**
 * 메시지 전송 — optimistic update 로 user/assistant placeholder 즉시 표시 후
 * 응답 도착 시 real 메시지로 교체. 사용자 시선 이동 + 진행 상황 명확.
 *
 * - onMutate: user message + assistant "답변 생성중..." placeholder 를 list 끝에 추가
 * - onSuccess: placeholder 2개 제거 + real user/assistant 메시지 append
 * - onError: placeholder 2개 제거 (caller 가 토스트)
 */
export function useSendCoverletterChat(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: ChatSendDto) =>
      coverletterDocApi.sendChat(applicationId, dto),
    onMutate: (dto) => {
      const now = new Date().toISOString()
      const tempUser = {
        id: PENDING_USER_MSG_ID,
        role: 'user' as const,
        content: dto.userMessage,
        suggestedUpdates: null,
        citations:
          dto.selectedLogIds && dto.selectedLogIds.length > 0
            ? { selectedLogIds: dto.selectedLogIds }
            : null,
        createdAt: now,
      }
      const tempAssistant = {
        id: PENDING_ASSISTANT_MSG_ID,
        role: 'assistant' as const,
        content: '',
        suggestedUpdates: null,
        citations: null,
        createdAt: now,
      }
      qc.setQueryData(messagesKey(applicationId), (prev: unknown) => {
        const list = Array.isArray(prev) ? prev : []
        return [...list, tempUser, tempAssistant]
      })
    },
    onSuccess: (res) => {
      qc.setQueryData(messagesKey(applicationId), (prev: unknown) => {
        const list = Array.isArray(prev) ? prev : []
        const filtered = list.filter(
          (m): m is { id: string } =>
            !!m &&
            typeof (m as { id?: unknown }).id === 'string' &&
            (m as { id: string }).id !== PENDING_USER_MSG_ID &&
            (m as { id: string }).id !== PENDING_ASSISTANT_MSG_ID,
        )
        // backend 응답 shape 보호 — userMessage/assistantMessage 둘 다 있어야 append
        const appended = [...filtered]
        if (res?.userMessage?.id) appended.push(res.userMessage)
        if (res?.assistantMessage?.id) appended.push(res.assistantMessage)
        return appended
      })
      qc.invalidateQueries({ queryKey: messagesKey(applicationId) })
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
    },
    onError: () => {
      // placeholder 제거 — caller 의 onError 가 토스트 표시
      qc.setQueryData(messagesKey(applicationId), (prev: unknown) => {
        const list = Array.isArray(prev) ? prev : []
        return list.filter(
          (m): m is { id: string } =>
            !!m &&
            typeof (m as { id?: unknown }).id === 'string' &&
            (m as { id: string }).id !== PENDING_USER_MSG_ID &&
            (m as { id: string }).id !== PENDING_ASSISTANT_MSG_ID,
        )
      })
    },
  })
}

/**
 * Phase 4 — Streaming chat hook (SSE).
 * - sendStream(dto, onDoneCallback?): user 메시지 즉시 placeholder 추가 → chunk 받아 assistant placeholder content 갱신 → done 시 real 메시지로 교체
 * - sending state 노출 (boolean)
 *
 * onDone 콜백은 caller (ChatPanel) 가 토스트·focus 처리 위해 사용.
 */
export function useSendCoverletterChatStream(applicationId: string) {
  const qc = useQueryClient()
  const [sending, setSending] = useState(false)

  const sendStream = useCallback(
    async (
      dto: ChatSendDto,
      onDoneCallback?: (data: {
        assistantMessage: CoverletterChatMessage
        assistantStatus: ChatAssistantStatus
        assistantStatusReason?: string
      }) => void,
      onErrorCallback?: (message: string) => void,
    ): Promise<void> => {
      setSending(true)
      const now = new Date().toISOString()
      const tempUser: CoverletterChatMessage = {
        id: PENDING_USER_MSG_ID,
        applicationId,
        role: 'user',
        content: dto.userMessage,
        suggestedUpdates: null,
        citations:
          dto.selectedLogIds && dto.selectedLogIds.length > 0
            ? { selectedLogIds: dto.selectedLogIds }
            : null,
        createdAt: now,
      }
      const tempAssistant: CoverletterChatMessage = {
        id: PENDING_ASSISTANT_MSG_ID,
        applicationId,
        role: 'assistant',
        content: '',
        suggestedUpdates: null,
        citations: null,
        createdAt: now,
      }
      // optimistic — user + placeholder 모두 추가
      qc.setQueryData(messagesKey(applicationId), (prev: unknown) => {
        const list = Array.isArray(prev) ? prev : []
        return [...list, tempUser, tempAssistant]
      })

      const updateAssistantContent = (content: string, suggested?: CoverletterSuggestedUpdate[]) => {
        qc.setQueryData(messagesKey(applicationId), (prev: unknown) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((m) => {
            if (!m || typeof (m as { id?: unknown }).id !== 'string') return m
            const msg = m as CoverletterChatMessage
            if (msg.id === PENDING_ASSISTANT_MSG_ID) {
              return {
                ...msg,
                content,
                suggestedUpdates: suggested ?? msg.suggestedUpdates,
              }
            }
            return msg
          })
        })
      }

      const replacePlaceholders = (
        userMessage: CoverletterChatMessage,
        assistantMessage: CoverletterChatMessage,
      ) => {
        qc.setQueryData(messagesKey(applicationId), (prev: unknown) => {
          const list = Array.isArray(prev) ? prev : []
          const filtered = list.filter(
            (m): m is CoverletterChatMessage =>
              !!m &&
              typeof (m as { id?: unknown }).id === 'string' &&
              (m as { id: string }).id !== PENDING_USER_MSG_ID &&
              (m as { id: string }).id !== PENDING_ASSISTANT_MSG_ID,
          )
          return [...filtered, userMessage, assistantMessage]
        })
      }

      const removePlaceholders = () => {
        qc.setQueryData(messagesKey(applicationId), (prev: unknown) => {
          const list = Array.isArray(prev) ? prev : []
          return list.filter(
            (m): m is CoverletterChatMessage =>
              !!m &&
              typeof (m as { id?: unknown }).id === 'string' &&
              (m as { id: string }).id !== PENDING_USER_MSG_ID &&
              (m as { id: string }).id !== PENDING_ASSISTANT_MSG_ID,
          )
        })
      }

      let realUserMsg: CoverletterChatMessage | null = null
      let currentReply = ''
      let currentSuggested: CoverletterSuggestedUpdate[] | undefined

      try {
        await coverletterDocApi.sendChatStream(applicationId, dto, {
          onUserSaved: (m) => {
            realUserMsg = m
          },
          onPartial: ({ reply, suggestedUpdates }) => {
            if (typeof reply === 'string') currentReply = reply
            if (suggestedUpdates) currentSuggested = suggestedUpdates
            updateAssistantContent(currentReply, currentSuggested)
          },
          onDone: ({ assistantMessage, assistantStatus, assistantStatusReason }) => {
            const userToUse = realUserMsg ?? tempUser
            replacePlaceholders(userToUse, assistantMessage)
            qc.invalidateQueries({ queryKey: messagesKey(applicationId) })
            qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
            onDoneCallback?.({
              assistantMessage,
              assistantStatus,
              assistantStatusReason,
            })
          },
          onError: (message) => {
            removePlaceholders()
            onErrorCallback?.(message)
          },
        })
      } catch (err) {
        removePlaceholders()
        const message = err instanceof Error ? err.message : 'stream failed'
        onErrorCallback?.(message)
      } finally {
        setSending(false)
      }
    },
    [applicationId, qc],
  )

  return { sendStream, sending }
}

/** 대화 전체 삭제 — 사용자 권리 */
export function useDeleteCoverletterMessages(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => coverletterDocApi.deleteMessages(applicationId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: messagesKey(applicationId) }),
  })
}
