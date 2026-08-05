import { useQuery } from '@tanstack/react-query'
import { getAdminActivation, type ActivationCohort } from '@/api/admin'
import dayjs from 'dayjs'
import { formatShare } from '@/utils/shareFormat'

/**
 * A8 — Activation (아하 모먼트) 섹션. OpsPage 분석 대시보드 하단.
 *
 * 지표 정의 (product-market-review §4.3):
 * - Setup: 가입 KST 당일 첫 카드 ≥1 / Aha: 가입 3일 내 마감일 카드 ≥2
 * - AI 아하: 7일 내 AI 초안+편집 (AI hide 동안 0%) / D7·D30: window 재방문
 * 방문 기록(user_daily_visits)은 배포일부터 축적 — 초기 D7/D30은 과소 표시됨.
 */

export function ActivationSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'activation'],
    queryFn: getAdminActivation,
    staleTime: 5 * 60 * 1000,
  })

  const funnel = data?.funnel
  const funnelSteps = funnel
    ? [
        // 가입 행의 비율은 언제나 100% 라 계산값이 아니다 — '기준' 으로 적어 오해를 막는다
        { label: '가입', value: funnel.signup, rate: '기준' },
        { label: '당일 첫 카드', value: funnel.setup, rate: formatShare(funnel.setup, funnel.signup) },
        { label: '아하 (3일 내 마감카드 2개)', value: funnel.ahaBeta, rate: formatShare(funnel.ahaBeta, funnel.signup) },
        { label: 'D7 재방문', value: funnel.d7, rate: formatShare(funnel.d7, funnel.signup) },
      ]
    : []

  return (
    <section aria-labelledby="activation-heading" className="mt-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 id="activation-heading" className="text-base font-bold">Activation (아하 모먼트)</h2>
          <p className="text-xs text-text-tertiary mt-1">
            아하 지표 = 가입 3일 내 마감일 있는 카드 2개 · 방문 기록은 도입일부터 축적 (초기 D7/D30 과소 표시)
          </p>
        </div>
      </div>

      {isError ? (
        <div className="bg-surface-2 border border-line rounded-xl p-5 h-32 flex items-center justify-center text-danger text-xs">
          불러오지 못했어요 — 잠시 후 새로고침해주세요
        </div>
      ) : isLoading || !data ? (
        <div className="bg-surface-2 border border-line rounded-xl p-5 h-32 flex items-center justify-center text-text-tertiary text-xs">
          불러오는 중...
        </div>
      ) : data.cohorts.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-8 text-center">
          <p className="text-sm text-text-secondary">아직 코호트 데이터가 없어요</p>
          <p className="text-xs text-text-tertiary mt-1">최근 8주 내 가입자가 생기면 여기에 채워집니다</p>
        </div>
      ) : (
        <>
          {/* funnel */}
          <div className="bg-surface-2 border border-line rounded-xl p-5 mb-4">
            <p className="text-xs text-text-tertiary font-semibold mb-3">전환 funnel (최근 8주 합산)</p>
            <div className="space-y-2">
              {funnelSteps.map(({ label, value, rate }) => {
                const width = funnel && funnel.signup > 0 ? Math.max((value / funnel.signup) * 100, 2) : 0
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-text-tertiary w-44 shrink-0">{label}</span>
                    <div className="flex-1 h-5 bg-card rounded overflow-hidden">
                      <div className="h-full bg-brand/60 rounded" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-text-secondary w-20 text-right">
                      {value.toLocaleString()}명 · {rate}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 주차 코호트 표 */}
          <div className="bg-surface-2 border border-line rounded-xl p-5 mb-4 overflow-x-auto">
            <p className="text-xs text-text-tertiary font-semibold mb-3">주차별 가입 코호트</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-quaternary border-b border-line">
                  <th className="text-left py-2 font-medium">가입 주</th>
                  <th className="text-right py-2 font-medium">가입</th>
                  <th className="text-right py-2 font-medium">Setup</th>
                  <th className="text-right py-2 font-medium">아하</th>
                  <th className="text-right py-2 font-medium">AI 아하</th>
                  <th className="text-right py-2 font-medium">D7</th>
                  <th className="text-right py-2 font-medium">D30</th>
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((c: ActivationCohort) => (
                  <tr key={c.weekStart} className="border-b border-line/50 last:border-0">
                    <td className="py-2 text-text-secondary">{dayjs(c.weekStart).format('M/D')} 주</td>
                    <td className="py-2 text-right tabular-nums text-text-secondary">{c.cohortSize}</td>
                    <td className="py-2 text-right tabular-nums">{formatShare(c.setup, c.cohortSize, { compact: true })}</td>
                    <td className="py-2 text-right tabular-nums text-brand font-medium">{formatShare(c.ahaBeta, c.cohortSize, { compact: true })}</td>
                    <td className="py-2 text-right tabular-nums text-text-tertiary">{formatShare(c.ahaAi, c.cohortSize, { compact: true })}</td>
                    <td className="py-2 text-right tabular-nums">{formatShare(c.d7, c.cohortSize, { compact: true })}</td>
                    <td className="py-2 text-right tabular-nums">{formatShare(c.d30, c.cohortSize, { compact: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 브리핑 상관 */}
          <div className="bg-surface-2 border border-line rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs text-text-tertiary font-semibold">아침 브리핑 → 당일 행동 (최근 30일)</p>
              <span className="text-[10px] text-text-quaternary bg-card px-1.5 py-0.5 rounded">상관관계 · 인과 아님</span>
            </div>
            {data.briefing.receivedUserDays === 0 ? (
              <p className="text-xs text-text-tertiary">브리핑 발송 데이터가 아직 없어요</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-text-quaternary">브리핑 읽은 날</p>
                  <p className="text-xl font-bold tabular-nums text-success">
                    {formatShare(data.briefing.read.acted, data.briefing.read.total)}
                  </p>
                  <p className="text-[11px] text-text-quaternary">당일 카드·스텝 행동률</p>
                </div>
                <div>
                  <p className="text-[11px] text-text-quaternary">안 읽은 날</p>
                  <p className="text-xl font-bold tabular-nums text-text-secondary">
                    {formatShare(data.briefing.unread.acted, data.briefing.unread.total)}
                  </p>
                  <p className="text-[11px] text-text-quaternary">수신 {data.briefing.receivedUserDays.toLocaleString()} 유저-일</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
