import {
  useGenerateInterviewSession,
  useInterviewPrepQuestions,
} from '@/hooks/useInterviewPrep'
import { toast } from '@/stores/toastStore'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { InterviewQuestionCard } from './InterviewQuestionCard'

/**
 * F6 PR 2 Phase 4 — 면접 세션 상세 (질문 트리 + AI 일괄 생성).
 *
 * **흐름**:
 * - 질문 트리 fetch (recursive CTE → client tree)
 * - 빈 트리: "AI 질문 생성" CTA (Hybrid main 5~8 + 꼬리)
 * - 트리 있음: depth 0 main 카드 list, 각각 children 펼침
 */
export function InterviewSessionDetail({ sessionId }: { sessionId: string }) {
  const { data: questions, isLoading } = useInterviewPrepQuestions(sessionId)
  const { mutate: generate, isPending: generating } =
    useGenerateInterviewSession(sessionId)
  const ensureAiConsent = useRequireAiConsent()

  const handleGenerate = async () => {
    if (!(await ensureAiConsent())) return
    generate(undefined, {
      onSuccess: (result) => {
        if (result.status === 'ok') {
          toast.show(
            `${result.meta?.mainCount ?? 0}개 메인 질문 + 꼬리 ${result.meta?.followupCount ?? 0}개를 생성했어요.`,
          )
        } else {
          toast.error(result.reason ?? '생성에 실패했어요.')
        }
      },
      onError: () => toast.error('AI 호출 중 오류가 발생했어요.'),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 bg-surface-2 border border-line rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  const tree = questions ?? []

  if (tree.length === 0) {
    return (
      <div className="border border-dashed border-line bg-surface-2/30 rounded-lg px-4 py-8 text-center">
        <div className="text-xl mb-2">✨</div>
        <p className="text-text-secondary text-xs mb-3">
          이 세션에 아직 질문이 없어요.
          <br />
          선택한 자소서·로그를 바탕으로 AI 가 예상 질문을 만들어줘요.
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          {generating ? '✨ 질문 생성중... (10-20초 소요)' : '✨ AI 질문 생성'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-text-tertiary text-xs">
          메인 {tree.length}개 + 꼬리{' '}
          {tree.reduce((n, q) => n + q.children.length, 0)}개
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-text-tertiary hover:text-text-primary text-xs"
          title="기존 질문을 모두 지우고 다시 생성"
        >
          {generating ? '✨ 재생성중... (10-20초)' : '↻ 다시 생성'}
        </button>
      </div>
      {tree.map((q) => (
        <InterviewQuestionCard
          key={q.id}
          question={q}
          sessionId={sessionId}
        />
      ))}
    </div>
  )
}
