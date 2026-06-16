import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AlertHistoryRow } from '@/api/alertThresholds'
import type { ProviderHealth } from '@/api/systemStatus'
import { useSystemStatus } from '@/hooks/useSystemStatus'

const REFETCH_INTERVAL_MS = 30_000

interface Props {
  /** Monitoring 페이지의 alert_history (provider_down 등 row 검색용) */
  recentAlerts: AlertHistoryRow[]
}

/**
 * F6 PR 2 Phase 5.6.11 — 시스템 상태 패널 UX 강화.
 *
 * - 마지막 갱신 시각 (dataUpdatedAt) + N초 전
 * - 다음 자동 갱신 카운트다운
 * - "지금 새로고침" 수동 invalidate
 * - provider down 시 "N시간 전부터" (alert_history 의 가장 최근 'provider_down' row)
 */
export function SystemStatusPanel({ recentAlerts }: Props) {
  const { data, dataUpdatedAt } = useSystemStatus()
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const lastFetched = dataUpdatedAt ? new Date(dataUpdatedAt) : null
  const secondsAgo = lastFetched
    ? Math.max(0, Math.floor((now - lastFetched.getTime()) / 1000))
    : null
  const nextRefreshSec = lastFetched
    ? Math.max(
        0,
        Math.ceil(
          (lastFetched.getTime() + REFETCH_INTERVAL_MS - now) / 1000,
        ),
      )
    : null

  const handleManualRefresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'system-status'] })
  }

  return (
    <section className="bg-surface-2 border border-line rounded-xl p-5 mb-6">
      <header className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-text-primary text-sm font-semibold">시스템 상태</h2>
        <div className="flex items-center gap-3 text-[11px] text-text-quaternary">
          {lastFetched && (
            <span title={lastFetched.toLocaleString('ko-KR')}>
              ⏱ {secondsAgo}초 전 갱신
            </span>
          )}
          {nextRefreshSec !== null && nextRefreshSec > 0 && (
            <span>· 다음 {nextRefreshSec}초 후</span>
          )}
          <button
            onClick={handleManualRefresh}
            aria-label="시스템 상태 새로고침"
            className="text-text-tertiary hover:text-brand text-[11px] px-2 py-0.5 rounded border border-line hover:border-brand/40 transition-colors"
            title="지금 새로고침"
          >
            🔄 새로고침
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCell
          label="백엔드"
          status={data?.backend === 'up' ? 'up' : 'unknown'}
        />
        <StatusCell label="DB" status={data?.db === 'ok' ? 'up' : 'down'} />
        <ProviderCell
          label="OpenAI"
          provider={data?.openai}
          alerts={recentAlerts}
          providerName="openai"
        />
        <ProviderCell
          label="Anthropic"
          provider={data?.anthropic}
          alerts={recentAlerts}
          providerName="anthropic"
        />
      </div>
      <p className="text-text-quaternary text-[10px] mt-3">
        provider ping = 5분 cron (`/v1/models`). 외부 ping (GitHub Action) 은 별도 유지.
      </p>
    </section>
  )
}

function StatusCell({
  label,
  status,
}: {
  label: string
  status: 'up' | 'down' | 'unknown'
}) {
  const color =
    status === 'up'
      ? 'text-success bg-success/10 border-success/30'
      : status === 'down'
        ? 'text-danger bg-danger/10 border-danger/30'
        : 'text-text-quaternary bg-card border-line'
  return (
    <div className="bg-card border border-line rounded-md px-3 py-2">
      <p className="text-text-quaternary text-[10px] mb-1">{label}</p>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}
      >
        {status === 'up' ? 'up' : status === 'down' ? 'down' : '...'}
      </span>
    </div>
  )
}

function ProviderCell({
  label,
  provider,
  alerts,
  providerName,
}: {
  label: string
  provider: ProviderHealth | undefined
  alerts: AlertHistoryRow[]
  providerName: 'openai' | 'anthropic'
}) {
  if (!provider) {
    return <StatusCell label={label} status="unknown" />
  }

  // status 별 색·표시
  const isDegraded = provider.errorRateHint === 'degraded'
  const color =
    provider.status === 'up' && !isDegraded
      ? 'text-success bg-success/10 border-success/30'
      : provider.status === 'up' && isDegraded
        ? 'text-warning bg-warning/10 border-warning/30'
        : provider.status === 'down'
          ? 'text-danger bg-danger/10 border-danger/30'
          : 'text-text-quaternary bg-card border-line'

  // down 인 경우 — 가장 최근 'provider_down' alert 의 시각 (메시지에 provider name 포함)
  const downSince =
    provider.status === 'down'
      ? findLastProviderDownAt(alerts, providerName)
      : null

  const subText =
    provider.status === 'up'
      ? provider.lastPingedAt
        ? `${formatRelativeKo(provider.lastPingedAt)} · ${provider.latencyMs ?? 0}ms`
        : null
      : provider.status === 'down'
        ? downSince
          ? `${formatRelativeKo(downSince)}부터`
          : (provider.reason ?? null)
        : 'key 미설정'

  return (
    <div className="bg-card border border-line rounded-md px-3 py-2">
      <p className="text-text-quaternary text-[10px] mb-1">{label}</p>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}
        title={provider.reason ?? undefined}
      >
        {isDegraded ? 'degraded' : provider.status}
      </span>
      {subText && (
        <p className="text-text-quaternary text-[10px] mt-1 truncate" title={subText}>
          {subText}
        </p>
      )}
    </div>
  )
}

function findLastProviderDownAt(
  alerts: AlertHistoryRow[],
  providerName: 'openai' | 'anthropic',
): string | null {
  const row = alerts.find(
    (a) =>
      a.alertType === 'provider_down' &&
      a.message.toLowerCase().includes(providerName),
  )
  return row?.createdAt ?? null
}

function formatRelativeKo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (diffSec < 60) return `${diffSec}초 전`
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 ${min % 60}분 전`
  const day = Math.floor(hour / 24)
  return `${day}일 ${hour % 24}시간 전`
}
