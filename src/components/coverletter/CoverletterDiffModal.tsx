import { useMemo } from 'react'
import { Modal } from '@/components/common/Modal'
import { wordDiff } from '@/utils/wordDiff'

/**
 * F1 자소서 풀페이지 Phase G.3 — word-level diff preview modal.
 *
 * AI suggestedUpdate 적용 전 변경 영역 시각화 (green add / red remove).
 * Cursor·JobSprout 패턴 — 사용자가 의식적으로 승인.
 */

interface Props {
  open: boolean
  onClose: () => void
  question: string
  currentAnswer: string
  newAnswer: string
  onApply: () => void
}

export function CoverletterDiffModal({
  open,
  onClose,
  question,
  currentAnswer,
  newAnswer,
  onApply,
}: Props) {
  const tokens = useMemo(
    () => wordDiff(currentAnswer, newAnswer),
    [currentAnswer, newAnswer],
  )

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    for (const t of tokens) {
      const w = t.text.trim().split(/\s+/).filter(Boolean).length
      if (t.kind === 'added') added += w
      else if (t.kind === 'removed') removed += w
    }
    return { added, removed }
  }, [tokens])

  return (
    <Modal open={open} onClose={onClose} title="변경 영역 미리보기">
      <p className="text-text-quaternary text-[11px] mb-2">
        문항: {question.slice(0, 60)}
        {question.length > 60 ? '…' : ''}
      </p>
      <div className="flex items-center gap-3 text-[11px] mb-3">
        <span className="text-success">
          +{stats.added} 단어 추가
        </span>
        <span className="text-danger">−{stats.removed} 단어 제거</span>
      </div>
      <div className="bg-surface border border-line rounded-lg p-3 max-h-[50vh] overflow-y-auto text-[13px] leading-[1.7] whitespace-pre-wrap font-sans">
        {tokens.map((t, i) => {
          if (t.kind === 'equal') return <span key={i}>{t.text}</span>
          if (t.kind === 'added') {
            return (
              <span
                key={i}
                className="bg-success/15 text-success/95 rounded-sm"
                style={{ textDecoration: 'none' }}
              >
                {t.text}
              </span>
            )
          }
          return (
            <span
              key={i}
              className="bg-danger/15 text-danger/95 line-through rounded-sm"
            >
              {t.text}
            </span>
          )
        })}
      </div>
      <div className="flex gap-2 mt-5">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
        >
          취소
        </button>
        <button
          onClick={() => {
            onApply()
            onClose()
          }}
          className="flex-1 py-2.5 text-xs font-semibold text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
        >
          ✓ 적용
        </button>
      </div>
    </Modal>
  )
}
