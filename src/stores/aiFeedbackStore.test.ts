/**
 * A1 — 자소서 AI 점검 스토어 테스트.
 *
 * 핵심: 호출·상태를 스토어가 소유 → promise 완료가 컴포넌트 언마운트와 무관하게
 * 처리된다 (스토어를 직접 구동해 검증).
 *
 * 시나리오:
 * 1. start → done (ok 결과 저장)
 * 2. start → error (blocked → reason 을 errorMsg 로)
 * 3. start → error (promise reject → 토스트)
 * 4. clear — entry 제거
 * 5. anyRunning — running 중 true, 완료 후 false
 * 6. requestFeedback — apiClient.post 로 호출 후 done
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiFeedbackStore } from './aiFeedbackStore'
import { apiClient } from '@/api/client'
import { toast } from '@/stores/toastStore'
import type { CoverletterFeedback } from '@/types/coverletter'

vi.mock('@/api/client', () => ({ apiClient: { post: vi.fn() } }))
vi.mock('@/stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const postMock = vi.mocked(apiClient.post)

const FEEDBACK: CoverletterFeedback = {
  strengths: ['정량 근거가 좋아요'],
  issues: [{ kind: 'ai_tone', quote: '끊임없는 열정', advice: '구체 동사로' }],
  suggestions: [{ target: '끊임없는 열정', improved: '채널 7개 비교' }],
  summary: '도입부만 다듬으면 좋겠어요',
}

/** 외부에서 resolve/reject 가능한 deferred promise */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('aiFeedbackStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAiFeedbackStore.setState({ entries: {} })
  })

  it('start → done — ok 결과를 저장', async () => {
    await useAiFeedbackStore
      .getState()
      .start('cl-1', Promise.resolve({ status: 'ok', feedback: FEEDBACK }))

    const entry = useAiFeedbackStore.getState().entries['cl-1']
    expect(entry.status).toBe('done')
    expect(entry.result).toEqual(FEEDBACK)
  })

  it('start → error — blocked 는 reason 을 errorMsg 로 (토스트 없음)', async () => {
    await useAiFeedbackStore
      .getState()
      .start('cl-1', Promise.resolve({ status: 'blocked', reason: '오늘 한도 소진' }))

    const entry = useAiFeedbackStore.getState().entries['cl-1']
    expect(entry.status).toBe('error')
    expect(entry.errorMsg).toBe('오늘 한도 소진')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('start → error — promise reject 시 에러 상태 + 토스트', async () => {
    await useAiFeedbackStore.getState().start('cl-1', Promise.reject(new Error('500')))

    const entry = useAiFeedbackStore.getState().entries['cl-1']
    expect(entry.status).toBe('error')
    expect(entry.errorMsg).toMatch(/실패/)
    expect(toast.error).toHaveBeenCalled()
  })

  it('clear — entry 제거', async () => {
    await useAiFeedbackStore
      .getState()
      .start('cl-1', Promise.resolve({ status: 'ok', feedback: FEEDBACK }))
    expect(useAiFeedbackStore.getState().entries['cl-1']).toBeDefined()

    useAiFeedbackStore.getState().clear('cl-1')
    expect(useAiFeedbackStore.getState().entries['cl-1']).toBeUndefined()
  })

  it('anyRunning — running 중 true, 완료 후 false (언마운트 무관)', async () => {
    const d = deferred<{ status: 'ok'; feedback: CoverletterFeedback }>()
    const done = useAiFeedbackStore.getState().start('cl-1', d.promise)

    expect(useAiFeedbackStore.getState().anyRunning()).toBe(true)
    expect(useAiFeedbackStore.getState().entries['cl-1'].status).toBe('running')

    d.resolve({ status: 'ok', feedback: FEEDBACK })
    await done

    expect(useAiFeedbackStore.getState().anyRunning()).toBe(false)
    expect(useAiFeedbackStore.getState().entries['cl-1'].status).toBe('done')
  })

  it('requestFeedback — apiClient.post 호출 후 done', async () => {
    postMock.mockResolvedValue({
      data: { data: { status: 'ok', feedback: FEEDBACK } },
    } as never)

    await useAiFeedbackStore.getState().requestFeedback('cl-9')

    expect(postMock).toHaveBeenCalledWith('/coverletters/cl-9/ai-feedback')
    expect(useAiFeedbackStore.getState().entries['cl-9'].status).toBe('done')
  })
})
