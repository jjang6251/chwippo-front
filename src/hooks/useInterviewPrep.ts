import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { interviewPrepApi } from '@/api/interviewPrep'
import type {
  BulkCreateQuestionsDto,
  CreateFollowupDto,
  CreateSessionDto,
  GenerateSessionDto,
  InterviewPrepQuestion,
  RecordPracticeDto,
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
 * my_memo autosave 는 invalidate 대신 **setQueryData 로 해당 노드만 패치**한다
 * (2026-08-09 — 카드가 remount 되는 모바일 집중 화면에서 캐시가 낡으면 답변이 빈 칸으로 돌아온다).
 */

/** 목록 쿼리 키 — Interviews 페이지의 부모 정렬(useQueries)이 같은 키를 써야 캐시가 공유된다 */
export const sessionListKey = (applicationId: string) =>
  ['interview-prep-sessions', applicationId] as const
/**
 * 🔴 **키는 여기서만 만든다.** 화면에서 배열 리터럴을 복붙하면 오타가 나도
 * `invalidateQueries` 는 **에러 없이 아무것도 안 한다** — 조용히 실패하는 종류라
 * 테스트에도 안 걸린다 (실제로 한 번 그랬다).
 */
export const sessionKey = (sessionId: string) =>
  ['interview-prep-session', sessionId] as const
export const questionsKey = (sessionId: string) =>
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

/** AI 질문 생성 — 성공 시 questions 트리 invalidate (기존 질문에 **추가**된다) */
export function useGenerateInterviewSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: GenerateSessionDto = {}) =>
      interviewPrepApi.generate(sessionId, dto),
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
/**
 * 질문 1개 수정 (자동 저장되는 `내 답변` 이 유일한 사용처).
 *
 * 🔴 **저장 결과를 캐시에 반영한다** (2026-08-09). 예전엔 아무것도 안 했다 —
 * 카드가 화면에 계속 살아 있어서 자기 `useState` 가 진실이었고 트리를 갱신할 이유가 없었다.
 *
 * 모바일 집중 화면이 그 전제를 깼다. 문항을 넘길 때마다 카드가 `key` 로 **remount** 되는데,
 * 카드의 초기값은 `useState(question.myMemo ?? '')` — 즉 **캐시**다. 캐시가 낡아 있으면
 * 방금 저장한 답이 **빈 칸으로 돌아온다.** 목록의 완료 점과 `답변 N개` 도 같은 이유로 안 올랐다.
 *
 * `invalidate` 가 아니라 `setQueryData` 인 이유 — 재조회는 낭비이고, 1.5초 debounce 로
 * 계속 저장되는 칸이라 **입력 중 서버 응답이 덮어쓰는 경합**을 부른다. 바뀐 노드만 집어 고친다.
 */
export function useUpdateInterviewQuestion(sessionId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { questionId: string; dto: UpdateQuestionDto }) =>
      interviewPrepApi.updateQuestion(params.questionId, params.dto),
    onSuccess: (updated, params) => {
      if (!sessionId) return
      /**
       * 🔴 **보낸 필드만 반영한다** (질문 은행 D2b). `dto` 에 없는 키를 건드리면
       * ⭐ 토글이 방금 저장한 메모를 되돌리는 식의 교차 오염이 난다.
       *
       * 서버 응답(`updated`)을 먼저 보고, 없으면 보낸 값으로 떨어진다 — 데모 어댑터처럼
       * 응답이 body 를 그대로 되비추는 환경과 실서버 양쪽에서 같게 동작한다.
       * `??` 라 `false`·`''`·`null` 도 그대로 살아남는다 (`||` 였으면 ⭐ 끄기가 안 먹는다).
       */
      const merge = (q: InterviewPrepQuestion): InterviewPrepQuestion => {
        const next = { ...q }
        if (params.dto.myMemo !== undefined) {
          next.myMemo = updated?.myMemo ?? params.dto.myMemo ?? q.myMemo
        }
        if (params.dto.mustPrepare !== undefined) {
          next.mustPrepare = updated?.mustPrepare ?? params.dto.mustPrepare
        }
        if (params.dto.questionText !== undefined) {
          next.questionText = updated?.questionText ?? params.dto.questionText
        }
        if (params.dto.category !== undefined) {
          next.category = updated?.category ?? params.dto.category
        }
        return next
      }
      const patch = (list: InterviewPrepQuestion[]): InterviewPrepQuestion[] =>
        list.map((q) =>
          q.id === params.questionId
            ? merge(q)
            : q.children.length
              ? { ...q, children: patch(q.children) }
              : q,
        )
      qc.setQueryData<InterviewPrepQuestion[]>(questionsKey(sessionId), (old) =>
        old ? patch(old) : old,
      )
    },
  })
}

/**
 * 「면접 보기」 D3 — 연습 자가평가 저장 (잘함/애매/다시).
 *
 * 🔴 **`invalidate` 가 아니라 `setQueryData` 다.** 재조회하면 목록이 새로 내려오고,
 * 「다시 볼 것만」 같은 조건으로 시작한 시험이 **연습 도중 재정렬·재필터**된다 —
 * 방금 「다시」로 찍은 문항이 목록에서 사라지거나 순서가 밀린다. 시험 순서는 시작 시
 * 고정이므로(`buildExamQuestions` 결과를 state 로 보관) 캐시도 바뀐 두 필드만 집어 고친다.
 *
 * 🔴 **AI 무관이라 쿼터·코인을 건드리지 않는다** (`useBulkCreateQuestions` 와 같은 이유).
 */
export function useRecordPractice(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      questionId: string
      result: RecordPracticeDto['result']
    }) =>
      interviewPrepApi.recordPractice(params.questionId, {
        result: params.result,
      }),
    onSuccess: (updated, params) => {
      /*
        시각은 **서버가 찍은 값**을 쓴다 — 기기 시계로 만들어 넣으면 다음 조회에서
        서버 값으로 바뀌며 화면이 튄다. 응답이 없는 환경(데모 어댑터)에서만 보낸 값으로 떨어진다.
      */
      const merge = (q: InterviewPrepQuestion): InterviewPrepQuestion => ({
        ...q,
        lastPracticeResult: updated?.lastPracticeResult ?? params.result,
        lastPracticedAt: updated?.lastPracticedAt ?? q.lastPracticedAt,
      })
      const patch = (list: InterviewPrepQuestion[]): InterviewPrepQuestion[] =>
        list.map((q) =>
          q.id === params.questionId
            ? merge(q)
            : q.children.length
              ? { ...q, children: patch(q.children) }
              : q,
        )
      qc.setQueryData<InterviewPrepQuestion[]>(questionsKey(sessionId), (old) =>
        old ? patch(old) : old,
      )
    },
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

/**
 * 질문 은행 D1 — 내가 직접 적은 질문 N개 추가.
 *
 * 🔴 **AI 무관이라 쿼터·코인을 건드리지 않는다.** 같은 파일의 생성 mutation 들을 복사하면
 * `['me','ai-quotas']` 까지 따라오는데, 그러면 질문 하나 적을 때마다 쓰지도 않은 쿼터를
 * 다시 조회하고 화면의 사용량 칩이 깜빡인다.
 */
export function useBulkCreateQuestions(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: BulkCreateQuestionsDto) =>
      interviewPrepApi.bulkCreateQuestions(sessionId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionsKey(sessionId) })
    },
  })
}

/**
 * 질문 은행 D2b — 질문 1개 삭제 (자손 CASCADE).
 *
 * 🔴 **AI 무관이라 쿼터·코인을 건드리지 않는다** (`useBulkCreateQuestions` 와 같은 이유).
 * 같은 파일의 AI mutation 을 복사하면 `['me','ai-quotas']` 까지 따라오는데, 그러면 질문
 * 하나 지울 때마다 쓰지도 않은 쿼터를 다시 조회하고 사용량 칩이 깜빡인다.
 *
 * `setQueryData` 가 아니라 `invalidate` 인 이유 — 자손이 함께 사라져 **트리 구조가 바뀐다.**
 * 메모 저장(구조 불변)과 달리 서버가 준 모양을 다시 받는 게 맞다.
 */
export function useDeleteInterviewQuestion(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (questionId: string) =>
      interviewPrepApi.deleteQuestion(questionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionsKey(sessionId) })
    },
  })
}

/**
 * 질문 은행 D2b — ↻ 낱개 교체 (AI 호출).
 *
 * 성공·실패와 무관하게 쿼터·코인을 invalidate 한다 — 차단으로 끝났어도 사용량 표시는
 * 최신이어야 하고, 실패해도 시도 자체가 기록될 수 있다 (`useGenerateInterviewAnswer` 와 동일).
 *
 * `sessionKey` 까지 무효화하는 이유 — 교체는 세션 선점(`generationStatus`)을 잡았다 놓는다.
 * 캐시에 `in_progress` 가 남으면 화면이 폴링 주기만큼 "만들고 있어요" 를 더 띄운다.
 */
export function useRegenerateInterviewQuestion(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (questionId: string) =>
      interviewPrepApi.regenerateQuestion(questionId),
    onSuccess: (result) => {
      if (result.status === 'ok') {
        qc.invalidateQueries({ queryKey: questionsKey(sessionId) })
        qc.invalidateQueries({ queryKey: sessionKey(sessionId) })
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
