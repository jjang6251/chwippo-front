import { useState } from 'react'
import { useConvertExamToCert } from '@/hooks/useExamSchedules'
import { toast } from '@/stores/toastStore'
import type { ExamSchedule } from '@/types/exam-schedule'

interface Props {
  exam: ExamSchedule
  onClose: () => void
}

export function ConvertExamToCertModal({ exam, onClose }: Props) {
  const [scoreGrade, setScoreGrade] = useState('')
  const convert = useConvertExamToCert(exam.id)

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-white/8 rounded-t-xl sm:rounded-xl p-5">
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
              autoFocus
              className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-violet/40 transition-colors"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-white/8 text-text-tertiary text-xs hover:bg-white/5 transition-colors"
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
