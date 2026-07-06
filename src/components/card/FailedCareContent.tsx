import { useState } from 'react'
import { useAutoResize } from '@/hooks/useAutoResize'
import { useUpdateApplication } from '@/hooks/useApplications'
import { toast } from '@/stores/toastStore'
import { lastReachedInterviewStepName } from '@/utils/failedCare'

/**
 * A9 — 불합격 처리 직후 케어 콘텐츠 (공용).
 * 진입 경로 2곳에서 재사용: SetResultModal(결과 입력) · CompanyCard 드롭다운 불합격 처리.
 *
 * - 면접류 도달: "{1차 면접}까지 간 것 자체가…" — 탈락 노드명 명시 + 회고 한 줄 (스킵 자유)
 * - 서류·인적성: 회고 질문 없이 "남는 것" 안내 (자소서 재사용·통과율 통계)
 * 탈락 처리는 이미 완료된 상태에서 렌더 — 이탈해도 데이터 손실 없음.
 */
interface FailedCareContentProps {
  applicationId: string
  /** 스텝 판정용 스냅샷 — 없으면(로딩 등) 서류 탈락 안내로 폴백 */
  app?: {
    currentStepIndex: number
    steps: Array<{ name: string; orderIndex: number }>
  } | null
  onDone: () => void
}

export function FailedCareContent({ applicationId, app, onDone }: FailedCareContentProps) {
  const { mutate: update, isPending } = useUpdateApplication(applicationId)
  const [takeaway, setTakeaway] = useState('')
  // 길어지면 자동으로 높이 확장 (자소서 답변 textarea 와 동일 훅)
  const { ref: takeawayRef, autoResize } = useAutoResize(takeaway, { min: 72, max: 240 })

  const interviewStepName = app ? lastReachedInterviewStepName(app) : null

  const handleSave = () => {
    const content = takeaway.trim()
    if (!content) {
      onDone()
      return
    }
    update(
      { failedTakeaway: content },
      {
        onSuccess: () => {
          toast.success('기록했어요. 성장 페이지에 쌓여요.')
          onDone()
        },
        onError: () => toast.error('저장에 실패했습니다.'),
      },
    )
  }

  if (interviewStepName) {
    return (
      <>
        <p className="text-text-secondary text-sm leading-relaxed mb-1">
          <span className="text-text-primary font-semibold">{interviewStepName}</span>
          까지 간 것 자체가 쌓인 실력이에요.
        </p>
        <p className="text-text-tertiary text-xs leading-relaxed mb-4">
          다음 면접에서 하나만 다르게 한다면? 한 줄로 남겨두면 성장 페이지에 쌓여요.
        </p>
        <textarea
          ref={takeawayRef}
          autoFocus
          aria-label="탈락 회고"
          value={takeaway}
          onChange={(e) => {
            setTakeaway(e.target.value)
            autoResize()
          }}
          maxLength={500}
          placeholder="예: 프로젝트 회고 질문에 수치로 답하기"
          className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/60 resize-none mb-1"
        />
        <p className="text-right text-[10px] font-mono text-text-quaternary mb-3">
          {takeaway.length}/500
        </p>
        <div className="flex gap-2">
          <button
            onClick={onDone}
            className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors"
          >
            건너뛰기
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !takeaway.trim()}
            className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
          >
            남기기
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="text-text-secondary text-sm leading-relaxed mb-4">
        이 지원, 버린 게 아니에요.
      </p>
      <ul className="space-y-2 mb-5">
        <li className="flex items-start gap-2 text-xs text-text-tertiary leading-relaxed">
          <span className="text-brand mt-px" aria-hidden>✓</span>
          여기 쓴 자소서는 창고에 남아 다음 지원에서 가져올 수 있어요
        </li>
        <li className="flex items-start gap-2 text-xs text-text-tertiary leading-relaxed">
          <span className="text-brand mt-px" aria-hidden>✓</span>
          나의 통과율 통계에 반영돼요 — 성장 페이지에서 확인
        </li>
      </ul>
      <button
        onClick={onDone}
        className="w-full py-2.5 text-xs font-medium text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
      >
        확인
      </button>
    </>
  )
}
