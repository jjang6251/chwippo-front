import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminCard } from '@/components/common/AdminCard'
import { MatrixConfirmModal } from '@/components/admin/MatrixConfirmModal'
import {
  featureModelAdminApi,
  type FeatureModelRow,
  type SelectableModel,
} from '@/api/featureModelAdmin'
import { featureLabel } from '@/utils/featureLabel'
import { toast } from '@/stores/toastStore'

/**
 * G-1 — feature 별 LLM 모델 전환.
 *
 * 이전에는 모델이 env 2개로만 정해져 **자소서와 면접이 같은 값을 공유**했고,
 * 바꾸려면 재배포가 필요해 롤백 경로가 없었다. 여기서 즉시 바꾸고 즉시 되돌린다.
 *
 * **원가 배수를 항상 보여주는 이유** — 코인 차감은 모델 단가에 따라 자동으로 따라가지만,
 * 관리자가 "이게 3배짜리" 라는 걸 **고르기 전에** 알아야 마진 판단을 할 수 있다.
 */
interface Pending {
  feature: string
  featureName: string
  before: { model: string; label: string; multiplier: number; inputUsd: number }
  after: SelectableModel
  requiresStreaming: boolean
}

export function FeatureModelMatrix() {
  const qc = useQueryClient()
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'feature-model'],
    queryFn: featureModelAdminApi.listAll,
  })
  const [pending, setPending] = useState<Pending | null>(null)

  const update = useMutation({
    mutationFn: ({ feature, model }: { feature: string; model: string }) =>
      featureModelAdminApi.update(feature, model),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'feature-model'] })
      toast.show('모델 변경 완료 — 다음 호출부터 적용')
      setPending(null)
    },
    // 서버 문구를 그대로 보여준다 (검증 사유가 여기 담긴다)
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      toast.show(msg ?? '변경 실패 — 다시 시도')
    },
  })

  if (isLoading) {
    return (
      <AdminCard>
        <div className="space-y-2">
          <div className="h-3 w-40 bg-surface-3 rounded animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-surface-3 rounded animate-pulse" />
          ))}
        </div>
      </AdminCard>
    )
  }

  if (isError) {
    return (
      <AdminCard>
        <p className="text-danger text-sm">
          모델 설정을 불러오지 못했어요. 새로고침 해주세요.
        </p>
      </AdminCard>
    )
  }

  return (
    <AdminCard>
      <div className="flex items-baseline gap-2 mb-1">
        <h2 className="text-text-primary text-sm font-semibold">
          🧠 기능별 AI 모델
        </h2>
        <p className="text-text-quaternary text-[11px]">
          즉시 적용 (다음 호출부터) · 코인 차감은 모델 단가에 자동 연동
        </p>
      </div>
      <p className="text-text-quaternary text-[10px] mb-3">
        단가는 입력 100만 토큰당 USD 입니다. 비싼 모델일수록 사용자 코인도 더
        빨리 소모됩니다.
      </p>

      {rows.length === 0 ? (
        // 시딩이 14행이라 정상적으론 안 생긴다. 마이그레이션 미적용 환경에서만 나오는데,
        // 그때 빈 테이블만 보이면 "고장" 인지 "설정 없음" 인지 구분이 안 된다.
        <p className="text-text-tertiary text-xs py-4">
          모델 설정이 없어요. 마이그레이션(feature_model_config)이 적용됐는지
          확인해주세요.
        </p>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-text-quaternary text-[10px]">
              <th className="text-left py-2 px-3">기능</th>
              <th className="text-left py-2 px-3">모델</th>
              <th className="text-right py-2 px-3">입력 단가</th>
              <th className="text-right py-2 px-3">출력 한도</th>
              <th className="text-left py-2 px-3">제약</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ModelRow
                key={row.feature}
                row={row}
                onPick={(after) =>
                  setPending({
                    feature: row.feature,
                    featureName: featureLabel(row.feature),
                    before: {
                      model: row.model,
                      label: row.label,
                      multiplier: row.costMultiplier,
                      inputUsd: row.inputUsd,
                    },
                    after,
                    requiresStreaming: row.requiresStreaming,
                  })
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      )}

      {pending && (
        <MatrixConfirmModal
          title={`${pending.featureName} 모델 변경`}
          description={buildConfirmText(pending)}
          impactLabel={`${pending.featureName} 을(를) 사용하는 모든 사용자`}
          showApplyMode={false}
          onConfirm={() =>
            update.mutate({
              feature: pending.feature,
              model: pending.after.id,
            })
          }
          onClose={() => setPending(null)}
        />
      )}
    </AdminCard>
  )
}

/** 확인 모달 본문 — 원가가 오르는 경우를 가장 먼저 말한다 */
function buildConfirmText(p: Pending): string {
  const ratio = p.after.costMultiplier / (p.before.multiplier || 1)
  const lines = [`${p.before.label} → ${p.after.label}`]

  const priceLine = `$${p.before.inputUsd.toFixed(2)} → $${p.after.inputUsd.toFixed(2)} / 1M 토큰`

  if (ratio > 1.05) {
    lines.push(
      `\n⚠️ 이 기능의 AI 요금이 약 ${ratio.toFixed(1)}배로 오릅니다.`,
      `${priceLine} · 사용자 코인 차감도 같은 비율로 늘어납니다.`,
    )
  } else if (ratio < 0.95) {
    lines.push(
      `\n이 기능의 AI 요금이 약 ${(1 / ratio).toFixed(1)}배 낮아집니다.`,
      priceLine,
    )
  }

  lines.push('\n즉시 적용 — 다음 LLM 호출부터 새 모델을 씁니다 (캐시 없음).')
  lines.push('되돌리려면 이전 모델을 다시 고르면 됩니다.')

  return lines.join('\n')
}

function ModelRow({
  row,
  onPick,
}: {
  row: FeatureModelRow
  onPick: (model: SelectableModel) => void
}) {
  const current = row.selectable.find((m) => m.id === row.model)
  /** 이 모델이 목록에 없으면 레지스트리 밖 값이 DB 에 남아 있다는 뜻 */
  const unregistered = !current

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

      <td className="py-2 px-3">
        <select
          value={row.model}
          // 행마다 select 가 하나씩이라 이름이 없으면 전부 "콤보 상자" 로만 읽힌다.
          // 테이블 헤더가 있어도 select 자체엔 접근 가능한 이름이 안 붙는다.
          aria-label={`${featureLabel(row.feature)} 모델 선택`}
          onChange={(e) => {
            const picked = row.selectable.find((m) => m.id === e.target.value)
            if (picked) onPick(picked)
          }}
          className="w-full min-w-[190px] appearance-none bg-input border border-line rounded-md pl-2.5 pr-7 py-1.5 text-xs text-text-primary bg-no-repeat bg-[right_0.5rem_center] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22none%22 stroke=%22%238a8f98%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22m3 4.5 3 3 3-3%22/%3E%3C/svg%3E')]"
        >
          {unregistered && (
            <option value={row.model}>{row.model} (미등록)</option>
          )}
          {row.selectable.map((m) => (
            // 못 고르는 모델도 목록에 남긴다 — 사유를 title 로 노출
            <option
              key={m.id}
              value={m.id}
              disabled={m.blockedReason !== null}
              title={m.blockedReason ?? undefined}
            >
              {m.label}
              {m.blockedReason ? ' — 선택 불가' : ''}
            </option>
          ))}
        </select>
      </td>

      <td className="py-2 px-3 text-right">
        <span
          className={`font-mono ${
            row.costMultiplier > 1 ? 'text-warning' : 'text-text-tertiary'
          }`}
        >
          ${row.inputUsd.toFixed(2)}
        </span>
        <span className="text-text-quaternary text-[9px] ml-1">/1M</span>
      </td>

      <td className="py-2 px-3 text-right text-text-tertiary font-mono">
        {row.maxOutputTokens.toLocaleString()}
      </td>

      <td className="py-2 px-3">
        {row.requiresStreaming ? (
          <span className="text-[10px] text-info bg-info/8 border border-info/20 px-1.5 py-0.5 rounded-full">
            실시간 응답 필요
          </span>
        ) : (
          <span className="text-text-quaternary text-[10px]">—</span>
        )}
      </td>
    </tr>
  )
}
