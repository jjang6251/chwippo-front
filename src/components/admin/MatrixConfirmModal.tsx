import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * PR_B2 Phase 3 — Q3 C 매트릭스 수정 confirm modal.
 *
 * tier_configs / feature_coin_meta 수정 시 사용자에게 "기존 사용자 N명 영향" 표시
 * + applyMode 선택 (immediate / next_reset) 강제.
 */
interface Props {
  title: string
  description: string
  /**
   * 영향받는 사용자 수. **셀 수 있을 때만 넘긴다.**
   *
   * 🔴 tier 변경처럼 대상이 고정 집합이면 정확한 수를 셀 수 있지만, feature 단위
   * 설정(모델·코인 정책)은 **앞으로 그 기능을 쓸 사람까지 포함**이라 수로 표현되지 않는다.
   * 그런데도 0 을 넘기면 화면에 `영향: 0명 사용자` 가 떠서 **"아무도 영향 없다"** 로
   * 읽힌다 — 틀린 정도가 아니라 위험한 방향으로 틀린다.
   *
   * 그래서 셀 수 없으면 **넘기지 않는다.** 대신 `impactLabel` 로 대상을 말로 적는다.
   */
  affectedUsers?: number
  /** `affectedUsers` 를 생략했을 때 표시할 문구. 기본값은 "이 설정을 사용하는 모든 사용자" */
  impactLabel?: string
  /** preview sample (잔액 변동 가시화) */
  sample?: Array<{ userId: string; balance: number }>
  /** balance diff (immediate 시 표시) — undefined 면 monthly_coin_limit 무관 변경 */
  balanceDiff?: number
  /** false = applyMode 선택 X (예: feature_coin_meta 는 즉시 적용 only) */
  showApplyMode?: boolean
  onConfirm: (applyMode: 'immediate' | 'next_reset') => void
  onClose: () => void
}

export function MatrixConfirmModal({
  title,
  description,
  affectedUsers,
  impactLabel,
  sample,
  balanceDiff,
  showApplyMode = true,
  onConfirm,
  onClose,
}: Props) {
  const [applyMode, setApplyMode] = useState<'immediate' | 'next_reset'>(
    'next_reset',
  )

  // PR_B2 Phase 3 — ESC key 닫기 (uiux 표준)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // PR_B2 Phase 3 — createPortal 로 body 렌더 (containing block 안전)
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="matrix-confirm-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line rounded-xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="matrix-confirm-title"
          className="text-text-primary text-base font-bold"
        >
          {title}
        </h2>

        <p className="text-text-secondary text-sm whitespace-pre-line">
          {description}
        </p>

        <div className="bg-warning/10 border border-warning/30 rounded-md p-3 space-y-1">
          <p className="text-text-primary text-sm font-semibold">
            {affectedUsers === undefined ? (
              // 셀 수 있을 때만 센다 — 아래 주석 참조
              <>⚠️ 영향: {impactLabel ?? '이 설정을 사용하는 모든 사용자'}</>
            ) : (
              <>
                ⚠️ 영향: <span className="font-mono">{affectedUsers}</span>명
                사용자
              </>
            )}
          </p>
          {sample && sample.length > 0 && (
            <div className="space-y-0.5 mt-2">
              <p className="text-text-quaternary text-[10px]">
                샘플 (최근 활동 user):
              </p>
              <ul className="text-text-tertiary text-[10px] font-mono">
                {sample.slice(0, 5).map((s) => (
                  <li key={s.userId}>
                    {s.userId.slice(0, 8)}... · 잔액 {s.balance}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {showApplyMode && (
          <fieldset className="space-y-1.5">
            <legend className="text-text-secondary text-xs mb-1.5">
              적용 시점
            </legend>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="applyMode"
                value="next_reset"
                checked={applyMode === 'next_reset'}
                onChange={() => setApplyMode('next_reset')}
                className="mt-0.5"
              />
              <span className="text-text-secondary text-xs">
                <strong className="text-text-primary">다음 reset 부터</strong>{' '}
                <span className="text-success">권장</span> — 현재 cycle 끝까지 기존
                정책 유지. 사용자 영향 최소
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="applyMode"
                value="immediate"
                checked={applyMode === 'immediate'}
                onChange={() => setApplyMode('immediate')}
                className="mt-0.5"
              />
              <span className="text-text-secondary text-xs">
                <strong className="text-danger">즉시 적용</strong>{' '}
                <span className="text-text-quaternary">— 모든 사용자 잔액 즉시 ±</span>
                {balanceDiff !== undefined && balanceDiff !== 0 && (
                  <span className="text-warning ml-1">
                    (1인당 잔액 변경: {balanceDiff > 0 ? '+' : ''}
                    {balanceDiff})
                  </span>
                )}
              </span>
            </label>
          </fieldset>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => onConfirm(applyMode)}
            className="flex-1 bg-brand hover:bg-accent text-bg text-sm font-semibold py-2.5 rounded-md"
          >
            확인
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-card-strong hover:bg-surface-2 border border-line text-text-secondary text-sm font-medium py-2.5 rounded-md"
          >
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
