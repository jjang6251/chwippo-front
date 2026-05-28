import { apiClient } from './client'

export type ProviderStatus = 'up' | 'down' | 'missing'

export interface ProviderHealth {
  status: ProviderStatus
  latencyMs: number | null
  reason: string | null
  lastPingedAt: string | null
  /** 5.6.10 — 최근 1h status='error' 비율 ≥ 5% 면 'degraded' */
  errorRateHint?: 'degraded'
}

export interface SystemStatus {
  backend: 'up'
  db: 'ok' | 'down'
  openai: ProviderHealth
  anthropic: ProviderHealth
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const systemStatusApi = {
  get: () =>
    apiClient
      .get<{ data: SystemStatus }>('/admin/system-status')
      .then(unwrap),
}
