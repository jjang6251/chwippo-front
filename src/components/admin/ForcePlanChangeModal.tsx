import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { forceChangeTierApi } from '@/api/forceChangeTier'
import type { CoinTier } from '@/types/coinSystem'

/**
 * PR_B2 Phase 3 — admin 의 사용자 tier 강제 변경 모달.
 *
 * Q11 quick chip (1·3·6·12개월 + 직접 입력) + Q2 B applyMode 명시.
 * downgrade 시 next_cycle 권장 안내.
 */
interface Props {
  userId: string
  nickname: string
  currentTier: CoinTier
  onClose: () => void
}

const QUICK_DURATIONS: Array<{ label: string; months: number }> = [
  { label: '1개월', months: 1 },
  { label: '3개월', months: 3 },
  { label: '6개월', months: 6 },
  { label: '12개월', months: 12 },
]

const TIER_OPTIONS: CoinTier[] = ['free', 'lite', 'standard']

function isTierDowngrade(from: CoinTier, to: CoinTier): boolean {
  const order = { free: 0, lite: 1, standard: 2 }
  return order[to] < order[from]
}

export function ForcePlanChangeModal({
  userId,
  nickname,
  currentTier,
  onClose,
}: Props) {
  const qc = useQueryClient()
  const [newTier, setNewTier] = useState<CoinTier>(currentTier)
  const [reason, setReason] = useState('')
  const [expiresAtLocal, setExpiresAtLocal] = useState('')
  const [applyMode, setApplyMode] = useState<'immediate' | 'next_cycle'>(
    'next_cycle',
  )
  const [renderedNow] = useState(() => Date.now())

  const change = useMutation({
    mutationFn: () =>
      forceChangeTierApi.change(userId, {
        newTier,
        planExpiresAt: expiresAtLocal
          ? new Date(expiresAtLocal).toISOString()
          : undefined,
        applyMode,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-detail', userId] })
      onClose()
    },
  })

  const setQuick = (months: number) => {
    const d = new Date(renderedNow)
    d.setMonth(d.getMonth() + months)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    setExpiresAtLocal(`${yyyy}-${mm}-${dd}T${hh}:${mi}`)
  }

  const sameTier = newTier === currentTier
  const isDowngrade = isTierDowngrade(currentTier, newTier)
  const validReason = reason.trim().length >= 1 && reason.trim().length <= 500
  const valid = !sameTier && validReason

  // PR_B2 Phase 3 — ESC key 닫기 (uiux 표준 접근성)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // PR_B2 Phase 3 — createPortal 로 body 에 렌더 (sticky bar 의 backdrop-blur containing block 문제 회피)
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-plan-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line rounded-xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="force-plan-title"
          className="text-text-primary text-base font-bold"
        >
          ⬆️ Plan 강제 변경 — {nickname}
        </h2>
        <p className="text-text-quaternary text-xs">
          현재 tier:{' '}
          <span className="font-mono text-text-secondary">{currentTier}</span>
        </p>

        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs">새 tier</label>
          <div className="flex gap-1.5">
            {TIER_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNewTier(t)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-md border transition-colors ${
                  newTier === t
                    ? 'bg-brand/15 text-brand border-brand/30'
                    : 'bg-card-strong border-line text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {!sameTier && (
          <>
            <fieldset className="space-y-1.5">
              <legend className="text-text-secondary text-xs mb-1">
                적용 시점
              </legend>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="applyMode"
                  value="next_cycle"
                  checked={applyMode === 'next_cycle'}
                  onChange={() => setApplyMode('next_cycle')}
                  className="mt-0.5"
                />
                <span className="text-text-secondary text-xs">
                  <strong className="text-text-primary">다음 cycle 부터</strong>
                  {isDowngrade && (
                    <span className="text-success ml-1">권장 (Q2)</span>
                  )}
                  <span className="text-text-quaternary block text-[10px]">
                    {isDowngrade
                      ? '현재 cycle 끝까지 ' +
                        currentTier +
                        ' 유지 → 만료 시 자동 강등'
                      : '다음 reset 시점부터 새 tier 적용'}
                  </span>
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
                  <strong className={isDowngrade ? 'text-danger' : ''}>
                    즉시 적용
                  </strong>
                  <span className="text-text-quaternary block text-[10px]">
                    {isDowngrade
                      ? '⚠️ 즉시 강등 — 잔액 reset 0 위험'
                      : '즉시 새 tier + balance reset'}
                  </span>
                </span>
              </label>
            </fieldset>

            {/* PR_B2 Phase 3 — Free 로 변경 시 만료일 input 숨김 (Free 는 무료 무기한) */}
            {newTier !== 'free' && (
              <div className="space-y-1.5">
                <label className="text-text-secondary text-xs">
                  Plan 만료일 (default 30일)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_DURATIONS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setQuick(q.months)}
                      className="text-[11px] px-2 py-1 rounded-md border bg-card-strong border-line text-text-tertiary hover:text-text-secondary"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  value={expiresAtLocal}
                  onChange={(e) => setExpiresAtLocal(e.target.value)}
                  className="w-full bg-input border border-line text-text-primary placeholder:text-text-tertiary text-xs px-3 py-2 rounded-md"
                />
              </div>
            )}
            {newTier === 'free' && (
              <div className="bg-info/10 border border-info/20 rounded-md px-3 py-2">
                <p className="text-text-secondary text-xs">
                  ℹ️ Free 는 무료 plan — 만료일 부재
                </p>
                <p className="text-text-quaternary text-[10px] mt-0.5">
                  {applyMode === 'next_cycle'
                    ? '현재 cycle 끝까지 기존 tier 유지 → 자동 free 강등'
                    : '즉시 free 로 강등'}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-text-secondary text-xs">
                변경 사유 (1~500자)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="예: 운영자 수동 결제 처리 (Lite 3개월)"
                className="w-full bg-input border border-line text-text-primary placeholder:text-text-tertiary text-xs px-3 py-2 rounded-md resize-none"
              />
            </div>
          </>
        )}

        {sameTier && (
          <p className="text-text-quaternary text-xs">
            ℹ️ 같은 tier — 변경 사항 없음
          </p>
        )}

        {change.isError && (
          <p className="text-danger text-xs">
            {(change.error as { message?: string })?.message ?? '오류'}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => change.mutate()}
            disabled={!valid || change.isPending}
            className="flex-1 bg-brand hover:bg-accent text-bg text-sm font-semibold py-2.5 rounded-md disabled:opacity-50"
          >
            {change.isPending ? '변경 중...' : '변경'}
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
