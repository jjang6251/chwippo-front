import { useMemo, useState } from 'react'
import {
  useAiFeatureQuotas,
  useUpdateAiFeatureQuota,
} from '@/hooks/useAiFeatureQuotas'
import { toast } from '@/stores/toastStore'
import type {
  FeatureQuotaConfig,
  LlmFeature,
  QuotaTier,
} from '@/types/aiQuota'
import { formatKstDateTime } from '@/utils/datetime'

const FEATURE_LABEL: Record<LlmFeature, string> = {
  note_summary: '노트 요약',
  coverletter: '자소서 (legacy)',
  coverletter_draft_v2: '자소서 AI 답변',
  coverletter_feedback: '자소서 피드백',
  coverletter_recommend: '자소서 추천',
  interview_prep_session: '면접 질문 생성',
  interview_prep_followup: '면접 꼬리질문',
  company_research: '회사 조사',
}

const TIER_LABEL: Record<QuotaTier, string> = {
  free: '무료',
  pro: 'Pro (F7)',
  enterprise: 'Enterprise (F7)',
}

/**
 * F6 PR 2 Phase 5.2 — admin /ops/ai-quotas 매트릭스 편집.
 * memory `feedback_admin_quota_control` — 모든 LLM feature 의 한도·kill switch 는 admin UI 에서 동적.
 */
export function AiQuotas() {
  const [tier, setTier] = useState<QuotaTier>('free')
  const { data: rows = [], isLoading } = useAiFeatureQuotas()
  const tierRows = useMemo(
    () => rows.filter((r) => r.tier === tier),
    [rows, tier],
  )

  return (
    <div className="max-w-[1100px] mx-auto px-9 py-9 pb-24 md:pb-9">
      <header className="mb-6">
        <h1 className="text-text-primary text-xl font-bold">AI 한도 관리</h1>
        <p className="text-text-tertiary text-xs mt-1">
          모든 LLM 기능의 일·월 한도, 호출 간격, kill switch 를 동적으로 통제합니다.
          변경 즉시 적용 (캐시 없음).
        </p>
      </header>

      <div className="flex gap-2 mb-4">
        {(['free', 'pro', 'enterprise'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            disabled={t !== 'free'}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tier === t
                ? 'bg-brand text-white'
                : 'bg-card text-text-secondary hover:bg-card-strong disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title={t !== 'free' ? 'F7 결제 인프라 도입 후 활성화' : undefined}
          >
            {TIER_LABEL[t]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-text-tertiary text-sm">로딩 중...</div>
      ) : tierRows.length === 0 ? (
        <div className="text-text-tertiary text-sm">
          이 tier 의 feature 설정이 없어요.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-line rounded-lg overflow-hidden">
            <thead className="bg-card">
              <tr>
                <th className="text-left text-text-tertiary text-xs font-medium px-3 py-2">
                  기능
                </th>
                <th className="text-right text-text-tertiary text-xs font-medium px-3 py-2 w-24">
                  일 한도
                </th>
                <th className="text-right text-text-tertiary text-xs font-medium px-3 py-2 w-24">
                  월 한도
                </th>
                <th className="text-right text-text-tertiary text-xs font-medium px-3 py-2 w-28">
                  쿨다운(초)
                </th>
                <th className="text-center text-text-tertiary text-xs font-medium px-3 py-2 w-20">
                  활성
                </th>
                <th className="text-left text-text-tertiary text-xs font-medium px-3 py-2 w-36">
                  마지막 수정
                </th>
                <th className="w-20 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tierRows.map((row) => (
                <FeatureRow key={`${row.feature}-${row.tier}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FeatureRow({ row }: { row: FeatureQuotaConfig }) {
  const [dayLimit, setDayLimit] = useState(row.dayLimit)
  const [monthLimit, setMonthLimit] = useState(row.monthLimit)
  const [cooldown, setCooldown] = useState(row.cooldownSeconds)
  const [enabled, setEnabled] = useState(row.enabled)
  const { mutate, isPending } = useUpdateAiFeatureQuota()

  const dirty =
    dayLimit !== row.dayLimit ||
    monthLimit !== row.monthLimit ||
    cooldown !== row.cooldownSeconds ||
    enabled !== row.enabled

  const toggleEnabled = () => {
    if (enabled) {
      const confirmed = window.confirm(
        `🚧 정말 비활성화하시겠어요?\n\n"${FEATURE_LABEL[row.feature]}" (${row.tier}) 기능을 사용하는 모든 사용자의 호출이 즉시 차단됩니다.`,
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
        dto: { dayLimit, monthLimit, cooldownSeconds: cooldown, enabled },
      },
      {
        onSuccess: () =>
          toast.show(`${FEATURE_LABEL[row.feature]} 한도를 변경했어요.`),
        onError: () => toast.show('변경에 실패했어요. 잠시 후 다시 시도해주세요.'),
      },
    )
  }

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2 text-text-primary">
        <div>{FEATURE_LABEL[row.feature]}</div>
        <div className="text-text-quaternary text-[10px] font-mono">
          {row.feature}
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          max={10000}
          value={dayLimit}
          onChange={(e) => setDayLimit(Math.max(0, Number(e.target.value)))}
          className="w-full bg-card border border-line text-text-primary text-xs text-right px-2 py-1 rounded focus:outline-none focus:border-brand"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={10}
          max={100000}
          value={monthLimit}
          onChange={(e) => setMonthLimit(Math.max(10, Number(e.target.value)))}
          className="w-full bg-card border border-line text-text-primary text-xs text-right px-2 py-1 rounded focus:outline-none focus:border-brand"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          max={3600}
          value={cooldown}
          onChange={(e) => setCooldown(Math.max(0, Number(e.target.value)))}
          className="w-full bg-card border border-line text-text-primary text-xs text-right px-2 py-1 rounded focus:outline-none focus:border-brand"
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
