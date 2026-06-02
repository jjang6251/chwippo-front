import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interviewPrepApi } from '@/api/interviewPrep'
import type {
  CreateFollowupDto,
  CreateSessionDto,
  UpdateQuestionDto,
  UpdateSessionDto,
} from '@/types/interviewPrep'

/**
 * F6 PR 2 Phase 4 — 면접 준비 React Query hooks.
 *
 * cache keys:
 * - sessions list per application: `['interview-prep-sessions', applicationId]`
 * - session detail: `['interview-prep-session', sessionId]`
 * - questions tree: `['interview-prep-questions', sessionId]`
 *
 * 일괄 생성 / 꼬리질문 mutation 후 questions tree 만 invalidate (sessions list 영향 X).
 * my_memo autosave 는 mutation 만, query invalidate 안 함 (debounce 후 자동 호출, 트리 갱신 불필요).
 */

const sessionListKey = (applicationId: string) =>
  ['interview-prep-sessions', applicationId] as const
const sessionKey = (sessionId: string) =>
  ['interview-prep-session', sessionId] as const
const questionsKey = (sessionId: string) =>
  ['interview-prep-questions', sessionId] as const

export function useInterviewPrepSessions(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: sessionListKey(applicationId),
    queryFn: () => interviewPrepApi.list(applicationId),
    enabled: enabled && !!applicationId,
  })
}

export function useInterviewPrepSession(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: sessionKey(sessionId),
    queryFn: () => interviewPrepApi.findOne(sessionId),
    enabled: enabled && !!sessionId,
  })
}

export function useCreateInterviewPrepSession(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateSessionDto) => interviewPrepApi.create(dto),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: sessionListKey(applicationId) }),
  })
}

export function useUpdateInterviewPrepSession(
  sessionId: string,
  applicationId: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateSessionDto) =>
      interviewPrepApi.update(sessionId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionKey(sessionId) })
      qc.invalidateQueries({ queryKey: sessionListKey(applicationId) })
      // refs (coverletter·log title) — 자료 변경 시 refresh
      qc.invalidateQueries({
        queryKey: ['interview-prep-refs', sessionId] as const,
      })
    },
  })
}

export function useRemoveInterviewPrepSession(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => interviewPrepApi.remove(sessionId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: sessionListKey(applicationId) }),
  })
}

export function useInterviewPrepQuestions(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: questionsKey(sessionId),
    queryFn: () => interviewPrepApi.listQuestions(sessionId),
    enabled: enabled && !!sessionId,
  })
}

/** Phase 4 — session 의 coverletter/log refs detail (사이드바 메타카드 표시) */
export function useInterviewPrepRefs(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ['interview-prep-refs', sessionId] as const,
    queryFn: () => interviewPrepApi.listRefs(sessionId),
    enabled: enabled && !!sessionId,
  })
}

// ── Phase 4 단계 B — 회사 조사 ──

const researchKey = (sessionId: string) =>
  ['interview-prep-research', sessionId] as const

/** cache 조회 (LLM 호출 X). null = "🔍 회사 조사" 버튼 노출 */
export function useCompanyResearch(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: researchKey(sessionId),
    queryFn: () => interviewPrepApi.getCompanyResearch(sessionId),
    enabled: enabled && !!sessionId,
  })
}

/** 회사 조사 트리거 (LLM web_search). 성공 시 cache 갱신 */
export function useTriggerCompanyResearch(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => interviewPrepApi.triggerCompanyResearch(sessionId),
    onSuccess: (result) => {
      if (result.status === 'ok' || result.status === 'opt_out') {
        qc.setQueryData(researchKey(sessionId), result)
      }
      // 5.6.x — quota 차감 즉시 반영 (chip 갱신)
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
      qc.invalidateQueries({ queryKey: ['me', 'coin-balance'] })
    },
  })
}

/** 사용자 자유 메모 update — 1.5s debounce 또는 명시 저장 */
export function useUpdateUserResearchNotes(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notes: string | null) =>
      interviewPrepApi.updateUserResearchNotes(sessionId, notes),
    onSuccess: () => {
      // session detail 무효화 — userResearchNotes 갱신 반영
      qc.invalidateQueries({
        queryKey: ['interview-prep-session', sessionId] as const,
      })
    },
  })
}

/** 면접 세션 삭제 — questions CASCADE. 5.6.6 */
export function useDeleteInterviewSession(
  applicationId: string | undefined,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => interviewPrepApi.remove(sessionId),
    onSuccess: () => {
      if (applicationId) {
        qc.invalidateQueries({ queryKey: sessionListKey(applicationId) })
      }
    },
  })
}

/** AI 일괄 생성 — 성공 시 questions 트리 invalidate (기존 트리 전체 교체) */
export function useGenerateInterviewSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => interviewPrepApi.generate(sessionId),
    onSuccess: (result) => {
      if (result.status === 'ok') {
        qc.invalidateQueries({ queryKey: questionsKey(sessionId) })
      }
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
      qc.invalidateQueries({ queryKey: ['me', 'coin-balance'] })
    },
  })
}

/** my_memo autosave — invalidate 없음 (트리 구조 안 바뀜) */
export function useUpdateInterviewQuestion() {
  return useMutation({
    mutationFn: (params: { questionId: string; dto: UpdateQuestionDto }) =>
      interviewPrepApi.updateQuestion(params.questionId, params.dto),
  })
}

/** 단일 꼬리질문 생성 — 성공 시 questions 트리 invalidate */
export function useCreateInterviewFollowup(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      parentQuestionId: string
      dto?: CreateFollowupDto
    }) =>
      interviewPrepApi.createFollowup(params.parentQuestionId, params.dto ?? {}),
    onSuccess: (result) => {
      if (result.status === 'ok') {
        qc.invalidateQueries({ queryKey: questionsKey(sessionId) })
      }
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
      qc.invalidateQueries({ queryKey: ['me', 'coin-balance'] })
    },
  })
}
