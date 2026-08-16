import { useEffect, useState } from 'react'
import {
  useAlertThresholds,
  useSendTestAlert,
  useUpdateAlertThresholds,
} from '@/hooks/useAlertThresholds'
import { NumberInput } from '@/components/common/NumberInput'
import { SystemStatusPanel } from '@/components/admin/SystemStatusPanel'
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

const SENTRY_URL = import.meta.env.VITE_SENTRY_PROJECT_URL ?? ''

/**
 * F6 PR 2 Phase 5.6.3 — admin 모니터링 통합 (이전: AlertThresholds).
 * 섹션: 시스템 상태 + 임계치 알람 + 최근 알람 history (abuser_ban 통합) + Sentry link.
 * 페이지 너비는 AdminLayout 이 처리.
 */
export function Monitoring() {
  const { data, isLoading } = useAlertThresholds()
  const { mutate: update, isPending: updating } = useUpdateAlertThresholds()
  const { mutate: sendTest, isPending: testing } = useSendTestAlert()

  const [daily, setDaily] = useState(0)
  const [hourly, setHourly] = useState(0)
  const [vsYest, setVsYest] = useState(0)
  const [enabled, setEnabled] = useState(true)
  // PR_B2 Phase 2b — 신규 6 임계치 (Phase 1 admin grant 2 + Phase 2 신규 4)
  const [adminGrantHour, setAdminGrantHour] = useState(10000)
  const [adminGrantSingle, setAdminGrantSingle] = useState(10000)
  const [inquirySla, setInquirySla] = useState(24)
  const [abuserDaily, setAbuserDaily] = useState(100)
  const [signupSpike, setSignupSpike] = useState(200)
  const [costOutlier, setCostOutlier] = useState(2.0)
  // AI cost guard — per-user / per-feature daily USD cap
  const [perUserCost, setPerUserCost] = useState(0.5)
  const [perFeatureCost, setPerFeatureCost] = useState(5)
  // G-8 런타임 이상 — 둘 다 정상이면 0 이어야 하는 지표
  const [truncation, setTruncation] = useState(3)
  const [chargedFail, setChargedFail] = useState(1)

  useEffect(() => {
    if (data?.thresholds) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDaily(data.thresholds.dailyCostThresholdUsd)
      setHourly(data.thresholds.hourlyErrorRateThreshold * 100)
      setVsYest(data.thresholds.vsYesterdayIncreaseThreshold)
      setEnabled(data.thresholds.enabled)
      setAdminGrantHour(data.thresholds.adminGrantPerHourAlert)
      setAdminGrantSingle(data.thresholds.adminGrantSingleAlert)
      setInquirySla(data.thresholds.inquirySlaHours)
      setAbuserDaily(data.thresholds.abuserSuspectDailyCalls)
      setSignupSpike(data.thresholds.freeUserSignupSpikePct)
      setCostOutlier(data.thresholds.costOutlierStddev)
      setPerUserCost(data.thresholds.perUserDailyCostUsd)
      setPerFeatureCost(data.thresholds.perFeatureDailyCostUsd)
      setTruncation(data.thresholds.outputTruncationCount1h)
      setChargedFail(data.thresholds.chargedFailureCount1h)
    }
  }, [data?.thresholds])

  const dirty =
    !!data &&
    (daily !== data.thresholds.dailyCostThresholdUsd ||
      Math.abs(hourly / 100 - data.thresholds.hourlyErrorRateThreshold) > 0.001 ||
      vsYest !== data.thresholds.vsYesterdayIncreaseThreshold ||
      enabled !== data.thresholds.enabled ||
      adminGrantHour !== data.thresholds.adminGrantPerHourAlert ||
      adminGrantSingle !== data.thresholds.adminGrantSingleAlert ||
      inquirySla !== data.thresholds.inquirySlaHours ||
      abuserDaily !== data.thresholds.abuserSuspectDailyCalls ||
      signupSpike !== data.thresholds.freeUserSignupSpikePct ||
      Math.abs(costOutlier - data.thresholds.costOutlierStddev) > 0.01 ||
      Math.abs(perUserCost - data.thresholds.perUserDailyCostUsd) > 0.001 ||
      Math.abs(perFeatureCost - data.thresholds.perFeatureDailyCostUsd) > 0.001 ||
      truncation !== data.thresholds.outputTruncationCount1h ||
      chargedFail !== data.thresholds.chargedFailureCount1h)

  const save = () => {
    update(
      {
        dailyCostThresholdUsd: daily,
        hourlyErrorRateThreshold: hourly / 100,
        vsYesterdayIncreaseThreshold: vsYest,
        enabled,
        adminGrantPerHourAlert: adminGrantHour,
        adminGrantSingleAlert: adminGrantSingle,
        inquirySlaHours: inquirySla,
        abuserSuspectDailyCalls: abuserDaily,
        freeUserSignupSpikePct: signupSpike,
        costOutlierStddev: costOutlier,
        perUserDailyCostUsd: perUserCost,
        perFeatureDailyCostUsd: perFeatureCost,
        outputTruncationCount1h: truncation,
        chargedFailureCount1h: chargedFail,
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
    <div>
      <header className="mb-6 pb-4 border-b border-line">
        <h1 className="text-text-primary text-2xl font-bold">알람·임계치</h1>
        <p className="text-text-tertiary text-xs mt-1.5">
          시스템 상태 + 비용·에러 임계치 + 발송 history. Discord 통합 (10분 cron, 1시간 dedup).
        </p>
      </header>

      <SystemStatusPanel recentAlerts={data?.history ?? []} />

      <SentryLinkCard />

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
                htmlFor="th-daily"
                label="일 누적 비용 임계치 (USD)"
                hint="오늘 모든 LLM 호출 비용 합계가 이 값 이상이면 알람"
              >
                <NumberInput
                  id="th-daily"
                  name="th-daily"
                  autoComplete="off"
                  min={0}
                  max={10000}
                  step={1}
                  value={daily}
                  onValueChange={setDaily}
                  className="w-32 bg-card border border-line text-text-primary text-sm text-right px-3 py-1.5 rounded focus:outline-none focus:border-brand"
                />
                <span className="text-text-tertiary text-xs ml-2">USD</span>
              </ThresholdField>

              <ThresholdField
                htmlFor="th-hourly"
                label="시간당 error 비율 임계치 (%)"
                hint="최근 1시간 error 호출 비율이 이 값 이상이면 알람 (분모 0 safe)"
              >
                <NumberInput
                  id="th-hourly"
                  name="th-hourly"
                  autoComplete="off"
                  min={0}
                  max={100}
                  step={1}
                  value={hourly}
                  onValueChange={setHourly}
                  className="w-32 bg-card border border-line text-text-primary text-sm text-right px-3 py-1.5 rounded focus:outline-none focus:border-brand"
                />
                <span className="text-text-tertiary text-xs ml-2">%</span>
              </ThresholdField>

              <ThresholdField
                htmlFor="th-vsYest"
                label="전일 대비 비용 급증 임계치 (%)"
                hint="오늘 vs 어제 같은 시각 누적 비용 증가율이 이 값 이상이면 알람"
              >
                <NumberInput
                  id="th-vsYest"
                  name="th-vsYest"
                  autoComplete="off"
                  min={0}
                  max={10000}
                  step={10}
                  value={vsYest}
                  onValueChange={setVsYest}
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

              {/* PR_B2 Phase 2b — Phase 1 admin grant 2 + Phase 2 신규 4 임계치 */}
              <ThresholdField
                htmlFor="th-adminGrantHour"
                label="admin 시간당 grant 합계 (코인)"
                hint="admin 1명이 1시간 동안 지급한 코인 합계가 이 값 초과 시 Discord 알림 (S1)"
              >
                <NumberInput
                  id="th-adminGrantHour"
                  name="th-adminGrantHour"
                  autoComplete="off"
                  aria-label="admin 시간당 grant 합계 (코인)"
                  min={1}
                  max={1000000}
                  step={1000}
                  value={adminGrantHour}
                  onValueChange={setAdminGrantHour}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              <ThresholdField
                htmlFor="th-adminGrantSingle"
                label="admin 1회 grant 임계치 (코인)"
                hint="단일 grant 의 amount 가 이 값 초과 시 Discord 알림"
              >
                <NumberInput
                  id="th-adminGrantSingle"
                  name="th-adminGrantSingle"
                  autoComplete="off"
                  aria-label="admin 1회 grant 임계치 (코인)"
                  min={1}
                  max={1000000}
                  step={1000}
                  value={adminGrantSingle}
                  onValueChange={setAdminGrantSingle}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              <ThresholdField
                htmlFor="th-inquirySla"
                label="문의 SLA 시간"
                hint="문의 처리 SLA 기본값 (Phase 4 sla_deadline_at 의 기본). 초과 시 알림"
              >
                <NumberInput
                  id="th-inquirySla"
                  name="th-inquirySla"
                  autoComplete="off"
                  aria-label="문의 SLA 시간"
                  min={1}
                  max={720}
                  step={1}
                  value={inquirySla}
                  onValueChange={setInquirySla}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              <ThresholdField
                htmlFor="th-abuserDaily"
                label="abuser 의심 일 호출"
                hint="사용자 1명의 일 호출이 이 값 초과 시 abuser 의심 알림"
              >
                <NumberInput
                  id="th-abuserDaily"
                  name="th-abuserDaily"
                  autoComplete="off"
                  aria-label="abuser 의심 일 호출"
                  min={1}
                  max={10000}
                  step={10}
                  value={abuserDaily}
                  onValueChange={setAbuserDaily}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              <ThresholdField
                htmlFor="th-signupSpike"
                label="Free 가입 폭증 (%)"
                hint="전일 대비 Free 신규 가입 증가율 이 값 초과 시 알림 (abuse 폭증 감지)"
              >
                <NumberInput
                  id="th-signupSpike"
                  name="th-signupSpike"
                  autoComplete="off"
                  aria-label="Free 가입 폭증 (%)"
                  min={0}
                  max={10000}
                  step={10}
                  value={signupSpike}
                  onValueChange={setSignupSpike}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              <ThresholdField
                htmlFor="th-costOutlier"
                label="cost outlier σ"
                hint="feature 별 cost 평균 ±N σ 초과 시 outlier 알림 (보통 2.0)"
              >
                <NumberInput
                  id="th-costOutlier"
                  name="th-costOutlier"
                  autoComplete="off"
                  aria-label="cost outlier σ"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={costOutlier}
                  onValueChange={setCostOutlier}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              {/* AI cost guard — per-user / per-feature daily USD cap */}
              <ThresholdField
                htmlFor="th-perUserCost"
                label="사용자 일 cost cap ($)"
                hint="user 1명/day 의 모든 feature 합산 USD cap. 도달 시 LLM 호출 차단 (코인 외 hard guard)"
              >
                <NumberInput
                  id="th-perUserCost"
                  name="th-perUserCost"
                  autoComplete="off"
                  aria-label="사용자 일 cost cap"
                  min={0}
                  max={100}
                  step={0.1}
                  value={perUserCost}
                  onValueChange={setPerUserCost}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              <ThresholdField
                htmlFor="th-perFeatureCost"
                label="feature 일 cost cap ($)"
                hint="user 1명/feature/day USD cap. 단일 feature 폭주 방지. 0 = 무제한 (기능 차단은 AI 한도 탭의 enabled 로)"
              >
                <NumberInput
                  id="th-perFeatureCost"
                  name="th-perFeatureCost"
                  autoComplete="off"
                  aria-label="feature 일 cost cap"
                  min={0}
                  max={1000}
                  step={0.1}
                  value={perFeatureCost}
                  onValueChange={setPerFeatureCost}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              {/* G-8 런타임 이상 — 예방(QA)이 놓친 걸 배포 후에 잡는다 */}
              <ThresholdField
                htmlFor="th-truncation"
                label="출력 잘림 (1h)"
                hint="응답이 잘렸는데 성공으로 기록된 호출. 사용자는 잘린 결과를 받고 코인은 차감된다 — 정상이면 0"
              >
                <NumberInput
                  id="th-truncation"
                  name="th-truncation"
                  autoComplete="off"
                  aria-label="출력 잘림 (1h)"
                  min={1}
                  max={1000}
                  step={1}
                  value={truncation}
                  onValueChange={setTruncation}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>

              <ThresholdField
                htmlFor="th-chargedFail"
                label="차감 후 실패 (1h)"
                hint="코인은 나갔는데 실패한 호출. 돈만 잃는 실패라 1건도 즉시 알린다 — 정상이면 0"
              >
                <NumberInput
                  id="th-chargedFail"
                  name="th-chargedFail"
                  autoComplete="off"
                  aria-label="차감 후 실패 (1h)"
                  min={1}
                  max={1000}
                  step={1}
                  value={chargedFail}
                  onValueChange={setChargedFail}
                  className="bg-card border border-line rounded-md px-3 py-1.5 text-sm text-text-primary w-32"
                />
              </ThresholdField>
            </div>

            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-line">
              <button
                onClick={save}
                disabled={!dirty || updating}
                className="px-4 py-2 bg-brand hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-bg text-xs font-medium rounded-md"
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

/**
 * `htmlFor` 를 주면 라벨이 **클릭 가능**해진다 (Vercel WIG "Labels clickable").
 * 지금까지는 `<p>` 라서 라벨을 눌러도 아무 일이 없었고, 조작 가능한 영역이 128px 입력창뿐이었다.
 *
 * 🔴 **일부러 옵셔널로 뒀다** — kill switch 행은 `<button>` 을 감싸는데, `<button>` 도
 * labelable 이라 `htmlFor` 를 붙이면 **라벨 텍스트 클릭만으로 알람 전체가 꺼진다.**
 * 되돌리기 어려운 토글에 히트 영역을 넓히는 건 개선이 아니라 사고 경로다.
 */
function ThresholdField({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0">
        {htmlFor ? (
          // w-fit — 히트 영역을 라벨 글자에만 둔다 (행 전체가 아니라)
          <label
            htmlFor={htmlFor}
            className="text-text-primary text-xs font-medium block w-fit cursor-pointer"
          >
            {label}
          </label>
        ) : (
          <p className="text-text-primary text-xs font-medium">{label}</p>
        )}
        <p className="text-text-quaternary text-[10px] mt-0.5">{hint}</p>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  )
}

// 5.6.11 — SystemStatusPanel 은 components/admin/SystemStatusPanel.tsx 로 분리

/**
 * 5.6.3 — Sentry 외부 link 카드 (자체 에러 log 구현 X).
 *
 * ADR-055: 이 카드는 SDK 도입 전에도 "Sentry 가 추적합니다"라고 단정해 **관리자에게 거짓 상태를
 * 보여줬다**(2026-07-27 발견). 그래서 문구를 DSN 설정 여부에서 파생시킨다 — 켜지지 않았으면
 * 켜지지 않았다고 말한다.
 */
function SentryLinkCard() {
  const active = Boolean(import.meta.env.VITE_SENTRY_DSN)
  return (
    <section className="bg-surface-2 border border-line rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-text-primary text-sm font-semibold">에러 추적 (Sentry)</h2>
          <p className="text-text-tertiary text-xs mt-1">
            {active
              ? '서버·프론트 에러(5xx·렌더 크래시)를 Sentry 가 추적합니다. 자세한 분석은 외부 dashboard.'
              : 'Sentry 미연결 — 에러가 수집되지 않고 있습니다. VITE_SENTRY_DSN 을 설정하세요.'}
          </p>
        </div>
        {SENTRY_URL ? (
          <a
            href={SENTRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-1.5 bg-brand hover:bg-accent text-bg text-xs font-medium rounded-md"
          >
            Sentry 열기 ↗
          </a>
        ) : (
          <span className="shrink-0 text-text-quaternary text-[11px]">
            VITE_SENTRY_PROJECT_URL 미설정
          </span>
        )}
      </div>
    </section>
  )
}
