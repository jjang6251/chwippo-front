import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
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
    /**
     * 🔴 생성 중이면 3초마다 폴링 — **새로고침 복귀용**이다.
     *
     * 생성은 ~10초 걸린다. 그 사이 새로고침하면 이 값이 `in_progress` 로 내려오고,
     * 화면은 "생성 중" 을 다시 보여준다. 폴링이 없으면 끝나도 화면이 안 바뀌어
     * 사용자가 또 새로고침해야 한다.
     *
     * 서버가 2분 초과분은 `idle` 로 보정해 주므로 여기서 무한 폴링이 되지 않는다.
     * 자소서 회사조사(`useApplication`)와 같은 방식.
     */
    refetchInterval: (query) =>
      query.state.data?.generationStatus === 'in_progress' ? 3000 : false,
    refetchOnWindowFocus: true,
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
        // 세션도 — generationStatus 가 캐시에 in_progress 로 남아
        // 질문이 도착한 뒤에도 "다시 만들고 있어요…" 가 최대 3초(폴링 주기) 더 떴다
        qc.invalidateQueries({ queryKey: sessionKey(sessionId) })
      }
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
      qc.invalidateQueries({ queryKey: ['me', 'coin-balance'] })
    },
  })
}

/**
 * 🔴 **생성이 끝난 걸 이 탭이 알아야 질문이 보인다** (2026-08-07 CEO 실기).
 *
 * 평소엔 생성 mutation 의 `onSuccess` 가 질문 목록을 무효화한다. 그런데 **생성 중
 * 새로고침하면 그 mutation 이 이 탭에 없다.** 서버는 다 만들어 놨는데 화면은
 * 질문 0개인 채로 `completed` 만 보고 "AI 면접질문 생성" 버튼을 다시 띄운다 —
 * 사용자는 실패한 줄 알고 또 누른다 (누르면 코인이 또 나간다).
 *
 * 🔴 **폴링 주기에 기대면 안 된다.** "질문 목록도 생성 중엔 폴링" 으로 풀면,
 * 세션 폴링이 완료를 먼저 보는 순간 질문 폴링이 꺼져서 **완료 후 한 번도 안 받는
 * 창**이 생긴다. 두 폴링의 순서는 보장되지 않으므로 전이를 직접 잡는다.
 *
 * `in_progress` → 그 외로 넘어간 **순간**에만 무효화한다. 이미 끝난 세션을 열 때는
 * 이전 상태가 `in_progress` 가 아니므로 불필요한 재요청이 없다.
 */
export function useRefetchQuestionsOnGenerationEnd(
  sessionId: string,
  status: 'idle' | 'in_progress' | 'completed' | 'failed' | undefined,
) {
  const qc = useQueryClient()
  const prev = useRef(status)
  useEffect(() => {
    const wasRunning = prev.current === 'in_progress'
    prev.current = status
    if (!wasRunning || !status || status === 'in_progress') return
    qc.invalidateQueries({ queryKey: questionsKey(sessionId) })
  }, [status, sessionId, qc])
}

/** my_memo autosave — invalidate 없음 (트리 구조 안 바뀜) */
export function useUpdateInterviewQuestion() {
  return useMutation({
    mutationFn: (params: { questionId: string; dto: UpdateQuestionDto }) =>
      interviewPrepApi.updateQuestion(params.questionId, params.dto),
  })
}

/**
 * v2 — 질문 1개의 예상 답변 생성.
 *
 * 성공·실패와 무관하게 쿼터·코인을 invalidate 한다 — 차단으로 끝났어도 사용량 표시는
 * 최신이어야 하고, 실패해도 시도 자체가 기록될 수 있다.
 */
export function useGenerateInterviewAnswer(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (questionId: string) =>
      interviewPrepApi.generateAnswer(questionId),
    onSuccess: (result) => {
      if (result.status === 'ok') {
        qc.invalidateQueries({ queryKey: questionsKey(sessionId) })
      }
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
      qc.invalidateQueries({ queryKey: ['me', 'coin-balance'] })
    },
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
