import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminCard } from '@/components/common/AdminCard'
import { companyResearchMetricsApi } from '@/api/companyResearchMetrics'

const FIELD_LABEL_KR: Record<string, string> = {
  mission: '미션',
  vision: '비전',
  products: '주요 제품/서비스',
  culture: '기업 문화',
  recent_news: '최근 뉴스',
  tech_stack: '기술 스택',
  competitors: '경쟁사',
  financials: '재무/투자',
  hiring: '채용 동향',
  reviews: '재직자 리뷰',
  media: '미디어/SNS',
}

/**
 * PR_B2 Phase 4 — 회사조사 admin metrics 페이지.
 *
 * 4 영역:
 * 1. Fill rate (11 항목 bar)
 * 2. Cost trend (line)
 * 3. Cache stats (active / expired / opt-out)
 * 4. Top 10 회사
 */
export function CompanyResearchMetrics() {
  const { data: fillRate } = useQuery({
    queryKey: ['admin', 'company-research', 'fill-rate'],
    queryFn: companyResearchMetricsApi.fillRate,
  })
  const { data: costTrend } = useQuery({
    queryKey: ['admin', 'company-research', 'cost-trend'],
    queryFn: () => companyResearchMetricsApi.costTrend(30),
  })
  const { data: cacheStats } = useQuery({
    queryKey: ['admin', 'company-research', 'cache-stats'],
    queryFn: companyResearchMetricsApi.cacheStats,
  })
  const { data: topCompanies } = useQuery({
    queryKey: ['admin', 'company-research', 'top-companies'],
    queryFn: () => companyResearchMetricsApi.topCompanies(10),
  })

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-text-primary text-xl font-bold">
          🏢 회사 조사 metrics
        </h1>
        <p className="text-text-quaternary text-xs mt-1">
          fill rate / cost trend / cache stats / Top 10 회사
        </p>
      </header>

      {/* Cache stats — 4 stat 카드 */}
      <AdminCard>
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          📦 Cache 통계
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="총 cache" value={cacheStats?.total ?? 0} />
          <Stat
            label="활성 (TTL 안)"
            value={cacheStats?.active ?? 0}
            tone="success"
          />
          <Stat
            label="만료"
            value={cacheStats?.expired ?? 0}
            tone="warning"
          />
          <Stat
            label="Opt-out"
            value={cacheStats?.optOut ?? 0}
            tone="danger"
          />
        </div>
      </AdminCard>

      {/* Fill rate */}
      <AdminCard>
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          📊 Fill rate (11 항목)
        </h2>
        {fillRate && fillRate.length > 0 && (
          <ul className="space-y-2">
            {fillRate.map((f) => (
              <li key={f.field} className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text-secondary">
                    {FIELD_LABEL_KR[f.field] ?? f.field}
                    <span className="text-text-quaternary text-[10px] ml-1 font-mono">
                      {f.field}
                    </span>
                  </span>
                  <span className="text-text-tertiary font-mono text-[11px]">
                    {f.filled}/{f.total} ({(f.rate * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-card-strong rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      f.rate >= 0.8
                        ? 'bg-success'
                        : f.rate >= 0.5
                          ? 'bg-warning'
                          : 'bg-danger'
                    }`}
                    style={{ width: `${f.rate * 100}%` }}
                    aria-hidden
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      {/* Cost trend */}
      <AdminCard>
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          💰 Cost trend (최근 30일)
        </h2>
        {costTrend && costTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={costTrend}>
              <CartesianGrid stroke="rgb(var(--line) / 0.5)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: 'rgb(var(--card))',
                  border: '1px solid rgb(var(--line))',
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="rgb(var(--brand))"
                fill="rgb(var(--brand) / 0.2)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-text-quaternary text-xs">
            최근 30일 호출 데이터 없음
          </p>
        )}
      </AdminCard>

      {/* Top 10 회사 */}
      <AdminCard>
        <h2 className="text-text-primary text-sm font-semibold mb-3">
          🏆 Top 10 회사 (조회 빈도)
        </h2>
        {topCompanies && topCompanies.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-text-quaternary text-[10px]">
                <th className="text-left py-1.5 px-2">#</th>
                <th className="text-left py-1.5 px-2">회사명</th>
                <th className="text-right py-1.5 px-2">조회 횟수</th>
                <th className="text-right py-1.5 px-2">cache 만료</th>
              </tr>
            </thead>
            <tbody>
              {topCompanies.map((c, i) => (
                <tr key={c.companyName} className="border-b border-line">
                  <td className="py-1.5 px-2 text-text-quaternary text-[10px]">
                    {i + 1}
                  </td>
                  <td className="py-1.5 px-2 text-text-primary font-medium">
                    {c.companyName}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-text-tertiary">
                    {c.hitCount}
                  </td>
                  <td className="py-1.5 px-2 text-right text-text-quaternary font-mono text-[10px]">
                    {new Date(c.expiresAt).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-text-quaternary text-xs">cache 데이터 없음</p>
        )}
      </AdminCard>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'success' | 'warning' | 'danger'
}) {
  const toneClass = tone
    ? tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-danger'
    : 'text-text-primary'
  return (
    <div className="bg-surface-2 border border-line rounded-lg px-4 py-3">
      <p className="text-text-quaternary text-[10px] uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${toneClass}`}>
        {value}
      </p>
    </div>
  )
}
