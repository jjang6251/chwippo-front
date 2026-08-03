/**
 * 🔴 **자소서 채팅 "생성 중" marker 를 언제 지우는가.**
 *
 * marker 유틸 자체는 `chatPendingMarker.test.ts` 가 덮는다 (round-trip·stale·격리).
 * 그런데 **"언제 지우는가"** 는 어디서도 검증하지 않아, 실사용에서 뚫렸다:
 *
 * > 2026-08-03 — 답변 생성 중 새로고침 → 재진입했더니 **"생성 중" 표시가 아예 없고**
 * > 질문만 덩그러니 남았다. 서버는 멀쩡히 완주·저장 중이었는데 사용자는 요청이 날아간 줄 안다.
 *
 * 원인: clear 를 `finally` 에서 했다. `finally` 는 **"정상 종료" 와 "페이지가 죽어서
 * 중단됨" 을 구분하지 못한다.** 새로고침하면 fetch abort → catch → finally 순으로 돌아,
 * 언로드 직전에 marker 를 지워버렸다 — **marker 가 살아남아야 할 유일한 경우**에.
 *
 * 그래서 여기서 "서버가 응답했을 때만 지운다" 를 못 박는다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/coverletterDoc', () => ({
  coverletterDocApi: { sendChatStream: vi.fn() },
}))

import { coverletterDocApi } from '@/api/coverletterDoc'
import type { ChatSendDto, CoverletterChatMessage } from '@/api/coverletterDoc'
import { getChatPending } from '@/utils/chatPendingMarker'
import { useSendCoverletterChatStream } from './useCoverletterDoc'

const streamMock = vi.mocked(coverletterDocApi.sendChatStream)
/** `sendChatStream` 이 받는 콜백 묶음 — `never` 로 뭉개지 않고 실제 타입을 쓴다 */
type StreamHandlers = Parameters<typeof coverletterDocApi.sendChatStream>[2]
const APP = 'app-1'
const DTO: ChatSendDto = { userMessage: '이 문항 다시 써줘' }

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrap({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
  return Wrap
}

const assistantMessage: CoverletterChatMessage = {
  id: 'm-1',
  applicationId: APP,
  role: 'assistant' as const,
  content: '완성된 답변',
  suggestedUpdates: null,
  citations: null,
  createdAt: new Date().toISOString(),
}

describe('자소서 채팅 pending marker', () => {
  beforeEach(() => {
    sessionStorage.clear()
    streamMock.mockReset()
  })

  it('스트림 시작 시 marker 를 남긴다', async () => {
    let markerDuringStream: unknown = 'not-checked'
    streamMock.mockImplementation(async () => {
      // 스트림이 도는 동안 marker 가 있어야 재진입에서 잡을 수 있다
      markerDuringStream = getChatPending(APP)
    })
    const { result } = renderHook(() => useSendCoverletterChatStream(APP), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.sendStream(DTO)
    })

    expect(markerDuringStream).not.toBeNull()
  })

  it('onDone — 서버가 완료 응답하면 지운다', async () => {
    streamMock.mockImplementation(
      async (_app: string, _dto: ChatSendDto, cbs: StreamHandlers) => {
        cbs.onDone({ assistantMessage, assistantStatus: 'ok' })
      },
    )
    const { result } = renderHook(() => useSendCoverletterChatStream(APP), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.sendStream(DTO)
    })

    expect(getChatPending(APP)).toBeNull()
  })

  it('onError — 서버가 에러 응답하면 지운다 (기다릴 게 없다)', async () => {
    streamMock.mockImplementation(
      async (_app: string, _dto: ChatSendDto, cbs: StreamHandlers) => {
        cbs.onError('quota 초과')
      },
    )
    const { result } = renderHook(() => useSendCoverletterChatStream(APP), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.sendStream(DTO, undefined, () => {})
    })

    expect(getChatPending(APP)).toBeNull()
  })

  /**
   * 🔴 **이 케이스가 실사고 재현이다.**
   *
   * 새로고침·탭 닫기·네트워크 끊김은 서버 응답이 아니라 **연결 중단**이다.
   * 서버는 계속 생성·저장하므로 marker 가 **살아남아야** 재진입에서 "생성 중" 이 뜬다.
   * `finally` 에서 지우면 여기서 깨진다.
   */
  it('🔴 스트림이 중단되면(새로고침·네트워크) marker 를 유지한다', async () => {
    streamMock.mockRejectedValue(new Error('The user aborted a request.'))
    const { result } = renderHook(() => useSendCoverletterChatStream(APP), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.sendStream(DTO, undefined, () => {})
    })

    expect(getChatPending(APP)).not.toBeNull()
  })

  /** 중단된 뒤에도 sending 은 풀려야 입력창이 다시 열린다 */
  it('중단돼도 sending 은 해제된다', async () => {
    streamMock.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useSendCoverletterChatStream(APP), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.sendStream(DTO, undefined, () => {})
    })

    expect(result.current.sending).toBe(false)
  })
})
