import { useEffect, useState } from 'react'
import {
  useAlertThresholds,
  useSendTestAlert,
  useUpdateAlertThresholds,
} from '@/hooks/useAlertThresholds'
import { toast } from '@/stores/toastStore'
import { formatKstDateTime } from '@/utils/datetime'

const STATUS_COLOR: Record<string, string> = {
  sent: 'text-success bg-success/10 border-success/30',
  failed: 'text-danger bg-danger/10 border-danger/30',
  skipped_dedup: 'text-text-quaternary bg-card border-line',
  skipped_no_webhook: 'text-warning bg-warning/10 border-warning/30',
}

const TYPE_LABEL: Record<string, string> = {
  daily_cost: '일 누적 비용',
  hourly_error_rate: '시간당 error 비율',
  vs_yesterday: '전일 대비 급증',
  abuser_ban: 'Abuser 자동 ban',
  test: '테스트',
}

/**
 * F6 PR 2 Phase 5.4 — Discord 임계치 알람 admin UI.
 * 임계치 4종 (daily_cost / hourly_error_rate / vs_yesterday / enabled) +
 * 최근 24h 알람 history + 테스트 알람 발송.
 */
export function AlertThresholds() {
  const { data, isLoading } = useAlertThresholds()
  const { mutate: update, isPending: updating } = useUpdateAlertThresholds()
  const { mutate: sendTest, isPending: testing } = useSendTestAlert()

  const [daily, setDaily] = useState(0)
  const [hourly, setHourly] = useState(0)
  const [vsYest, setVsYest] = useState(0)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (data?.thresholds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDaily(data.thresholds.dailyCostThresholdUsd)
      setHourly(data.thresholds.hourlyErrorRateThreshold * 100)
      setVsYest(data.thresholds.vsYesterdayIncreaseThreshold)
      setEnabled(data.thresholds.enabled)
    }
  }, [data?.thresholds])

  const dirty =
    !!data &&
    (daily !== data.thresholds.dailyCostThresholdUsd ||
      Math.abs(hourly / 100 - data.thresholds.hourlyErrorRateThreshold) > 0.001 ||
      vsYest !== data.thresholds.vsYesterdayIncreaseThreshold ||
      enabled !== data.thresholds.enabled)

  const save = () => {
    update(
      {
        dailyCostThresholdUsd: daily,
        hourlyErrorRateThreshold: hourly / 100,
        vsYesterdayIncreaseThreshold: vsYest,
        enabled,
      },
      {
        onSuccess: () => toast.show('임계치를 변경했어요.'),
        onError: () => toast.show('변경 실패 — 잠시 후 다시 시도해주세요.'),
      },
    )
  }

  const handleTest = () => {
    sendTest(undefined, {
      onSuccess: (r) => toast.show(`테스트 알람: ${r.status}`),
      onError: () => toast.show('테스트 알람 실패'),
    })
  }

  return (
    <div className="max-w-[1100px] mx-auto px-9 py-9 pb-24 md:pb-9">
      <header className="mb-6">
        <h1 className="text-text-primary text-xl font-bold">임계치 알람</h1>
        <p className="text-text-tertiary text-xs mt-1">
          비용·에러 급증을 Discord 로 자동 알림 (10분 주기, 1시간 dedup).
          enabled=false 면 cron 전체 skip (kill switch).
        </p>
      </header>

      {isLoading || !data ? (
        <p className="text-text-tertiary text-sm">로딩 중...</p>
      ) : (
        <>
          <section className="bg-surface-2 border border-line rounded-xl p-5 mb-6">
            <h2 className="text-text-primary text-sm font-semibold mb-4">
              임계치 설정
            </h2>
            <div className="space-y-4">
              <ThresholdField
                label="일 누적 비용 임계치 (USD)"
                hint="오늘 모든 LLM 호출 비용 합계가 이 값 이상이면 알람"
              >
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  value={daily}
                  onChange={(e) => setDaily(Number(e.target.value))}
                  className="w-32 bg-card border border-line text-text-primary text-sm text-right px-3 py-1.5 rounded focus:outline-none focus:border-brand"
                />
                <span className="text-text-tertiary text-xs ml-2">USD</span>
              </ThresholdField>

              <ThresholdField
                label="시간당 error 비율 임계치 (%)"
                hint="최근 1시간 error 호출 비율이 이 값 이상이면 알람 (분모 0 safe)"
              >
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={hourly}
                  onChange={(e) => setHourly(Number(e.target.value))}
                  className="w-32 bg-card border border-line text-text-primary text-sm text-right px-3 py-1.5 rounded focus:outline-none focus:border-brand"
                />
                <span className="text-text-tertiary text-xs ml-2">%</span>
              </ThresholdField>

              <ThresholdField
                label="전일 대비 비용 급증 임계치 (%)"
                hint="오늘 vs 어제 같은 시각 누적 비용 증가율이 이 값 이상이면 알람"
              >
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={10}
                  value={vsYest}
                  onChange={(e) => setVsYest(Number(e.target.value))}
                  className="w-32 bg-card border border-line text-text-primary text-sm text-right px-3 py-1.5 rounded focus:outline-none focus:border-brand"
                />
                <span className="text-text-tertiary text-xs ml-2">%</span>
              </ThresholdField>

              <ThresholdField
                label="알람 전체 활성"
                hint="false 면 cron 자체 skip (kill switch). 임계치 초과해도 알람 안 감"
              >
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    enabled
                      ? 'bg-success/10 text-success border border-success/30'
                      : 'bg-danger/10 text-danger border border-danger/30'
                  }`}
                >
                  {enabled ? '✓ 활성' : '🚧 비활성'}
                </button>
              </ThresholdField>
            </div>

            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-line">
              <button
                onClick={save}
                disabled={!dirty || updating}
                className="px-4 py-2 bg-brand hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md"
              >
                {updating ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 bg-card hover:bg-card-strong text-text-secondary text-xs font-medium rounded-md disabled:opacity-40"
              >
                {testing ? '발송 중...' : '🧪 테스트 알람 보내기'}
              </button>
              <p className="text-text-quaternary text-[11px] ml-auto">
                마지막 수정 {formatKstDateTime(data.thresholds.updatedAt)}
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-text-primary text-sm font-semibold mb-3">
              최근 24h 알람 history
            </h2>
            <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-quaternary text-[10px] bg-card">
                    <th className="text-left px-3 py-2">발생 시각</th>
                    <th className="text-left px-3 py-2">종류</th>
                    <th className="text-right px-3 py-2">측정값</th>
                    <th className="text-right px-3 py-2">임계치</th>
                    <th className="text-center px-3 py-2 w-32">webhook</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.id} className="border-t border-line">
                      <td className="px-3 py-2 text-text-tertiary font-mono">
                        {formatKstDateTime(h.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-text-primary">
                        {TYPE_LABEL[h.alertType] ?? h.alertType}
                      </td>
                      <td className="px-3 py-2 text-right text-text-primary font-mono">
                        {h.triggeredValue.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-text-quaternary font-mono">
                        {h.thresholdValue.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            STATUS_COLOR[h.webhookStatus] ??
                            'text-text-tertiary bg-card border-line'
                          }`}
                        >
                          {h.webhookStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.history.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-text-quaternary"
                      >
                        최근 24h 알람 없음
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function ThresholdField({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-xs font-medium">{label}</p>
        <p className="text-text-quaternary text-[10px] mt-0.5">{hint}</p>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  )
}
