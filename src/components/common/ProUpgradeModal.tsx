import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CoinTier } from '@/types/coinSystem'
import { TIER_LABEL, TIER_PRICE_KRW } from '@/types/coinSystem'
import { useMyAiQuotas } from '@/hooks/useMyAiQuotas'
import type { LlmFeature, MyAiQuotaRow } from '@/types/aiQuota'
import { AiQuotaChip } from './AiQuotaChip'

/** 공개된 사용자 트리거 AI feature — 이 순서·이 라벨로 표시 (면접 계열 비공개 제외) */
const QUOTA_FEATURES: { feature: LlmFeature; label: string }[] = [
  { feature: 'coverletter_chat', label: '자소서 AI 채팅' },
  { feature: 'coverletter_feedback', label: 'AI 심층 점검' },
  { feature: 'note_summary', label: '활동 노트 AI 요약' },
]

/** 사용량 색: 소진 → danger, 임박(80%+) → warning, 그 외 기본 */
function usageColor(used: number, limit: number): string {
  if (used >= limit) return 'text-danger'
  if (limit > 0 && used / limit >= 0.8) return 'text-warning'
  return 'text-text-secondary'
}

/** cooldownSeconds 표기 — 60 이상이면 "N분" */
function formatCooldown(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)}분` : `${sec}초`
}

/** 현재 쿨다운 중 (nextAvailableAt 미래) */
function isCoolingDown(quota: MyAiQuotaRow): boolean {
  return !!quota.nextAvailableAt && new Date(quota.nextAvailableAt) > new Date()
}

interface Props {
  balance: number
  tier: CoinTier
  monthlyCoinLimit: number
  nextResetAt: string
  /** PR_B2 Phase 3 — 유료 plan 만료 예정 (lite/standard) */
  planExpiresAt?: string | null
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
  planExpiresAt,
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

  const [renderedNow] = useState(() => Date.now())

  // AI 사용 한도 — 로딩·실패 시 data 없음 → 아래 quotaRows 빈 배열 → 섹션 자체 숨김 (silent)
  const { data: quotas } = useMyAiQuotas()
  const quotaRows = QUOTA_FEATURES.map((f) => ({
    ...f,
    quota: quotas?.find((r) => r.feature === f.feature),
  })).filter(
    (r): r is { feature: LlmFeature; label: string; quota: MyAiQuotaRow } =>
      Boolean(r.quota),
  )

  const resetDateStr = new Date(nextResetAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formatBalance = (n: number) =>
    n === Math.floor(n) ? n.toString() : n.toFixed(1)

  // PR_B2 Phase 3 — backdrop-blur 부모로 인한 containing block 문제 fix.
  // 헤더(sticky + backdrop-blur)가 fixed positioning 의 reference 가 되어 모달이 화면 중앙이 아닌 헤더 옆에 표시되던 버그.
  // createPortal 로 body 에 직접 렌더 → fixed 가 viewport 기준으로 정상 작동.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-upgrade-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line rounded-xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto overscroll-contain"
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
          {/* PR_B2 Phase 3 — Plan 만료 예정 (lite/standard 만) */}
          {planExpiresAt && tier !== 'free' && (
            <div className="mt-2 pt-2 border-t border-line flex items-center justify-between">
              <span className="text-warning text-xs">⏱ Plan 만료</span>
              <span className="text-warning text-xs font-semibold">
                {new Date(planExpiresAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                (D-
                {Math.max(
                  0,
                  Math.ceil(
                    (new Date(planExpiresAt).getTime() - renderedNow) / 86400000,
                  ),
                )}
                )
              </span>
            </div>
          )}
          {planExpiresAt && tier !== 'free' && (
            <p className="text-text-quaternary text-[10px] mt-1">
              만료 시 자동으로 Free 플랜으로 전환돼요
            </p>
          )}
        </div>

        {/* AI 사용 한도 — 코인과 별개 (연속 호출 방지 한도) */}
        {quotaRows.length > 0 && (
          <div className="mb-4">
            <h3 className="text-text-secondary text-xs font-semibold">
              AI 사용 한도
            </h3>
            <p className="text-text-quaternary text-[10px] mb-2">
              코인과 별개로, 과도한 연속 호출을 막기 위한 한도예요.
            </p>
            <div className="space-y-2">
              {quotaRows.map(({ feature, label, quota }) => (
                <div
                  key={feature}
                  className="bg-surface-2 border border-line rounded-md px-3 py-2.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-text-primary text-xs font-medium">
                      {label}
                    </span>
                    {isCoolingDown(quota) && (
                      <AiQuotaChip feature={feature} size="sm" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
                    <span>
                      오늘{' '}
                      <span
                        className={`font-mono ${usageColor(quota.dayUsed, quota.dayLimit)}`}
                      >
                        {`${quota.dayUsed} / ${quota.dayLimit}회`}
                      </span>
                    </span>
                    <span>
                      이번 달{' '}
                      <span
                        className={`font-mono ${usageColor(quota.monthUsed, quota.monthLimit)}`}
                      >
                        {`${quota.monthUsed} / ${quota.monthLimit}회`}
                      </span>
                    </span>
                  </div>
                  {quota.cooldownSeconds > 0 && (
                    <p className="text-text-quaternary text-[10px] mt-1">
                      요청 간격 {formatCooldown(quota.cooldownSeconds)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
    </div>,
    document.body,
  )
}
