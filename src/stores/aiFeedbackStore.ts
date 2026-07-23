import { create } from 'zustand'
import { apiClient } from '@/api/client'
import { toast } from '@/stores/toastStore'
import type {
  CoverletterFeedback,
  CoverletterFeedbackResult,
} from '@/types/coverletter'

/**
 * A1 — 자소서 AI 심층 점검 상태를 모달 밖(전역)으로 승격.
 *
 * AiFeedbackSection 이 CleanupModal 안에 마운트돼 있어, 모달을 닫으면 진행 중
 * 호출 결과·기록이 증발했다. 호출 자체와 상태를 이 스토어로 옮겨 컴포넌트
 * 언마운트와 무관하게 완료를 처리한다 (모달 닫아도 점검 계속 진행).
 *
 * clId 별로 상태를 보관 — 여러 문항을 동시에 점검할 수 있음.
 */

interface FeedbackEntry {
  status: 'running' | 'done' | 'error'
  result?: CoverletterFeedback
  errorMsg?: string
  startedAt: number
}

interface AiFeedbackState {
  entries: Record<string, FeedbackEntry>
  /** running set 후 promise 를 스토어가 직접 완료 처리 (컴포넌트 언마운트 무관) */
  start: (clId: string, promise: Promise<CoverletterFeedbackResult>) => Promise<void>
  /** 실제 점검 API 호출 — apiClient.post 후 start 로 위임 */
  requestFeedback: (clId: string) => Promise<void>
  /** 재검사 직전 초기화 */
  clear: (clId: string) => void
  /** beforeunload 가드용 — 점검 중인 문항이 하나라도 있는지 */
  anyRunning: () => boolean
  /** 로그아웃 시 전체 초기화 */
  resetAll: () => void
}

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data

export const useAiFeedbackStore = create<AiFeedbackState>((set, get) => ({
  entries: {},

  start: (clId, promise) => {
    set((s) => ({
      entries: { ...s.entries, [clId]: { status: 'running', startedAt: Date.now() } },
    }))
    const startedAt = get().entries[clId]?.startedAt ?? Date.now()
    return promise.then(
      (result) => {
        if (result.status === 'ok' && result.feedback) {
          set((s) => ({
            entries: {
              ...s.entries,
              [clId]: { status: 'done', result: result.feedback, startedAt },
            },
          }))
        } else {
          // blocked / error status — 사유만 인라인 표시 (토스트 없음)
          set((s) => ({
            entries: {
              ...s.entries,
              [clId]: {
                status: 'error',
                errorMsg: result.reason ?? '점검에 실패했어요.',
                startedAt,
              },
            },
          }))
        }
      },
      (err) => {
        // 네트워크·서버 실패 — 서버 message(503 장애 문구 등) 우선, 없으면 고정 문구
        const serverMsg = (
          err as { response?: { data?: { message?: string } } }
        )?.response?.data?.message
        const msg = serverMsg ?? '점검 요청에 실패했어요. 잠시 후 다시 시도해 주세요.'
        set((s) => ({
          entries: {
            ...s.entries,
            [clId]: {
              status: 'error',
              errorMsg: msg,
              startedAt,
            },
          },
        }))
        toast.error(msg)
      },
    )
  },

  requestFeedback: (clId) => {
    const promise = apiClient
      .post(`/coverletters/${clId}/ai-feedback`)
      .then(unwrap<CoverletterFeedbackResult>)
    return get().start(clId, promise)
  },

  clear: (clId) =>
    set((s) => {
      const next = { ...s.entries }
      delete next[clId]
      return { entries: next }
    }),

  // 로그아웃 시 전체 초기화 — 공용 PC 계정 전환 시 이전 사용자 결과 잔존 방지
  resetAll: () => set({ entries: {} }),

  anyRunning: () => Object.values(get().entries).some((e) => e.status === 'running'),
}))
