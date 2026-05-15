import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { getAdminStats, getAdminAnalytics, type DayData, type GlobalStorage } from '@/api/admin'
import dayjs from 'dayjs'

const PERIODS = [
  { label: '7일', value: 7 },
  { label: '30일', value: 30 },
  { label: '90일', value: 90 },
]

export function OpsPage() {
  const [days, setDays] = useState(30)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
    refetchInterval: 60_000,
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => getAdminAnalytics(days),
    placeholderData: (prev) => prev,
  })

  const statCards = [
    { label: '전체 사용자', value: stats?.totalUsers ?? 0, color: 'text-brand' },
    { label: '이번 달 신규', value: stats?.newUsersMonth ?? 0, color: 'text-success' },
    { label: '이번 주 신규', value: stats?.newUsersWeek ?? 0, color: 'text-warning' },
    { label: '미답변 문의', value: stats?.pendingInquiries ?? 0, color: 'text-danger' },
  ]

  const kpiCards = [
    {
      label: '평균 첫 답변 시간',
      value: analytics?.avgReplyHours != null ? `${analytics.avgReplyHours}시간` : '—',
      sub: '문의 접수 ~ 첫 답변',
      color: 'text-brand',
    },
    {
      label: '유저당 평균 카드 수',
      value: analytics?.avgCardsPerUser != null ? `${analytics.avgCardsPerUser}개` : '—',
      sub: '지원 현황 보드 활용도',
      color: 'text-success',
    },
    {
      label: 'D7 리텐션',
      value: analytics?.d7Retention != null ? `${analytics.d7Retention}%` : '—',
      sub: analytics?.d7CohortSize
        ? `코호트 ${analytics.d7CohortSize.toLocaleString()}명`
        : '데이터 수집 중',
      color: analytics?.d7Retention != null && analytics.d7Retention >= 20
        ? 'text-success'
        : 'text-warning',
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">관리자</h1>
          <p className="text-sm text-text-tertiary mt-1">치뽀 운영 현황</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="text-xs text-text-tertiary hover:text-text-secondary bg-surface-2 border border-white/8 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← 치뽀로 돌아가기
          </Link>
          <span className="text-xs text-text-tertiary bg-surface-2 border border-white/5 px-3 py-1 rounded-full">admin</span>
        </div>
      </div>

      {/* 현황 스탯 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {statCards.map(({ label, value, color }) => (
          <div key={label} className="bg-surface-2 border border-white/5 rounded-xl p-4">
            <p className={`text-3xl font-bold tabular-nums ${color} ${statsLoading ? 'opacity-30' : ''}`}>
              {value.toLocaleString()}
            </p>
            <p className="text-xs text-text-tertiary mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* 파일 저장 (R2) — 전역 */}
      {stats?.globalStorage && (
        <GlobalStorageCard storage={stats.globalStorage} />
      )}

      {/* 바로가기 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <Link
          to="/ops/inquiries"
          className="flex items-center justify-between bg-surface-2 border border-white/5 rounded-xl px-5 py-4 hover:border-white/15 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold">문의 관리</p>
            <p className="text-xs text-text-tertiary mt-0.5">미답변 문의 {stats?.pendingInquiries ?? 0}건</p>
          </div>
          <span className="text-text-tertiary">›</span>
        </Link>
        <Link
          to="/ops/announcements"
          className="flex items-center justify-between bg-surface-2 border border-white/5 rounded-xl px-5 py-4 hover:border-white/15 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold">공지 관리</p>
            <p className="text-xs text-text-tertiary mt-0.5">배너·모달 공지 등록 및 관리</p>
          </div>
          <span className="text-text-tertiary">›</span>
        </Link>
        <Link
          to="/ops/users"
          className="flex items-center justify-between bg-surface-2 border border-white/5 rounded-xl px-5 py-4 hover:border-white/15 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold">회원 관리</p>
            <p className="text-xs text-text-tertiary mt-0.5">계정 정지·권한·닉네임 변경 및 감사 로그</p>
          </div>
          <span className="text-text-tertiary">›</span>
        </Link>
      </div>

      {/* ── 분석 대시보드 ── */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold">사용자 추이 분석</h2>
        <div className="flex gap-1">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                days === value
                  ? 'bg-brand/15 border border-brand/30 text-brand'
                  : 'bg-surface-2 border border-white/8 text-text-tertiary hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard
          title="일별 활성 사용자 (DAU)"
          data={analytics?.dau}
          color="#5e6ad2"
          loading={analyticsLoading}
          unit="명"
        />
        <ChartCard
          title="일별 신규 가입자"
          data={analytics?.signups}
          color="#10b981"
          loading={analyticsLoading}
          unit="명"
        />
        <ChartCard
          title="누적 가입자 수"
          data={analytics?.cumulative}
          color="#a78bfa"
          loading={analyticsLoading}
          unit="명"
        />
        <ChartCard
          title="일별 카드 생성 수"
          data={analytics?.cards}
          color="#fb923c"
          loading={analyticsLoading}
          unit="개"
        />
        <div className="lg:col-span-2">
          <ChartCard
            title="일별 문의 접수 수"
            data={analytics?.inquiries}
            color="#f87171"
            loading={analyticsLoading}
            unit="건"
          />
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {kpiCards.map(({ label, value, sub, color }) => (
          <div key={label} className="bg-surface-2 border border-white/5 rounded-xl p-5">
            <p className="text-xs text-text-tertiary mb-2">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-text-tertiary mt-1">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ChartCardProps {
  title: string
  data?: DayData[]
  color: string
  loading: boolean
  unit: string
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0B'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`
}

function GlobalStorageCard({ storage }: { storage: GlobalStorage }) {
  const limitBytes = storage.r2FreeLimitGB * 1024 * 1024 * 1024
  const percentage = limitBytes > 0 ? (storage.totalUsedBytes / limitBytes) * 100 : 0
  const overWarn = percentage >= 80

  return (
    <div className="bg-surface-2 border border-white/5 rounded-xl p-5 mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-tertiary font-semibold">파일 저장 (Cloudflare R2)</p>
        <span className="text-[11px] text-text-quaternary">
          {formatBytes(storage.totalUsedBytes)} / {storage.r2FreeLimitGB}GB 무료 한도
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Number(percentage.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`R2 사용량 ${percentage.toFixed(1)}%`}
        className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden mb-3"
      >
        <div
          className={`h-full transition-all ${overWarn ? 'bg-warning' : 'bg-brand'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-text-quaternary">평균 사용량 / 유저</p>
          <p className="text-text-secondary font-medium">{formatBytes(storage.averageBytes)}</p>
        </div>
        <div>
          <p className="text-text-quaternary">cap 임박 사용자</p>
          <p className={`font-medium ${storage.nearCapUserCount > 0 ? 'text-warning' : 'text-text-secondary'}`}>
            {storage.nearCapUserCount}명
          </p>
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, data, color, loading, unit }: ChartCardProps) {
  const fmt = (d: string) => dayjs(d).format('M/D')

  const tickCount = data ? Math.min(data.length, 7) : 7
  const tickInterval = data ? Math.max(1, Math.floor(data.length / tickCount)) : 1

  return (
    <div className="bg-surface-2 border border-white/5 rounded-xl p-5">
      <p className="text-sm font-semibold mb-4">{title}</p>
      {loading || !data ? (
        <div className="h-40 flex items-center justify-center text-text-tertiary text-xs">불러오는 중...</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tickFormatter={fmt}
              interval={tickInterval - 1}
              tick={{ fill: '#8a8f98', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#8a8f98', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#0f1011',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => dayjs(v as string).format('YYYY.MM.DD')}
              formatter={(v) => [`${Number(v).toLocaleString()}${unit}`, '']}
              cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
