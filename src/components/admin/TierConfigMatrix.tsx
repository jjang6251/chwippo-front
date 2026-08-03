import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminCard } from '@/components/common/AdminCard'
import { MatrixConfirmModal } from '@/components/admin/MatrixConfirmModal'
import {
  tierConfigAdminApi,
  type TierConfig,
  type UpdateTierConfigDto,
} from '@/api/tierConfigAdmin'
import type { CoinTier } from '@/types/coinSystem'
import { toast } from '@/stores/toastStore'

/**
 * PR_B2 Phase 3 — tier_configs 7 컬럼 × 3 tier 매트릭스 inline edit.
 *
 * - 변경 시 MatrixConfirmModal 강제 ("영향 N명" + applyMode 선택)
 * - audit before/after 자동 (backend)
 */

const COLUMNS: Array<{
  key: keyof Pick<
    TierConfig,
    | 'monthlyCoinLimit'
    | 'inputTokenCapPerCall'
    | 'defaultCooldownSeconds'
    | 'noteSummaryCooldownMinutes'
    | 'priceKrw'
  >
  label: string
  unit?: string
  type: 'number'
}> = [
  { key: 'monthlyCoinLimit', label: '월 한도', unit: '코인', type: 'number' },
  { key: 'inputTokenCapPerCall', label: 'Input cap', unit: '토큰', type: 'number' },
  {
    key: 'defaultCooldownSeconds',
    label: 'Cooldown',
    unit: '초',
    type: 'number',
  },
  {
    key: 'noteSummaryCooldownMinutes',
    label: '노트 Cooldown',
    unit: '분',
    type: 'number',
  },
  { key: 'priceKrw', label: '가격', unit: '원', type: 'number' },
]

interface PendingChange {
  tier: CoinTier
  field: keyof UpdateTierConfigDto
  newValue: number | boolean
  before: number | boolean
  label: string
}

export function TierConfigMatrix() {
  const qc = useQueryClient()
  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ['admin', 'tier-configs'],
    queryFn: tierConfigAdminApi.listAll,
  })
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<{
    affectedUsers: number
    sample: Array<{ userId: string; balance: number }>
  } | null>(null)

  const update = useMutation({
    mutationFn: ({
      tier,
      dto,
    }: {
      tier: CoinTier
      dto: UpdateTierConfigDto
    }) => tierConfigAdminApi.update(tier, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tier-configs'] })
      toast.show('tier_config 변경 완료')
      setPending(null)
      setPreview(null)
    },
    onError: () => toast.show('변경 실패 — 다시 시도'),
  })

  const handleChange = async (
    tier: CoinTier,
    field: keyof UpdateTierConfigDto,
    newValue: number,
    before: number,
    label: string,
  ) => {
    if (newValue === before) return
    setPending({ tier, field, newValue, before, label })
    setPreviewLoading(true)
    try {
      const p = await tierConfigAdminApi.getPreview(tier)
      setPreview(p)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirm = (applyMode: 'immediate' | 'next_reset') => {
    if (!pending) return
    update.mutate({
      tier: pending.tier,
      dto: {
        [pending.field]: pending.newValue,
        applyMode,
      } as UpdateTierConfigDto,
    })
  }

  if (isLoading) {
    return (
      <AdminCard>
        <p className="text-text-tertiary text-sm">로딩 중...</p>
      </AdminCard>
    )
  }

  return (
    <AdminCard>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-text-primary text-sm font-semibold">
          🪙 Tier Config 매트릭스
        </h2>
        <p className="text-text-quaternary text-[11px]">
          tier_configs 7 컬럼 × Free/Lite/Standard. 변경 시 applyMode 강제 (Q3 C)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-text-quaternary text-[10px]">
              <th className="text-left py-2 px-3">컬럼</th>
              {tiers.map((t) => (
                <th key={t.tier} className="text-right py-2 px-3">
                  {t.tier}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COLUMNS.map((col) => (
              <tr key={col.key} className="border-b border-line">
                <td className="py-2 px-3 text-text-secondary">
                  {col.label}
                  {col.unit && (
                    <span className="text-text-quaternary text-[9px] ml-1">
                      ({col.unit})
                    </span>
                  )}
                </td>
                {tiers.map((t) => {
                  const raw = t[col.key]
                  const value =
                    typeof raw === 'string' ? parseFloat(raw) : (raw ?? 0)
                  return (
                    <td key={t.tier} className="py-2 px-3">
                      <input
                        type="number"
                        aria-label={`${t.tier} ${col.label}`}
                        defaultValue={value}
                        onBlur={(e) => {
                          // 🔴 빈칸 = **변경 없음** (2026-08-03). `Number('') === 0` 이라
                          // 값을 지우고 나가면 티어 한도가 **조용히 0 으로 저장**됐다.
                          // 비제어 입력이라 화면엔 빈칸만 남아 뭐가 저장됐는지도 안 보인다.
                          if (e.target.value === '') {
                            e.target.value = String(value)
                            return
                          }
                          const v = Number(e.target.value)
                          if (!Number.isFinite(v)) {
                            e.target.value = String(value)
                            return
                          }
                          if (v !== value) {
                            void handleChange(
                              t.tier,
                              col.key as keyof UpdateTierConfigDto,
                              v,
                              value,
                              col.label,
                            )
                          }
                        }}
                        className="w-24 bg-input border border-line text-text-primary placeholder:text-text-tertiary text-xs px-2 py-1 rounded-md text-right font-mono"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* active 토글 */}
            <tr className="border-b border-line">
              <td className="py-2 px-3 text-text-secondary">활성</td>
              {tiers.map((t) => (
                <td key={t.tier} className="py-2 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setPending({
                        tier: t.tier,
                        field: 'active',
                        newValue: !t.active,
                        before: t.active,
                        label: '활성',
                      })
                      void tierConfigAdminApi
                        .getPreview(t.tier)
                        .then((p) => setPreview(p))
                    }}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      t.active
                        ? 'bg-success/10 text-success border-success/30'
                        : 'bg-danger/10 text-danger border-danger/30'
                    }`}
                  >
                    {t.active ? '✓ 활성' : '🚧 비활성'}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {pending && (
        <MatrixConfirmModal
          title={`${pending.tier} tier 의 ${pending.label} 변경`}
          description={`${pending.before} → ${pending.newValue}`}
          affectedUsers={preview?.affectedUsers ?? 0}
          sample={preview?.sample}
          balanceDiff={
            pending.field === 'monthlyCoinLimit' &&
            typeof pending.newValue === 'number' &&
            typeof pending.before === 'number'
              ? pending.newValue - pending.before
              : undefined
          }
          onConfirm={handleConfirm}
          onClose={() => {
            setPending(null)
            setPreview(null)
          }}
        />
      )}
      {previewLoading && !preview && (
        <p className="text-text-quaternary text-[10px] mt-2">
          영향 미리보기 로딩...
        </p>
      )}
    </AdminCard>
  )
}
