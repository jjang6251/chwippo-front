import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  useAiUsageByHour,
  useAiUsageByModel,
  useAiUsageByUser,
  useAiUsageCacheHit,
  useAiUsageHallucination,
  useAiUsageMonthEstimate,
  useAiUsageOverview,
  useAiUsageFeatureMonth,
  useAiUsageUserDetail,
} from '@/hooks/useAiUsage'
import { useAiUsageMetricsPeriod } from '@/hooks/useAiUsageMetrics'
import { AI_USAGE_PERIODS, type AiUsagePeriod } from '@/api/aiUsageMetrics'
import { featureLabel, modelLabel } from '@/utils/featureLabel'
import { formatKstDateTime } from '@/utils/datetime'

type DatePreset = '1d' | '7d' | '30d'
const PRESETS: Array<{ key: DatePreset; label: string; days: number }> = [
  { key: '1d', label: '최근 24시간', days: 1 },
  { key: '7d', label: '최근 7일', days: 7 },
  { key: '30d', label: '최근 30일', days: 30 },
]

const STATUS_LABEL: Record<string, string> = {
  ok: '정상',
  error: '에러',
  blocked_quota: '쿼터 차단',
  blocked_moderation: '모더레이션 차단',
  blocked_consent: 'AI 동의 미수락',
  blocked_input_cap: '입력 길이 초과',
  retry_parsing: 'JSON 재시도',
}

const STATUS_HINT: Record<string, string> = {
  ok: '정상 호출. LLM 응답을 받아 사용자에게 반환됨.',
  error: 'LLM provider 에러 (API 장애·timeout·moderation API 실패 등). 5% 이상이면 provider 점검 필요.',
  blocked_quota: '사용자 일/월/cooldown 한도 초과로 호출 사전 차단. 많이 발생하면 abuse 의심 또는 한도 너무 박함.',
  blocked_moderation: 'OpenAI Moderations API 가 폭력·유해·sexual 콘텐츠 감지 → LLM 호출 X. PII 가 아니라 입력 콘텐츠 자체 문제.',
  blocked_consent: '사용자가 AI 별도 동의 (ai_consent_at) 안 함 또는 약관 version 불일치. PIPA 26조 준수용.',
  blocked_input_cap: '입력 토큰 추정 (chars/3) 이 feature 별 maxInputTokens 초과 → 비용 차단 사전 발동.',
  retry_parsing: 'callJson 의 JSON parse 실패로 1회 재시도. tokens=0/cost=0 으로 audit (이중 카운트 방지).',
}

const STATUS_COLOR: Record<string, string> = {
  ok: 'text-success bg-success/10 border-success/30',
  error: 'text-danger bg-danger/10 border-danger/30',
  blocked_quota: 'text-warning bg-warning/10 border-warning/30',
  blocked_moderation: 'text-warning bg-warning/10 border-warning/30',
}

function fmtUsd(value: number): string {
  return `$${value.toFixed(4)}`
}

/**
 * 🔴 값이 없으면 **0 이 아니라 「—」**. `?? 0` 은 「모른다」를 「0원이다」라는 거짓 주장으로
 * 바꾸는데, 이 표는 그 숫자로 기능을 끄고 켜는 자리다 (배포 창엔 필드 자체가 없다).
 */
function fmtUsdOrDash(value: number | null | undefined): string {
  return typeof value === 'number' ? fmtUsd(value) : '—'
}

export function AiUsage() {
  const [feature, setFeature] = useState('')
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const range = useMemo(() => {
    const days = PRESETS.find((p) => p.key === preset)?.days ?? 30
    const end = new Date()
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }
  }, [preset])
  const q = { ...range, ...(feature ? { feature } : {}) }

  const { data: overview } = useAiUsageOverview(q)
  /*
    이달 누적·예상은 **별도 엔드포인트**다 (기간 필터와 무관한 고정 창).
    🔴 실패해도 표 전체를 죽이지 않는다 — 그 두 열만 「—」가 되고 호출·비용은 그대로 읽힌다.
  */
  const { data: featureMonth } = useAiUsageFeatureMonth()
  const monthByFeature = new Map(
    (featureMonth?.rows ?? []).map((r) => [r.feature, r]),
  )
  const { data: byUser = [] } = useAiUsageByUser(q)
  const { data: userDetail = [] } = useAiUsageUserDetail(
    selectedUser ?? undefined,
    {},
  )
  // v2 메트릭
  const { data: byModel = [] } = useAiUsageByModel(q)
  const { data: byHour = [] } = useAiUsageByHour(q)
  const { data: hallucination = [] } = useAiUsageHallucination(q)
  const { data: cacheHit } = useAiUsageCacheHit()
  const { data: monthEst } = useAiUsageMonthEstimate()

  return (
    <div>
      <header className="mb-6 pb-4 border-b border-line flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-text-primary text-2xl font-bold">AI 사용량</h1>
          <p className="text-text-tertiary text-xs mt-1.5">
            모든 LLM 호출 (성공·차단·에러) audit. 외부 통계는 Sentry·Discord 알람과 함께 확인.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-line">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                preset === p.key
                  ? 'bg-brand text-bg'
                  : 'text-text-secondary hover:text-bg'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* PR_B2 Phase 2b — 신규 metrics 카드 (period 5 + 전기 대비 delta) */}
      <AiUsageMetricsSection />

      <div className="mb-4">
        <label className="block text-[11px] text-text-tertiary mb-1.5">
          기능 필터
        </label>
        <div className="relative max-w-xs">
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            className="appearance-none w-full bg-card border border-line text-text-primary text-sm rounded-md px-3 py-2 pr-8 focus:outline-none focus:border-brand"
          >
            <option value="">전체</option>
            <optgroup label="자소서">
              <option value="coverletter_draft_v2">자소서 AI 답변</option>
              <option value="coverletter_chat">자소서 채팅</option>
              <option value="coverletter_feedback">자소서 피드백</option>
              <option value="coverletter_recommend">자소서 추천</option>
              <option value="jobposting_parse">공고 요건 정리</option>
            </optgroup>
            <optgroup label="면접">
              <option value="interview_prep_session">면접 질문 생성</option>
              {/*
                🔴 v2 에서 질문·답변을 분리하며 생긴 feature 인데 **드롭다운에만 빠져 있었다**
                (2026-08-09 발견). `featureLabel.ts` 엔 등록돼 있어 목록에는 한글로 떴지만
                필터로 좁힐 수가 없었고, 하필 **호출 1위**(137건 · 질문 생성 67건보다 많다)다.
                질문 생성과 답변 생성이 각각 2코인이라 섞여 있으면 **어디에 돈이 나가는지 못 가린다.**
              */}
              <option value="interview_prep_answer">면접 예상 답변</option>
              <option value="interview_prep_followup">면접 꼬리질문</option>
            </optgroup>
            <optgroup label="회사 조사">
              <option value="company_research">회사 조사</option>
            </optgroup>
            <optgroup label="노트">
              <option value="note_summary">노트 요약</option>
            </optgroup>
            {/* legacy 6종 필터 옵션 제거 (2026-07-13) — 과거 이력 행은 라벨로 계속 표시됨 */}
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-quaternary"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <StatCard
          label="총 호출"
          value={overview ? overview.totalCalls.toLocaleString() : '-'}
        />
        <StatCard
          label="총 비용 (USD)"
          value={overview ? fmtUsd(overview.totalCostUsd) : '-'}
        />
        <StatCard
          label="사용자 수"
          value={byUser.length.toLocaleString()}
        />
        <StatCard
          label="기능 수"
          value={overview ? overview.byFeature.length.toLocaleString() : '-'}
        />
        <StatCard
          label="이번 달 예상 (USD)"
          value={monthEst ? fmtUsd(monthEst.estimatedMonthEndUsd) : '-'}
          sub={
            monthEst
              ? `${monthEst.daysElapsed}/${monthEst.daysInMonth}일 · 누적 ${fmtUsd(monthEst.cumulativeCostUsd)}`
              : undefined
          }
        />
      </section>

      {/* 5.6.4 — 메인 area chart (cost over time). OpenAI Platform Usage 톤 */}
      <section className="mb-8 bg-surface-2 border border-line rounded-xl p-5">
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          시간별 비용 추이 <span className="text-text-quaternary text-[10px] font-normal">(KST hour bucket)</span>
        </h2>
        {byHour.length === 0 ? (
          <p className="text-text-quaternary text-xs text-center py-12">
            데이터 없음
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={byHour.map((r) => ({
                  ...r,
                  hourLabel: formatKstDateTime(r.hour),
                }))}
                margin={{ top: 5, right: 8, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5e6ad2" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#5e6ad2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.15)" />
                <XAxis
                  dataKey="hourLabel"
                  tick={{ fill: '#8a8f98', fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5, 13)}
                />
                <YAxis
                  tick={{ fill: '#8a8f98', fontSize: 10 }}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#191a1b',
                    border: '1px solid rgba(127,127,127,0.2)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#f7f8f8',
                  }}
                  labelStyle={{ color: '#f7f8f8' }}
                  formatter={(value) => fmtUsd(Number(value))}
                />
                <Area
                  type="monotone"
                  dataKey="costUsd"
                  stroke="#5e6ad2"
                  fill="url(#costGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          기능별 / 상태별
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-surface-2 border border-line rounded-xl p-4">
            <h3 className="text-text-tertiary text-[11px] font-medium mb-3">
              기능별
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-quaternary text-[10px]">
                  <th className="text-left pb-2">기능</th>
                  <th className="text-right pb-2">호출</th>
                  <th className="text-right pb-2">비용</th>
                  {/* 「한 번이 얼마인가」 — 한도를 풀어 둔 기능은 이 값이 유일한 브레이크다 */}
                  <th className="text-right pb-2">호출당</th>
                  {/* 이달 누적 / 이달 예상 — 위가 지금, 아래가 이 속도로 갔을 때 */}
                  <th className="text-right pb-2">이달 · 예상</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {overview?.byFeature.map((row) => {
                  const month = monthByFeature.get(row.feature)
                  return (
                  <tr key={row.feature} className="border-t border-line">
                    <td className="py-2">
                      <span>{featureLabel(row.feature)}</span>
                      <span className="text-text-quaternary text-[10px] ml-1.5 font-mono">
                        {row.feature}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.calls.toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmtUsd(row.costUsd)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {fmtUsdOrDash(row.avgCostPerCall ?? month?.avgCostPerCall)}
                    </td>
                    <td className="py-2 text-right tabular-nums whitespace-nowrap">
                      {fmtUsdOrDash(month?.monthToDateCost)}
                      <span className="text-text-quaternary">
                        {' · '}
                        {fmtUsdOrDash(month?.monthProjectedCost)}
                      </span>
                    </td>
                  </tr>
                  )
                })}
                {(!overview || overview.byFeature.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 text-text-quaternary text-center"
                    >
                      데이터 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-surface-2 border border-line rounded-xl p-4">
            <h3
              className="text-text-tertiary text-[11px] font-medium mb-3 inline-flex items-center gap-1"
              title="LLM 호출 결과 분포. ok 가 90% 이상 = 정상. blocked_quota 많으면 한도/abuse 의심. error 5%+ 면 provider 장애 가능."
            >
              상태별 <span className="text-text-quaternary">ⓘ</span>
            </h3>
            <ul className="space-y-2">
              {overview?.byStatus.map((s) => (
                <li
                  key={s.status}
                  className="flex items-center justify-between"
                >
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      STATUS_COLOR[s.status] ??
                      'text-text-tertiary bg-card border-line'
                    }`}
                    title={STATUS_HINT[s.status] ?? ''}
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                  <span className="text-text-primary text-xs">
                    {s.count.toLocaleString()}
                  </span>
                </li>
              ))}
              {(!overview || overview.byStatus.length === 0) && (
                <li className="text-text-quaternary text-xs text-center py-3">
                  데이터 없음
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* F6 PR 2 Phase 5.3 — v2 메트릭 4 섹션 */}
      <section className="mb-8">
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          모델별 / 시간대별
        </h2>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div className="bg-surface-2 border border-line rounded-xl p-4">
            <h3 className="text-text-tertiary text-[11px] font-medium mb-3">
              provider × model (비용 desc)
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-quaternary text-[10px]">
                  <th className="text-left pb-2">provider</th>
                  <th className="text-left pb-2">model</th>
                  <th className="text-right pb-2">호출</th>
                  <th className="text-right pb-2">비용</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {byModel.map((r) => (
                  <tr
                    key={`${r.provider}-${r.model}`}
                    className="border-t border-line"
                  >
                    <td className="py-2">{r.provider}</td>
                    <td className="py-2 text-[11px]">
                      <span>{modelLabel(r.model)}</span>
                      <span className="text-text-quaternary text-[9px] ml-1.5 font-mono">
                        {r.model}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {r.calls.toLocaleString()}
                    </td>
                    <td className="py-2 text-right">{fmtUsd(r.costUsd)}</td>
                  </tr>
                ))}
                {byModel.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-text-quaternary text-center"
                    >
                      데이터 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-surface-2 border border-line rounded-xl p-4">
            <h3 className="text-text-tertiary text-[11px] font-medium mb-3">
              시간대별 (KST hour)
            </h3>
            {byHour.length === 0 ? (
              <p className="text-text-quaternary text-xs text-center py-6">
                데이터 없음
              </p>
            ) : (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {byHour.map((r) => (
                  <li
                    key={r.hour}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="font-mono text-text-tertiary w-32 shrink-0">
                      {formatKstDateTime(r.hour)}
                    </span>
                    <span className="text-text-primary w-12 text-right">
                      {r.calls}
                    </span>
                    <span className="flex-1 bg-card rounded h-1.5 overflow-hidden">
                      <span
                        className="block h-full bg-brand"
                        style={{
                          width: `${Math.min(100, (r.calls / Math.max(...byHour.map((b) => b.calls))) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="text-text-quaternary w-16 text-right">
                      {fmtUsd(r.costUsd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          PII Hallucination / Cache hit rate
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-surface-2 border border-line rounded-xl p-4">
            <h3
              className="text-text-tertiary text-[11px] font-medium mb-3 inline-flex items-center gap-1"
              title="AI 가 가짜 PII (전화번호·이메일 등) 를 생성한 비율. 우리 입력 스크럽 후에도 모델이 hallucinate. 0% 이상적, 1%+ 면 프롬프트 점검, 5%+ 면 모델 변경 검토."
            >
              PII Hallucination — feature 별 output_redacted 비율{' '}
              <span className="text-text-quaternary">ⓘ</span>
            </h3>
            <ul className="space-y-3">
              {hallucination.map((h) => (
                <li key={h.feature} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-primary text-[11px]">
                      {featureLabel(h.feature)}
                      <span className="text-text-quaternary text-[9px] ml-1 font-mono">
                        {h.feature}
                      </span>
                    </span>
                    <span
                      className={`text-[10px] ${h.ratio > 0.01 ? 'text-warning' : 'text-text-quaternary'}`}
                    >
                      {(h.ratio * 100).toFixed(2)}% ({h.redacted}/{h.total})
                    </span>
                  </div>
                  <div className="bg-card rounded h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${h.ratio > 0.01 ? 'bg-warning' : 'bg-success'}`}
                      style={{
                        width: `${Math.min(100, h.ratio * 100 * 20)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
              {hallucination.length === 0 && (
                <li className="text-text-quaternary text-xs text-center py-3">
                  데이터 없음
                </li>
              )}
            </ul>
          </div>
          <div className="bg-surface-2 border border-line rounded-xl p-4">
            <h3
              className="text-text-tertiary text-[11px] font-medium mb-3 inline-flex items-center gap-1"
              title="동일 입력 재호출 시 LLM 우회 + 캐시 응답 반환 비율. 노트 요약: SHA256 hash 매치. 회사 조사: 90일 TTL. 비율 높을수록 비용 절약."
            >
              Cache hit rate <span className="text-text-quaternary">ⓘ</span>
            </h3>
            {cacheHit ? (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-text-secondary">노트 요약</span>
                    <span className="text-text-primary">
                      {(cacheHit.noteSummary.ratio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-text-quaternary text-[10px]">
                    {cacheHit.noteSummary.withSummary.toLocaleString()} /{' '}
                    {cacheHit.noteSummary.totalLogs.toLocaleString()} 노트에
                    요약 캐시
                  </p>
                </div>
                <div className="border-t border-line pt-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-secondary">회사 조사</span>
                    <span className="text-text-primary">
                      평균 {cacheHit.companyResearch.avgHitsPerRow.toFixed(1)}{' '}
                      hit / row
                    </span>
                  </div>
                  <p className="text-text-quaternary text-[10px]">
                    {cacheHit.companyResearch.cacheRows.toLocaleString()} 회사
                    캐시 · 누적{' '}
                    {cacheHit.companyResearch.totalHits.toLocaleString()} hit
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-text-quaternary text-xs text-center py-3">
                로딩 중...
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          사용자별 (비용 desc)
        </h2>
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-card">
              <tr className="text-text-quaternary text-[10px]">
                <th className="text-left px-3 py-2">User ID</th>
                <th className="text-right px-3 py-2">호출</th>
                <th className="text-right px-3 py-2">prompt 토큰</th>
                <th className="text-right px-3 py-2">completion 토큰</th>
                <th className="text-right px-3 py-2">비용</th>
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {byUser.map((r) => (
                <tr
                  key={r.userId}
                  className="border-t border-line text-text-primary"
                >
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {r.userId.slice(0, 8)}...
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.totalCalls.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.totalPromptTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.totalCompletionTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmtUsd(r.totalCostUsd)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(r.userId)}
                      className="text-brand hover:text-accent text-[11px]"
                    >
                      보기
                    </button>
                  </td>
                </tr>
              ))}
              {byUser.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-text-quaternary text-center text-xs"
                  >
                    데이터 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedUser && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-text-primary text-sm font-semibold">
              사용자 호출 이력 — {selectedUser.slice(0, 8)}...
            </h2>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="text-text-tertiary hover:text-text-primary text-xs"
            >
              닫기
            </button>
          </div>
          <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-card">
                <tr className="text-text-quaternary text-[10px]">
                  <th className="text-left px-3 py-2">시각 (KST)</th>
                  <th className="text-left px-3 py-2">기능</th>
                  <th className="text-left px-3 py-2">모델</th>
                  <th className="text-left px-3 py-2">상태</th>
                  <th className="text-right px-3 py-2">토큰 (in/out)</th>
                  <th className="text-right px-3 py-2">비용</th>
                  <th className="text-right px-3 py-2">지연</th>
                </tr>
              </thead>
              <tbody>
                {userDetail.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-line text-text-primary"
                  >
                    <td className="px-3 py-2">{formatKstDateTime(l.createdAt)}</td>
                    <td className="px-3 py-2">{featureLabel(l.feature)}</td>
                    <td className="px-3 py-2">{modelLabel(l.model)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          STATUS_COLOR[l.status] ??
                          'text-text-tertiary bg-card border-line'
                        }`}
                      >
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {l.promptTokens}/{l.completionTokens}
                    </td>
                    <td className="px-3 py-2 text-right">
                      ${Number(l.costUsd).toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right">{l.latencyMs}ms</td>
                  </tr>
                ))}
                {userDetail.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-text-quaternary text-center text-xs"
                    >
                      데이터 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-4">
      <p className="text-text-tertiary text-[10px] mb-1">{label}</p>
      <p className="text-text-primary text-lg font-bold">{value}</p>
      {sub && (
        <p className="text-text-quaternary text-[10px] mt-0.5">{sub}</p>
      )}
    </div>
  )
}

/**
 * PR_B2 Phase 2b — 신규 metrics 카드 영역.
 *
 * period 5 (일/주/월/분기/년) + 4 stat (총 cost / 총 calls / cache hit rate / error rate)
 * + 전기 대비 delta 표시.
 */
export function AiUsageMetricsSection() {
  const [period, setPeriod] = useState<AiUsagePeriod>('day')
  const { data, isLoading, isFetching } = useAiUsageMetricsPeriod(period)
  const isEmpty = !isLoading && data?.totalCalls === 0

  return (
    <section
      className="mb-6 pb-6 border-b border-line"
      aria-label="AI 사용량 metrics"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-text-primary text-sm font-semibold flex items-center gap-1.5">
          📊 사용량 metrics (period · 전기 대비)
          {isFetching && !isLoading && (
            <span className="text-text-quaternary text-[10px]">갱신 중...</span>
          )}
        </h2>
        <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-line">
          {AI_USAGE_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                period === p.key
                  ? 'bg-brand text-bg shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-card-strong'
              }`}
              aria-pressed={period === p.key}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isEmpty && (
        <div className="bg-card-strong border border-line rounded-lg px-4 py-3 mb-3 flex items-center gap-2">
          <span aria-hidden="true">ℹ️</span>
          <p className="text-text-tertiary text-xs">
            해당 기간 ({AI_USAGE_PERIODS.find((p) => p.key === period)?.label}) 의
            AI 호출 데이터가 없어요. period 를 더 큰 단위로 바꿔보세요.
          </p>
        </div>
      )}
      {data && !isEmpty && data.from && data.to && (
        <p className="text-text-quaternary text-[10px] mb-2 font-mono">
          기간 {data.from.slice(0, 10)} ~ {data.to.slice(0, 10)} (KST)
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="총 cost"
          value={isLoading ? '...' : `$${(data?.totalCostUsd ?? 0).toFixed(4)}`}
          deltaPct={data?.delta?.costDeltaPct}
        />
        <MetricCard
          label="총 calls"
          value={isLoading ? '...' : `${data?.totalCalls ?? 0}`}
          deltaPct={data?.delta?.callsDeltaPct}
        />
        <MetricCard
          label="Cache hit rate"
          value={
            isLoading ? '...' : `${((data?.cacheHitRate ?? 0) * 100).toFixed(1)}%`
          }
        />
        <MetricCard
          label="Error rate"
          value={isLoading ? '...' : `${((data?.errorRate ?? 0) * 100).toFixed(1)}%`}
          tone={
            (data?.errorRate ?? 0) > 0.05 ? 'danger' : undefined
          }
        />
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  deltaPct,
  tone,
}: {
  label: string
  value: string
  deltaPct?: number
  tone?: 'danger'
}) {
  const isPositive = deltaPct !== undefined && deltaPct > 0
  const isNegative = deltaPct !== undefined && deltaPct < 0
  const deltaText =
    deltaPct !== undefined
      ? `${isPositive ? '+' : ''}${deltaPct.toFixed(1)}%`
      : null

  return (
    <div
      className={`bg-surface-2 border rounded-xl p-4 ${tone === 'danger' ? 'border-danger/40' : 'border-line'}`}
    >
      <p className="text-text-quaternary text-[10px] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-2xl font-bold ${tone === 'danger' ? 'text-danger' : 'text-text-primary'}`}
      >
        {value}
      </p>
      {deltaText !== null && (
        <p
          className={`text-[10px] mt-1 ${
            isPositive
              ? 'text-success'
              : isNegative
                ? 'text-danger'
                : 'text-text-quaternary'
          }`}
        >
          전기 대비 {deltaText}
        </p>
      )}
    </div>
  )
}
