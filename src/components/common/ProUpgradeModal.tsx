import { useEffect } from 'react'
import type { CoinTier } from '@/types/coinSystem'
import { TIER_LABEL, TIER_PRICE_KRW } from '@/types/coinSystem'

interface Props {
  balance: number
  tier: CoinTier
  monthlyCoinLimit: number
  nextResetAt: string
  onClose: () => void
}

/**
 * PR_B1b — Pro 업그레이드 안내 modal.
 *
 * **표시**:
 * - 현재 tier + 잔여 + 다음 갱신일
 * - Lite (4,900원) / Standard (9,900원) 한도 비교
 * - 결제 인프라 준비 중 — chwippo0319@gmail.com 문의 (manual 처리)
 *
 * **결제 인프라 도입 후** (별도 PR): 직접 결제 버튼으로 변경.
 */
export function ProUpgradeModal({
  balance,
  tier,
  monthlyCoinLimit,
  nextResetAt,
  onClose,
}: Props) {
  // ESC key → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const resetDateStr = new Date(nextResetAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formatBalance = (n: number) =>
    n === Math.floor(n) ? n.toString() : n.toFixed(1)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-upgrade-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line rounded-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="pro-upgrade-title"
          className="text-text-primary text-lg font-bold mb-1"
        >
          🪙 치뽀 코인
        </h2>
        <p className="text-text-tertiary text-xs mb-4">
          AI 기능 사용량 통합 매트릭스. 자소서·면접 등 모든 AI 호출에 사용돼요.
        </p>

        {/* 현재 상태 */}
        <div className="bg-surface-2 border border-line rounded-md px-4 py-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-text-tertiary text-xs">현재 플랜</span>
            <span className="text-text-primary text-sm font-semibold">
              {TIER_LABEL[tier]}
            </span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-text-tertiary text-xs">잔여</span>
            <span className="text-text-primary text-sm font-semibold tabular-nums">
              {formatBalance(balance)} / {monthlyCoinLimit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-tertiary text-xs">다음 갱신</span>
            <span className="text-text-secondary text-xs">{resetDateStr}</span>
          </div>
        </div>

        {/* 결제 안내 */}
        {tier !== 'standard' && (
          <div className="space-y-3 mb-4">
            <p className="text-text-secondary text-sm font-medium">
              더 많이 사용하고 싶다면?
            </p>
            {(['lite', 'standard'] as const).map((t) => {
              if (t === tier) return null
              const limits = { lite: 800, standard: 1500 } as const
              return (
                <div
                  key={t}
                  className="border border-line rounded-md px-4 py-3 bg-surface-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-text-primary text-sm font-semibold">
                      {TIER_LABEL[t]}
                    </span>
                    <span className="text-brand text-sm font-bold tabular-nums">
                      월 {TIER_PRICE_KRW[t].toLocaleString()}원
                    </span>
                  </div>
                  <p className="text-text-tertiary text-xs">
                    🪙 월 {limits[t]} 코인 · 자소서·면접 자유롭게
                  </p>
                </div>
              )
            })}
            <div className="bg-info/10 border border-info/30 rounded-md px-3 py-2.5 text-[11px] text-text-secondary leading-relaxed">
              💌 현재 결제 인프라 준비 중이에요.{' '}
              <a
                href="mailto:chwippo0319@gmail.com?subject=치뽀 Pro 결제 문의"
                className="text-brand hover:underline font-medium"
              >
                chwippo0319@gmail.com
              </a>{' '}
              으로 문의하시면 빠르게 도와드릴게요.
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-card border border-line hover:bg-card-strong text-text-primary text-sm font-medium px-4 py-2.5 rounded-md transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  )
}
