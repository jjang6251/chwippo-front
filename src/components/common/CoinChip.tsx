import { useState } from 'react'
import { Coins } from 'lucide-react'
import { useMyCoinBalance } from '@/hooks/useMyCoin'
import { TIER_LABEL } from '@/types/coinSystem'
import { ProUpgradeModal } from './ProUpgradeModal'

/**
 * PR_B1b — 헤더 코인 chip (모든 페이지 표시).
 *
 * **표시 형식**: `🪙 78.5 / 100`
 * - 음수 잔여: `🪙 -5 / 100` (warning 색)
 * - 20% 미만: warning 색
 * - 정상: 기본 색
 *
 * **클릭 시**: ProUpgradeModal 노출 (잔여 + 결제 안내).
 *
 * **staleTime 5초**: 호출 직후 빠른 refetch. 다른 mutation 의 invalidate 로도 갱신.
 *
 * **silent fail**: balance fetch 실패 또는 미로드 시 chip 안 보임 (사용자 혼란 X).
 */
export function CoinChip() {
  const { data, isLoading } = useMyCoinBalance()
  const [open, setOpen] = useState(false)

  if (isLoading || !data) return null

  const ratio = data.monthlyCoinLimit > 0 ? data.balance / data.monthlyCoinLimit : 0
  const isLow = data.balance < 0 || ratio < 0.2

  const colorClasses = isLow
    ? 'text-warning border-warning/30 bg-warning/10 hover:bg-warning/20'
    : 'text-text-secondary border-line bg-card hover:bg-card-strong'

  // 소수점 1자리 + 음수도 정확 표시
  const formatBalance = (n: number) => {
    if (n === Math.floor(n)) return n.toString()
    return n.toFixed(1)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors ${colorClasses}`}
        aria-label={`코인 잔여 ${formatBalance(data.balance)} / ${data.monthlyCoinLimit} (${TIER_LABEL[data.tier]})`}
        title={
          data.planExpiresAt && data.tier !== 'free'
            ? `${TIER_LABEL[data.tier]} 플랜 — 갱신 ${new Date(data.nextResetAt).toLocaleDateString('ko-KR')}\n⏱ ${new Date(data.planExpiresAt).toLocaleDateString('ko-KR')} Plan 만료 → Free 강등`
            : `${TIER_LABEL[data.tier]} 플랜 — 갱신 ${new Date(data.nextResetAt).toLocaleDateString('ko-KR')}`
        }
      >
        <Coins size={13} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
        <span className="tabular-nums">{formatBalance(data.balance)}</span>
      </button>
      {open && (
        <ProUpgradeModal
          balance={data.balance}
          tier={data.tier}
          monthlyCoinLimit={data.monthlyCoinLimit}
          nextResetAt={data.nextResetAt}
          planExpiresAt={data.planExpiresAt}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
