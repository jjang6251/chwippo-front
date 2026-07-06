import { useEffect } from 'react'
import { useMyCoinBalance } from '@/hooks/useMyCoin'

interface Props {
  companyName: string
  onConfirm: () => void
  onClose: () => void
  isPending?: boolean
}

const COIN_COST = 50

/**
 * PR_B1c — 자소서 생성 동의 modal.
 *
 * **안내**:
 * - "{회사} 자소서를 생성하시겠어요?" + "50 코인이 차감됩니다"
 * - 잔여 코인 표시 + 차감 후 잔여 미리보기
 * - 잔여 < 50 → 동의 버튼 disabled + "코인이 부족해요" 안내
 *
 * **동작**:
 * - 동의 → onConfirm() → backend trigger
 * - ESC / backdrop click / 취소 → onClose()
 */
export function GenerateCoverletterConfirmModal({
  companyName,
  onConfirm,
  onClose,
  isPending = false,
}: Props) {
  const { data: balance } = useMyCoinBalance()

  // ESC key → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isPending])

  const currentBalance = balance?.balance ?? 0
  const afterBalance = currentBalance - COIN_COST
  const insufficient = currentBalance < COIN_COST

  const formatBalance = (n: number) =>
    n === Math.floor(n) ? n.toString() : n.toFixed(1)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-cl-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={isPending ? undefined : onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line rounded-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="generate-cl-title"
          className="text-text-primary text-lg font-bold mb-1 flex items-center gap-2"
        >
          <span aria-hidden>✨</span>
          <span>회사 조사를 진행할까요?</span>
        </h2>
        <p className="text-text-tertiary text-xs mb-4">
          <strong className="text-text-secondary">{companyName}</strong> 의 최신 정보를 검색해 AI 초안·챗·점검에 반영해요. 조사 없이도 자소서 작성은 가능해요.
        </p>

        {/* 코인 안내 */}
        <div className="bg-surface-2 border border-line rounded-md px-4 py-3 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-text-tertiary text-xs">필요 코인</span>
            <span className="text-text-primary text-sm font-semibold tabular-nums">
              🪙 {COIN_COST}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-tertiary text-xs">현재 잔여</span>
            <span className="text-text-secondary text-sm tabular-nums">
              🪙 {formatBalance(currentBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2">
            <span className="text-text-tertiary text-xs">차감 후 잔여</span>
            <span
              className={`text-sm font-semibold tabular-nums ${insufficient ? 'text-danger' : 'text-text-primary'}`}
            >
              🪙 {formatBalance(afterBalance)}
            </span>
          </div>
        </div>

        {insufficient && (
          <div className="bg-danger/10 border border-danger/30 rounded-md px-3 py-2.5 mb-4 text-xs text-danger leading-relaxed">
            ⚠️ 코인이 부족해요. 우측 상단 🪙 chip 클릭 → Pro 결제 안내
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 bg-card border border-line hover:bg-card-strong text-text-secondary text-sm font-medium px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || insufficient}
            className="flex-1 bg-brand hover:bg-brand-hover text-text-primary text-sm font-semibold px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
          >
            {isPending ? '생성 중...' : `생성 (🪙 ${COIN_COST})`}
          </button>
        </div>
      </div>
    </div>
  )
}
