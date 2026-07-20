import { Bot, Sparkles } from 'lucide-react'
import {
  useGenerateInterviewSession,
  useInterviewPrepQuestions,
} from '@/hooks/useInterviewPrep'
import { toast } from '@/stores/toastStore'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { Spinner } from '@/components/common/Spinner'
import { InterviewQuestionCard } from './InterviewQuestionCard'

/**
 * F6 PR 2 Phase 4 — 면접 세션 상세 (질문 트리 + AI 일괄 생성).
 *
 * **흐름**:
 * - 질문 트리 fetch (recursive CTE → client tree)
 * - 빈 트리: "AI 질문 생성" CTA (2-stage main 20)
 * - 트리 있음: depth 0 main 카드 list, 각각 children 펼침
 */
export function InterviewSessionDetail({ sessionId }: { sessionId: string }) {
  const { data: questions, isLoading } = useInterviewPrepQuestions(sessionId)
  const { mutateAsync: generateSession, isPending: generating } =
    useGenerateInterviewSession(sessionId)
  const ensureAiConsent = useRequireAiConsent()

  const handleGenerate = async () => {
    if (!(await ensureAiConsent())) return
    try {
      const result = await generateSession()
      if (result.status === 'ok') {
        toast.show(
          `${result.meta?.mainCount ?? 0}개 메인 질문 + 꼬리 ${result.meta?.followupCount ?? 0}개를 생성했어요.`,
        )
      } else {
        toast.error(result.reason ?? '생성에 실패했어요.')
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'AI 호출 중 오류가 발생했어요.'
      toast.error(message)
    }
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

  if (tree.length === 0 && generating) {
    return (
      <div className="border border-dashed border-brand/40 bg-brand/5 rounded-lg px-4 py-10 text-center">
        <Spinner size={32} className="mx-auto text-brand mb-3" />
        <p className="text-text-secondary text-xs mb-1 font-medium">
          <span className="inline-flex items-center gap-1">
            <Bot size={14} strokeWidth={1.75} aria-hidden="true" />
            AI 면접관이 질문을 만들고 있어요
          </span>
        </p>
        <p className="text-text-quaternary text-[11px] leading-relaxed">
          자소서·활동을 꼼꼼히 읽고 있어요. 1~2분쯤 걸려요.
          <br />
          잠시만 기다려 주세요
          <span className="inline-flex ml-0.5">
            <span className="animate-pulse [animation-delay:0ms]">.</span>
            <span className="animate-pulse [animation-delay:200ms]">.</span>
            <span className="animate-pulse [animation-delay:400ms]">.</span>
          </span>
        </p>
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="border border-dashed border-line bg-surface-2/30 rounded-lg px-4 py-8 text-center">
        <div className="mb-2"><Sparkles size={20} strokeWidth={1.75} aria-hidden="true" className="inline-block" /></div>
        <p className="text-text-secondary text-xs mb-3">
          이 세션에 아직 질문이 없어요.
          <br />
          선택한 자소서·로그를 바탕으로 AI 가 예상 질문을 만들어줘요.
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-brand hover:bg-brand-hover text-text-primary text-xs font-semibold px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1">
            <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
            AI 질문 생성 (메인 20개)
          </span>
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
          className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary text-xs disabled:opacity-50"
          title="기존 질문을 모두 지우고 다시 생성"
        >
          {generating ? (
            <>
              <Spinner size={12} />
              <span>다시 만들고 있어요...</span>
            </>
          ) : (
            <span>↻ 다시 생성</span>
          )}
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
