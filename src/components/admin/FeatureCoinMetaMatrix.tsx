import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminCard } from '@/components/common/AdminCard'
import { MatrixConfirmModal } from '@/components/admin/MatrixConfirmModal'
import {
  featureCoinMetaAdminApi,
  type FeatureCoinMeta,
  type UpdateFeatureCoinMetaDto,
} from '@/api/featureCoinMetaAdmin'
import { featureLabel } from '@/utils/featureLabel'
import { toast } from '@/stores/toastStore'

/**
 * PR_B2 Phase 3 — feature_coin_meta 매트릭스 inline edit.
 *
 * 즉시 적용 (호출 시점 lookup). confirm UI 강제 (showApplyMode=false — applyMode 선택 불필요).
 * feature 한국어 라벨 강제 (utils/featureLabel).
 */

interface Pending {
  feature: string
  field: keyof UpdateFeatureCoinMetaDto
  newValue: number | boolean | null
  before: number | boolean | null
}

export function FeatureCoinMetaMatrix() {
  const qc = useQueryClient()
  const { data: features = [], isLoading } = useQuery({
    queryKey: ['admin', 'feature-coin-meta'],
    queryFn: featureCoinMetaAdminApi.listAll,
  })
  const [pending, setPending] = useState<Pending | null>(null)

  const update = useMutation({
    mutationFn: ({
      feature,
      dto,
    }: {
      feature: string
      dto: UpdateFeatureCoinMetaDto
    }) => featureCoinMetaAdminApi.update(feature, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'feature-coin-meta'] })
      toast.show('feature_coin_meta 변경 완료')
      setPending(null)
    },
    onError: () => toast.show('변경 실패 — 다시 시도'),
  })

  const handleConfirm = () => {
    if (!pending) return
    update.mutate({
      feature: pending.feature,
      dto: { [pending.field]: pending.newValue } as UpdateFeatureCoinMetaDto,
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
          📊 Feature Coin Meta 매트릭스
        </h2>
        <p className="text-text-quaternary text-[11px]">
          chargesCoins / fixedCoinCost / avgCoinCost — 즉시 적용 (호출 시점)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-text-quaternary text-[10px]">
              <th className="text-left py-2 px-3">기능</th>
              <th className="text-center py-2 px-3">코인 차감</th>
              <th className="text-right py-2 px-3">고정 코인</th>
              <th className="text-right py-2 px-3">평균 코인</th>
              <th className="text-left py-2 px-3">설명</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <FeatureRow
                key={f.feature}
                row={f}
                onChange={(field, newValue, before) =>
                  setPending({
                    feature: f.feature,
                    field,
                    newValue,
                    before,
                  })
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {pending && (
        <MatrixConfirmModal
          title={`${featureLabel(pending.feature)} (${pending.feature}) 의 ${pending.field} 변경`}
          description={`${pending.before} → ${pending.newValue}\n\n즉시 적용 — 다음 LLM 호출부터 새 정책 사용 (cache 없음).`}
          affectedUsers={0}
          showApplyMode={false}
          onConfirm={handleConfirm}
          onClose={() => setPending(null)}
        />
      )}
    </AdminCard>
  )
}

function FeatureRow({
  row,
  onChange,
}: {
  row: FeatureCoinMeta
  onChange: (
    field: keyof UpdateFeatureCoinMetaDto,
    newValue: number | boolean | null,
    before: number | boolean | null,
  ) => void
}) {
  return (
    <tr className="border-b border-line">
      <td className="py-2 px-3 text-text-secondary">
        <div>
          <span>{featureLabel(row.feature)}</span>
          <span className="text-text-quaternary text-[9px] ml-1.5 font-mono">
            {row.feature}
          </span>
        </div>
      </td>
      <td className="py-2 px-3 text-center">
        <button
          type="button"
          onClick={() =>
            onChange('chargesCoins', !row.chargesCoins, row.chargesCoins)
          }
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            row.chargesCoins
              ? 'bg-warning/10 text-warning border-warning/30'
              : 'bg-success/10 text-success border-success/30'
          }`}
        >
          {row.chargesCoins ? '✓ 차감' : '🆓 무료'}
        </button>
      </td>
      <td className="py-2 px-3">
        <input
          type="number"
          aria-label={`${row.feature} 고정 코인`}
          defaultValue={row.fixedCoinCost ?? ''}
          onBlur={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value)
            if (v !== row.fixedCoinCost) {
              onChange('fixedCoinCost', v, row.fixedCoinCost)
            }
          }}
          placeholder="null"
          className="w-20 bg-card-strong border border-line text-text-primary text-xs px-2 py-1 rounded-md text-right font-mono"
        />
      </td>
      <td className="py-2 px-3">
        <input
          type="number"
          step={0.1}
          aria-label={`${row.feature} 평균 코인`}
          defaultValue={parseFloat(row.avgCoinCost)}
          onBlur={(e) => {
            const v = Number(e.target.value)
            const before = parseFloat(row.avgCoinCost)
            if (v !== before) {
              onChange('avgCoinCost', v, before)
            }
          }}
          className="w-20 bg-card-strong border border-line text-text-primary text-xs px-2 py-1 rounded-md text-right font-mono"
        />
      </td>
      <td className="py-2 px-3 text-text-quaternary text-[10px] truncate max-w-[200px]">
        {row.description ?? '-'}
      </td>
    </tr>
  )
}
