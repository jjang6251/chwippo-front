import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { quotaResetApi } from '@/api/quotaReset'
import { toast } from '@/stores/toastStore'

/**
 * cost hardening B-4 — 유저 개별 AI 일 한도 카드 (UserDetailPage 활동·코인 탭).
 * fair_use 상향(베타 테스터·이벤트) / manual_admin 하향(CS·제재).
 * 자동 제재(auto_ban)는 여기서 만들 수 없고, 걸려 있으면 표시 + 해제만 가능.
 */

interface QuotaOverride {
  dailyCapOverride: number | null
  validUntil: string | null
  reason: 'auto_ban_3_consecutive_days' | 'manual_admin' | 'fair_use'
  updatedAt: string
}

interface OverrideResponse {
  override: QuotaOverride | null
  active: boolean
}

const REASON_LABEL: Record<QuotaOverride['reason'], string> = {
  auto_ban_3_consecutive_days: '자동 제재 (3일 연속 한도 도달)',
  manual_admin: '수동 조정 (CS·제재)',
  fair_use: 'Fair use 상향 (베타·이벤트)',
}

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data

export function AiQuotaOverrideCard({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const queryKey = ['admin', 'users', userId, 'ai-quota-override']

  const { data, isLoading } = useQuery<OverrideResponse>({
    queryKey,
    queryFn: () =>
      apiClient
        .get(`/admin/users/${userId}/ai-quota-override`)
        .then(unwrap<OverrideResponse>),
  })

  const [cap, setCap] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [reason, setReason] = useState<'fair_use' | 'manual_admin'>('fair_use')

  const setMutation = useMutation({
    mutationFn: () =>
      apiClient.put(`/admin/users/${userId}/ai-quota-override`, {
        dailyCapOverride: Number(cap),
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        reason,
      }),
    onSuccess: () => {
      toast.success('개별 한도를 설정했어요')
      void qc.invalidateQueries({ queryKey })
      setCap('')
      setValidUntil('')
    },
    onError: () => toast.error('설정에 실패했어요'),
  })

  const clearMutation = useMutation({
    mutationFn: () =>
      apiClient.delete(`/admin/users/${userId}/ai-quota-override`),
    onSuccess: () => {
      toast.success('개별 한도를 해제했어요 (통상 한도 복귀)')
      void qc.invalidateQueries({ queryKey })
    },
    onError: () => toast.error('해제에 실패했어요'),
  })

  // 사용량 리셋 — 한도 변경과 독립 (24h 카운터 되감기). 기존 endpoint 재사용
  const resetMutation = useMutation({
    mutationFn: () => quotaResetApi.reset({ userId }),
    onSuccess: () => {
      toast.success('이 유저의 오늘 AI 사용량을 리셋했어요')
      void qc.invalidateQueries({ queryKey: ['admin', 'users', userId] })
    },
    onError: () => toast.error('리셋에 실패했어요'),
  })

  const override = data?.override ?? null
  const capValid = cap !== '' && Number.isInteger(Number(cap)) && Number(cap) >= 0 && Number(cap) <= 1000

  return (
    <div className="bg-card border border-line rounded-xl p-5 space-y-3">
      <h3 className="text-text-primary text-sm font-semibold">AI 개별 한도 (feature 공통 일 한도 override)</h3>

      {isLoading ? (
        <p className="text-text-tertiary text-sm">불러오는 중...</p>
      ) : override ? (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                data?.active
                  ? 'text-warning bg-warning/8 border-warning/20'
                  : 'text-text-quaternary bg-surface-2 border-line'
              }`}
            >
              {data?.active ? '적용 중' : '만료됨'}
            </span>
            <span className="text-text-secondary">{REASON_LABEL[override.reason]}</span>
          </div>
          <p className="text-text-secondary">
            일 한도: <span className="font-semibold tabular-nums">{override.dailyCapOverride ?? '-'}회</span>
            {' · '}
            {override.validUntil
              ? `${new Date(override.validUntil).toLocaleString('ko-KR')} 까지`
              : '수동 해제까지 영구'}
          </p>
          <button
            onClick={() => {
              if (window.confirm('개별 한도를 해제하고 통상(tier) 한도로 복귀할까요?')) {
                clearMutation.mutate()
              }
            }}
            disabled={clearMutation.isPending}
            className="text-xs text-danger bg-danger/8 border border-danger/20 hover:bg-danger/15 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            해제 (통상 한도 복귀)
          </button>
        </div>
      ) : (
        <p className="text-text-tertiary text-sm">개별 한도 없음 — tier 통상 한도 적용 중</p>
      )}

      {/* 설정 폼 — auto_ban 이 걸려 있어도 덮어쓰기 가능 (수동 우선) */}
      <div className="pt-3 border-t border-line space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-xs text-text-tertiary">
            일 한도 (0~1000)
            <input
              type="number"
              min={0}
              max={1000}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder="예: 100"
              className="mt-1 w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-text-primary"
            />
          </label>
          <label className="text-xs text-text-tertiary">
            만료일 (비우면 영구)
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1 w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-text-primary"
            />
          </label>
          <label className="text-xs text-text-tertiary">
            사유
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as 'fair_use' | 'manual_admin')}
              className="mt-1 w-full h-9 bg-input border border-line rounded-lg px-3 pr-8 text-sm text-text-primary appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22none%22 stroke=%22%238a8f98%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22m3 4.5 3 3 3-3%22/%3E%3C/svg%3E')]"
            >
              <option value="fair_use">Fair use 상향</option>
              <option value="manual_admin">수동 조정</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMutation.mutate()}
            disabled={!capValid || setMutation.isPending}
            className="text-xs text-bg bg-brand hover:bg-accent px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            {override ? '덮어쓰기' : '설정'}
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  '이 유저의 오늘 AI 사용량(KST 자정 리셋)을 지금 리셋할까요? 한도는 그대로 유지됩니다.',
                )
              ) {
                resetMutation.mutate()
              }
            }}
            disabled={resetMutation.isPending}
            className="text-xs text-text-secondary bg-surface-2 border border-line hover:border-line-strong px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            오늘 사용량 리셋
          </button>
        </div>
        <p className="text-[11px] text-text-quaternary">
          상향(fair use)은 tier 한도보다 높게도 적용돼요 · 자동 제재는 항상 하향으로만 동작
        </p>
      </div>
    </div>
  )
}
