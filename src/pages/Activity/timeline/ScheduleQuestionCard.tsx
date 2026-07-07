import { useState } from 'react'
import { useQuickCreateLog } from '@/hooks/useActivities'
import { toast } from '@/stores/toastStore'
import type { ScheduleQuestion } from './questionCard'
import { dismissStepQuestion } from './questionCard'

/**
 * activity-redesign — 일정 기반 질문 카드 (있는 날만 최상단).
 * 치뽀만의 소스: 유저 일정을 아니까 "삼성 코테 어땠어요?" 를 물을 수 있음.
 * 답 = relatedStepId 연결된 로그 (다음 방문부터 카드 안 뜸).
 */
interface ScheduleQuestionCardProps {
  question: ScheduleQuestion
  onDone: () => void
}

export function ScheduleQuestionCard({ question, onDone }: ScheduleQuestionCardProps) {
  const [answering, setAnswering] = useState(false)
  const [answer, setAnswer] = useState('')
  const { mutate: quickCreate, isPending } = useQuickCreateLog()

  const handleSave = () => {
    const trimmed = answer.trim()
    if (!trimmed) return
    quickCreate(
      { content: trimmed, relatedStepId: question.stepId },
      {
        onSuccess: () => {
          toast.success('기록했어요. 다음 준비에 쓰여요.')
          onDone()
        },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  const handleDismiss = () => {
    dismissStepQuestion(question.stepId)
    onDone()
  }

  return (
    <section className="mb-2.5">
      <div className="bg-surface-2 border border-info/30 rounded-2xl p-4">
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info border border-info/25 font-medium mb-1.5">
          📅 {question.dateLabel} 일정
        </span>
        <p className="text-[14px] font-semibold text-text-primary leading-snug mb-1">
          {question.companyName} {question.stepName}, 어땠어요?
        </p>
        <p className="text-[11px] text-text-quaternary mb-3">
          기억나는 것 한 줄이면 다음 준비가 쉬워져요
        </p>

        {answering ? (
          <>
            <textarea
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={200}
              rows={2}
              aria-label={`${question.companyName} ${question.stepName} 기록`}
              placeholder="예: 2번 문제 시간 배분 실패 — 다음엔 쉬운 것부터"
              className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/60 resize-none mb-2.5"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAnswering(false)}
                className="px-3 py-2 text-xs text-text-quaternary hover:text-text-secondary transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !answer.trim()}
                className="flex-1 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40"
              >
                남기기
              </button>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setAnswering(true)}
              className="flex-1 py-2 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
            >
              한 줄 남기기
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 text-xs text-text-quaternary hover:text-text-secondary transition-colors"
            >
              넘기기
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
