import { useState } from 'react'
import { useConvertExamToCert } from '@/hooks/useExamSchedules'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { toast } from '@/stores/toastStore'
import type { ExamSchedule } from '@/types/exam-schedule'

interface Props {
  exam: ExamSchedule
  onClose: () => void
}

export function ConvertExamToCertModal({ exam, onClose }: Props) {
  const [scoreGrade, setScoreGrade] = useState('')
  const convert = useConvertExamToCert(exam.id)
  const isMobile = useIsMobile()

  const isLanguage = exam.exam_type === 'language'
  const successLabel = isLanguage ? '어학 자격증' : '자격증'

  function handleSubmit() {
    if (isLanguage && !scoreGrade.trim()) return
    convert.mutate(
      { score_grade: scoreGrade.trim() },
      {
        onSuccess: () => {
          toast.show(`${successLabel}으로 이관됐어요`)
          onClose()
        },
      },
    )
  }

  return (
    <div
      /*
        🔴 컨테이너에 하단 여백을 주지 않는다 — 오버레이가 이미 탭바를 어둡게 덮고 있어서
        여백은 시트와 탭바 사이 **검은 띠**로만 남았다 (2026-08-30 iPhone 실사고, `Modal` 과 같은 건).
        탭바(z-50) 위로 올려 시트가 바닥까지 내려오게 하고, 홈 인디케이터 여백은 아래 본문의
        `pb-[max(1.25rem,env(safe-area-inset-bottom))]` 이 이미 지고 있다.
      */
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`${exam.name} 결과 입력`} className="relative z-10 w-full max-w-sm bg-surface border border-line rounded-t-xl sm:rounded-xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto">
        <h3 className="text-text-primary text-sm font-semibold mb-3">{exam.name} 결과 입력</h3>
        <p className="text-text-quaternary text-[11px] mb-4">
          <span className="text-violet font-medium">{successLabel}</span>으로 자동 이관됩니다.
          나머지 정보는 내 정보 창고에서 편집할 수 있어요.
        </p>

        {isLanguage && (
          <div className="mb-5">
            <label className="block text-text-tertiary text-[11px] mb-1.5">점수/등급</label>
            <input
              value={scoreGrade}
              onChange={(e) => setScoreGrade(e.target.value)}
              placeholder="예: 850점 / IH / 6급"
              // 모바일은 열자마자 키보드가 모달을 덮는다 — 먼저 보고, 탭해서 입력 (2026-08-30 iPhone 실사고)
              autoFocus={!isMobile}
              className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-line text-text-tertiary text-xs hover:bg-card active:bg-card-strong transition-colors"
          >취소</button>
          <button
            onClick={handleSubmit}
            disabled={(isLanguage && !scoreGrade.trim()) || convert.isPending}
            className="flex-1 py-2 rounded-lg bg-violet text-text-primary text-xs font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >이관</button>
        </div>
      </div>
    </div>
  )
}
