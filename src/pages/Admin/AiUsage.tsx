import { useState } from 'react'
import {
  useAiUsageByHour,
  useAiUsageByModel,
  useAiUsageByUser,
  useAiUsageCacheHit,
  useAiUsageHallucination,
  useAiUsageMonthEstimate,
  useAiUsageOverview,
  useAiUsageUserDetail,
} from '@/hooks/useAiUsage'
import { formatKstDateTime } from '@/utils/datetime'

const STATUS_LABEL: Record<string, string> = {
  ok: '정상',
  error: '에러',
  blocked_quota: '쿼터 차단',
  blocked_moderation: '모더 차단',
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

export function AiUsage() {
  const [feature, setFeature] = useState('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const q = feature ? { feature } : {}
  const { data: overview } = useAiUsageOverview(q)
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
    <div className="max-w-[1100px] mx-auto px-9 py-9 pb-24 md:pb-9">
      <header className="mb-6">
        <h1 className="text-text-primary text-xl font-bold">AI 사용량</h1>
        <p className="text-text-tertiary text-xs mt-1">
          최근 30일 기본. 모든 LLM 호출 (성공·차단·에러) 이 audit 됩니다.
        </p>
      </header>

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
            <option value="note_summary">note_summary</option>
            <option value="coverletter">coverletter (legacy)</option>
            <option value="coverletter_draft_v2">coverletter_draft_v2</option>
            <option value="coverletter_feedback">coverletter_feedback</option>
            <option value="coverletter_recommend">coverletter_recommend</option>
            <option value="interview_prep_session">interview_prep_session</option>
            <option value="interview_prep_followup">interview_prep_followup</option>
            <option value="company_research">company_research</option>
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
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {overview?.byFeature.map((row) => (
                  <tr key={row.feature} className="border-t border-line">
                    <td className="py-2">{row.feature}</td>
                    <td className="py-2 text-right">
                      {row.calls.toLocaleString()}
                    </td>
                    <td className="py-2 text-right">{fmtUsd(row.costUsd)}</td>
                  </tr>
                ))}
                {(!overview || overview.byFeature.length === 0) && (
                  <tr>
                    <td
                      colSpan={3}
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
              상태별
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
                    <td className="py-2 font-mono text-[10px]">{r.model}</td>
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
            <h3 className="text-text-tertiary text-[11px] font-medium mb-3">
              PII Hallucination — feature 별 output_redacted 비율
            </h3>
            <ul className="space-y-3">
              {hallucination.map((h) => (
                <li key={h.feature} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-primary font-mono text-[11px]">
                      {h.feature}
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
            <h3 className="text-text-tertiary text-[11px] font-medium mb-3">
              Cache hit rate
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
                    <td className="px-3 py-2">{l.feature}</td>
                    <td className="px-3 py-2">{l.model}</td>
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
