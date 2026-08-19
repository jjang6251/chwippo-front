/**
 * 노트 AI 패널 — 요청 훅 계약 spec.
 *
 * 시나리오 (plan §3 「게이트·상태 3분기」 중 훅이 책임지는 것):
 *   게이트   동의 거부 → **요청 자체를 안 보낸다** (cancelled)
 *   금전     성공·실패 무관 ai-quotas + coin-balance 무효화
 *   분기     blocked_quota + ALREADY_RUNNING 은 한도 문구가 아니다 (선분기)
 *            error + provider_outage 는 장애 문구
 *            status:'ok' 인데 markdown 이 비면 실패로 본다
 *   문구     서버 message 우선 · 인터셉터가 이미 토스트했으면(_toastShown) 중복 금지
 */
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/noteAiAction', () => ({ noteAiActionApi: { run: vi.fn() } }))
vi.mock('@/hooks/useRequireAiConsent', () => ({ useRequireAiConsent: vi.fn() }))

import { noteAiActionApi, type NoteAiResource } from '@/api/noteAiAction'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { useToastStore } from '@/stores/toastStore'
import { useNoteAiAction } from './useNoteAiAction'

const RESOURCE: NoteAiResource = { type: 'study_note', noteId: 'note-1' }
const BODY = { action: 'easy' as const, selectionMd: '원문 문단' }

const runApi = vi.mocked(noteAiActionApi.run)
const consent = vi.mocked(useRequireAiConsent)

let qc: QueryClient
let invalidateSpy: ReturnType<typeof vi.spyOn>

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function setup() {
  return renderHook(() => useNoteAiAction(RESOURCE), { wrapper }).result
}

/** 토스트 문구 모으기 — 스토어가 유일한 노출 경로다 */
function toastMessages(): string[] {
  return useToastStore.getState().toasts.map((t) => t.message)
}

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  consent.mockReturnValue(async () => true)
  qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
})

describe('useNoteAiAction — 게이트', () => {
  it('동의를 거부하면 요청을 보내지 않고 cancelled 를 돌려준다', async () => {
    consent.mockReturnValue(async () => false)
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome).toEqual({ kind: 'cancelled' })
    expect(runApi).not.toHaveBeenCalled()
    expect(toastMessages()).toEqual([])
  })
})

describe('useNoteAiAction — 잔여 무효화', () => {
  it('성공하면 ai-quotas · coin-balance 를 함께 무효화한다', async () => {
    runApi.mockResolvedValue({ status: 'ok', markdown: '# 결과' })
    const result = setup()

    await result.current.run(BODY)

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me', 'ai-quotas'] }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me', 'coin-balance'] })
  })

  it('네트워크 실패에도 두 키를 무효화한다 (차감 여부는 서버가 안다)', async () => {
    runApi.mockRejectedValue(new Error('boom'))
    const result = setup()

    await result.current.run(BODY)

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me', 'ai-quotas'] }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me', 'coin-balance'] })
  })
})

describe('useNoteAiAction — 응답 분기', () => {
  it('ok → markdown · cached · truncated 를 그대로 넘긴다', async () => {
    runApi.mockResolvedValue({
      status: 'ok',
      markdown: '| a | b |',
      cached: true,
      truncated: false,
      quota: { used: 3, limit: 20 },
      meta: { callLogId: null },
    })
    const result = setup()

    await expect(result.current.run(BODY)).resolves.toEqual({
      kind: 'ok',
      markdown: '| a | b |',
      cached: true,
      truncated: false,
    })
  })

  it('출력 한도로 잘렸으면 truncated 를 실어 보낸다 (성공이되 온전하지 않다)', async () => {
    runApi.mockResolvedValue({
      status: 'ok',
      markdown: '| 항목 | 내용 |\n| --- | --- |',
      truncated: true,
      meta: { callLogId: 'log-1' },
    })
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome).toMatchObject({ kind: 'ok', truncated: true })
    // 잘린 것도 결과는 결과다 — 토스트로 실패처럼 알리지 않는다
    expect(toastMessages()).toEqual([])
  })

  it('blocked_cost_quota 는 전용 문구로 노출한다 (횟수 한도와 다른 축)', async () => {
    runApi.mockResolvedValue({ status: 'blocked_cost_quota' })
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome).toEqual({
      kind: 'blocked',
      message: '오늘 AI 사용량이 많아 잠시 막혔어요. 잠시 후 다시 시도해 주세요.',
    })
  })

  it('ok 인데 markdown 이 비면 실패로 본다 (빈 결과를 성공으로 보여주지 않는다)', async () => {
    runApi.mockResolvedValue({ status: 'ok', markdown: '   ' })
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome.kind).toBe('error')
    expect(toastMessages()).toHaveLength(1)
  })

  it('blocked_quota + ALREADY_RUNNING 은 한도 문구가 아니라 진행 중 안내다', async () => {
    runApi.mockResolvedValue({ status: 'blocked_quota', code: 'ALREADY_RUNNING' })
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome).toEqual({
      kind: 'blocked',
      message: '이미 요청이 진행 중이에요. 결과가 도착할 때까지 기다려 주세요.',
    })
    expect(toastMessages()[0]).toContain('진행 중')
  })

  it('blocked_quota 는 한도 문구 · 서버 reason 이 있으면 그쪽이 이긴다', async () => {
    runApi.mockResolvedValue({ status: 'blocked_quota', reason: '오늘 5회를 모두 썼어요' })
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome).toEqual({ kind: 'blocked', message: '오늘 5회를 모두 썼어요' })
  })

  it('error + provider_outage 는 장애 문구로 노출한다', async () => {
    runApi.mockResolvedValue({ status: 'error', errorKind: 'provider_outage' })
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome).toEqual({
      kind: 'error',
      message: 'AI 서비스가 잠시 불안정해요. 잠시 후 다시 시도해 주세요.',
    })
  })
})

describe('useNoteAiAction — 문구 중복', () => {
  it('던져진 에러의 서버 message 를 쓴다', async () => {
    runApi.mockRejectedValue({
      response: { data: { message: '선택이 6,000자를 넘어요' } },
    })
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome).toEqual({ kind: 'error', message: '선택이 6,000자를 넘어요' })
    expect(toastMessages()).toEqual(['선택이 6,000자를 넘어요'])
  })

  it('인터셉터가 이미 토스트했으면 다시 띄우지 않는다 (_toastShown)', async () => {
    runApi.mockRejectedValue({
      config: { _toastShown: true },
      response: { data: { message: '한도 초과' } },
    })
    const result = setup()

    const outcome = await result.current.run(BODY)

    expect(outcome.kind).toBe('error')
    expect(toastMessages()).toEqual([])
  })
})
