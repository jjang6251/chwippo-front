import { Modal } from '@/components/common/Modal'
import { countChars } from '@/utils/charCount'
import { countFillPlaceholders } from '@/utils/coverletterPlaceholder'

/**
 * F1 자소서 chat — "모두 적용" 요약 모달.
 *
 * 미처리 제안 2개 이상일 때 개별 diff 확인을 대체하는 일괄 요약.
 * 각 문항의 글자수·제한 초과·placeholder 잔존을 한눈에 확인 후 한 번에 적용.
 */

export interface BulkApplyItem {
  clId: string
  /** 1-based 문항 번호 */
  number?: number
  question: string
  newAnswer: string
  charLimit: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  items: BulkApplyItem[]
}

export function CoverletterBulkApplyModal({ open, onClose, onConfirm, items }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={`${items.length}개 문항에 한 번에 적용`}>
      <p className="text-text-tertiary text-xs leading-relaxed mb-3">
        아래 문항의 답변을 제안 내용으로 교체해요. 개별 미리보기 없이 한 번에 적용됩니다.
      </p>
      <div className="max-h-[60vh] overflow-y-auto overscroll-contain space-y-2 mb-4">
        {items.map((it) => {
          const n = countChars(it.newAnswer).total
          const over = it.charLimit != null && n > it.charLimit
          const fills = countFillPlaceholders(it.newAnswer)
          return (
            <div key={it.clId} className="bg-surface border border-line rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                {it.number != null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand font-bold font-mono">
                    Q{it.number}
                  </span>
                )}
                <span className="text-[11px] text-text-secondary truncate flex-1">
                  {it.question.slice(0, 28)}
                  {it.question.length > 28 ? '…' : ''}
                </span>
              </div>
              <p className="text-[10px] font-mono">
                {over ? (
                  <span className="text-warning">
                    ⚠️ {n}자 초과 (제한 {it.charLimit}자)
                  </span>
                ) : (
                  <span className="text-text-quaternary">
                    {n}자{it.charLimit != null ? ` / 제한 ${it.charLimit}자` : ''}
                  </span>
                )}
              </p>
              {fills > 0 && (
                <p className="text-[10px] text-warning mt-0.5">
                  ⚠️ 채워야 할 부분 {fills}곳
                </p>
              )}
            </div>
          )
        })}
      </div>
      {items.some(
        (it) =>
          it.charLimit != null && countChars(it.newAnswer).total > it.charLimit,
      ) && (
        <p className="text-[10px] text-text-quaternary leading-relaxed mb-3">
          💡 글자수 초과는 지금 걱정하지 않아도 돼요 — 작성을 마친 뒤 각 문항의
          [검사 → AI 심층 점검]이 줄일 문장을 짚어드려요.
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
        >
          취소
        </button>
        <button
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className="flex-1 py-2.5 text-xs font-semibold text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
        >
          {items.length}개 문항에 적용
        </button>
      </div>
    </Modal>
  )
}
