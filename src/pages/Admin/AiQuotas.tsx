import { useMemo, useState } from 'react'
import { AdminCard } from '@/components/common/AdminCard'
import { NumberInput } from '@/components/common/NumberInput'
import {
  useAiFeatureQuotas,
  useUpdateAiFeatureQuota,
} from '@/hooks/useAiFeatureQuotas'
import { useResetAiQuota } from '@/hooks/useQuotaReset'
import { toast } from '@/stores/toastStore'
import type {
  FeatureQuotaConfig,
  QuotaTier,
} from '@/types/aiQuota'
import { formatKstDateTime } from '@/utils/datetime'
import { featureCategory, featureLabel, FEATURE_CATEGORY_ORDER } from '@/utils/featureLabel'
import { TierConfigMatrix } from '@/components/admin/TierConfigMatrix'
import { FeatureCoinMetaMatrix } from '@/components/admin/FeatureCoinMetaMatrix'
import { FeatureModelMatrix } from '@/components/admin/FeatureModelMatrix'

// PR_B2 Phase 2b — feature 한국어 라벨 통일 (admin 전역 utils 사용)
const labelFor = (feature: string): string => featureLabel(feature)

const TIER_LABEL: Record<QuotaTier, string> = {
  free: '무료',
  lite: 'Lite',
  standard: 'Standard',
}

/**
 * F6 PR 2 Phase 5.2 — admin /ops/ai-quotas 매트릭스 편집.
 * memory `feedback_admin_quota_control` — 모든 LLM feature 의 한도·kill switch 는 admin UI 에서 동적.
 */
export function AiQuotas() {
  const [tier, setTier] = useState<QuotaTier>('free')
  const { data: rows = [], isLoading } = useAiFeatureQuotas()
  const { mutate: resetAll, isPending: resetting } = useResetAiQuota()

  const handleResetAll = () => {
    const ok = window.confirm(
      '⚠️ 전체 사용자의 AI 사용량 카운트가 0 으로 reset 됩니다.\n\n시스템 장애 보상 등 신중한 상황에만 사용하세요. 진행하시겠어요?',
    )
    if (!ok) return
    resetAll(
      {},
      {
        onSuccess: (r) =>
          toast.show(`전체 사용자 (${r.affected}명) 사용량을 reset 했어요.`),
        onError: () => toast.show('reset 실패. 잠시 후 다시 시도해주세요.'),
      },
    )
  }
  const tierRows = useMemo(
    () => rows.filter((r) => r.tier === tier),
    [rows, tier],
  )
  // 기능이 늘어 평면 목록으론 찾기 어려움 (2026-07-13 CEO) — 카테고리 섹션 그룹핑
  const groupedRows = useMemo(() => {
    const groups = new Map<string, typeof tierRows>()
    for (const row of tierRows) {
      const cat = featureCategory(row.feature)
      const list = groups.get(cat) ?? []
      list.push(row)
      groups.set(cat, list)
    }
    return FEATURE_CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({
      category: c,
      rows: groups.get(c)!,
    }))
  }, [tierRows])

  return (
    <div>
      <header className="mb-6 pb-4 border-b border-line flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-text-primary text-2xl font-bold">AI 한도 관리</h1>
          <p className="text-text-tertiary text-xs mt-1.5">
            모든 LLM 기능의 일·월 한도, 호출 간격, kill switch 를 동적으로 통제합니다.
            변경 즉시 적용 (캐시 없음).
          </p>
        </div>
        {/* 5.6.9 — 전체 사용자 사용량 reset */}
        <button
          onClick={handleResetAll}
          disabled={resetting}
          className="shrink-0 px-3 py-2 text-xs font-medium text-warning bg-warning/10 border border-warning/30 hover:bg-warning/20 rounded-md transition-colors disabled:opacity-40"
          title="시스템 장애 보상 등 신중한 상황에만 사용. 모든 사용자의 사용량 카운트 0 으로"
        >
          {resetting ? '⏳ reset 중...' : '🔄 전체 사용량 reset'}
        </button>
      </header>

      <div className="space-y-2 mb-4">
        <div className="flex gap-2">
          {(['free', 'lite', 'standard'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              disabled={t !== 'free'}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tier === t
                  ? 'bg-brand text-bg'
                  : 'bg-card text-text-secondary hover:bg-card-strong disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
              title={
                t !== 'free'
                  ? 'PR_B2 Phase 3 admin 매트릭스 도입 시 활성'
                  : undefined
              }
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="text-text-quaternary text-[10px]">
          Lite·Standard 탭은 PR_B2 Phase 3 (admin 매트릭스 수정 UI) 도입 시 활성화돼요.
        </p>
      </div>

      {isLoading ? (
        <AdminCard>
          <p className="text-text-tertiary text-sm">로딩 중...</p>
        </AdminCard>
      ) : tierRows.length === 0 ? (
        <AdminCard>
          <p className="text-text-tertiary text-sm">
            이 tier 의 feature 설정이 없어요.
          </p>
        </AdminCard>
      ) : (
        <div className="space-y-5">
          {groupedRows.map((group) => (
            <AdminCard
              key={group.category}
              title={`${group.category} (${group.rows.length})`}
              hint={
                group.category === '기타'
                  ? 'legacy / deprecated — kill switch 용도로만 유지'
                  : undefined
              }
              flush
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead className="bg-card">
                <tr>
                  <th className="text-left text-text-tertiary text-xs font-medium px-4 py-2.5">
                    기능
                  </th>
                  <th className="text-right text-text-tertiary text-xs font-medium px-3 py-2.5 w-24">
                    일 한도
                  </th>
                  <th className="text-right text-text-tertiary text-xs font-medium px-3 py-2.5 w-24">
                    월 한도
                  </th>
                  <th className="text-right text-text-tertiary text-xs font-medium px-3 py-2.5 w-28">
                    쿨다운(초)
                  </th>
                  <th
                    className="text-right text-text-tertiary text-xs font-medium px-3 py-2.5 w-28"
                    title="같은 리소스 (예: 노트 1개) 의 24h 한도. 현재 note_summary 만 사용"
                  >
                    노트별 한도 ⓘ
                  </th>
                  <th className="text-center text-text-tertiary text-xs font-medium px-3 py-2.5 w-20">
                    활성
                  </th>
                  <th className="text-left text-text-tertiary text-xs font-medium px-3 py-2.5 w-36">
                    마지막 수정
                  </th>
                  <th className="w-20 px-3 py-2.5"></th>
                </tr>
              </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <FeatureRow key={`${row.feature}-${row.tier}`} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* PR_B2 Phase 3 — Tier Config 매트릭스 */}
      <div className="mt-6">
        <TierConfigMatrix />
      </div>

      {/* PR_B2 Phase 3 — Feature Coin Meta 매트릭스 */}
      <div className="mt-4">
        <FeatureCoinMetaMatrix />
      </div>

      {/* G-1 — 기능별 AI 모델 전환 (코인 매트릭스 바로 아래: 원가·차감이 연동돼 함께 본다) */}
      <div className="mt-4">
        <FeatureModelMatrix />
      </div>
    </div>
  )
}

function FeatureRow({ row }: { row: FeatureQuotaConfig }) {
  const [dayLimit, setDayLimit] = useState(row.dayLimit)
  const [monthLimit, setMonthLimit] = useState(row.monthLimit)
  const [cooldown, setCooldown] = useState(row.cooldownSeconds)
  // 5.6.8 — null 도 valid (미사용). UI 표시: 빈 input.
  const [perResource, setPerResource] = useState<number | null>(
    row.perResourceDayLimit,
  )
  const [enabled, setEnabled] = useState(row.enabled)
  const { mutate, isPending } = useUpdateAiFeatureQuota()

  // note_summary 만 per-resource 의미 있음. 나머지는 input disabled
  const supportsPerResource = row.feature === 'note_summary'

  const dirty =
    dayLimit !== row.dayLimit ||
    monthLimit !== row.monthLimit ||
    cooldown !== row.cooldownSeconds ||
    perResource !== row.perResourceDayLimit ||
    enabled !== row.enabled

  const toggleEnabled = () => {
    if (enabled) {
      const confirmed = window.confirm(
        `🚧 정말 비활성화하시겠어요?\n\n"${labelFor(row.feature)}" (${row.tier}) 기능을 사용하는 모든 사용자의 호출이 즉시 차단됩니다.`,
      )
      if (!confirmed) return
    }
    setEnabled(!enabled)
  }

  const save = () => {
    mutate(
      {
        feature: row.feature,
        tier: row.tier,
        dto: {
          dayLimit,
          monthLimit,
          cooldownSeconds: cooldown,
          enabled,
          // 5.6.8 — note_summary 만 의미 있음. null/undefined 전환 보호
          ...(supportsPerResource && perResource !== null
            ? { perResourceDayLimit: perResource }
            : {}),
        },
      },
      {
        onSuccess: () =>
          toast.show(`${labelFor(row.feature)} 한도를 변경했어요.`),
        onError: () => toast.show('변경에 실패했어요. 잠시 후 다시 시도해주세요.'),
      },
    )
  }

  return (
    <tr className="border-t border-line hover:bg-card transition-colors">
      <td className="px-4 py-2 text-text-primary">
        <div>{labelFor(row.feature)}</div>
        <div className="text-text-quaternary text-[10px] font-mono">
          {row.feature}
        </div>
      </td>
      <td className="px-3 py-2">
        <NumberInput
          min={0}
          max={10000}
          value={dayLimit}
          onValueChange={setDayLimit}
          className="w-full bg-card border border-line text-text-primary text-xs text-right px-2 py-1 rounded focus:outline-none focus:border-brand"
        />
      </td>
      <td className="px-3 py-2">
        <NumberInput
          min={10}
          max={100000}
          value={monthLimit}
          onValueChange={setMonthLimit}
          className="w-full bg-card border border-line text-text-primary text-xs text-right px-2 py-1 rounded focus:outline-none focus:border-brand"
        />
      </td>
      <td className="px-3 py-2">
        <NumberInput
          min={0}
          max={3600}
          value={cooldown}
          onValueChange={setCooldown}
          className="w-full bg-card border border-line text-text-primary text-xs text-right px-2 py-1 rounded focus:outline-none focus:border-brand"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={1}
          max={100}
          value={perResource ?? ''}
          disabled={!supportsPerResource}
          onChange={(e) => {
            const v = e.target.value
            setPerResource(v === '' ? null : Math.max(1, Number(v)))
          }}
          placeholder={supportsPerResource ? '5' : '—'}
          title={
            supportsPerResource
              ? undefined
              : '현재 note_summary 만 이 한도 사용 (다른 feature 는 무시)'
          }
          className="w-full bg-card border border-line text-text-primary text-xs text-right px-2 py-1 rounded focus:outline-none focus:border-brand disabled:opacity-30 disabled:cursor-not-allowed"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={toggleEnabled}
          className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${
            enabled
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-danger/10 text-danger border border-danger/30'
          }`}
        >
          {enabled ? '✓ 활성' : '🚧 중단'}
        </button>
      </td>
      <td className="px-3 py-2 text-text-quaternary text-[11px]">
        {formatKstDateTime(row.updatedAt)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={save}
          disabled={!dirty || isPending}
          className="text-brand hover:text-accent text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isPending ? '저장 중' : '저장'}
        </button>
      </td>
    </tr>
  )
}
