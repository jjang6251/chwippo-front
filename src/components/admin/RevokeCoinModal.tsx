import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'

const REASONS = [
  { value: 'fraud', label: '부정 사용' },
  { value: 'mistake', label: '잘못 지급 회수' },
  { value: 'abuser', label: '어뷰저 처벌' },
  { value: 'manual', label: '기타 수동' },
] as const

type Reason = (typeof REASONS)[number]['value']

interface Props {
  userId: string
  nickname: string
  currentBalance: number
  onClose: () => void
}

export function RevokeCoinModal({
  userId,
  nickname,
  currentBalance,
  onClose,
}: Props) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState<string>('')
  const [reason, setReason] = useState<Reason>('mistake')
  const [memo, setMemo] = useState<string>('')

  const revoke = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/admin/users/${userId}/coins/revoke`, {
          amount: parseInt(amount, 10),
          reason,
          memo: memo.trim() || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-detail', userId] })
      onClose()
    },
  })

  const amountNum = parseInt(amount, 10)
  const valid = !isNaN(amountNum) && amountNum >= 1 && amountNum <= 100000

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-coin-title"
    >
      <div className="w-full max-w-sm bg-card border border-line rounded-xl p-6 space-y-4">
        <h2
          id="revoke-coin-title"
          className="text-text-primary text-base font-bold"
        >
          ⚖️ 코인 환수 — {nickname}
        </h2>

        <p className="text-text-quaternary text-xs">
          현재 잔여: <span className="font-mono">{currentBalance}</span> 코인
        </p>

        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs">사유</label>
          <div className="relative">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as Reason)}
              className="w-full appearance-none bg-card-strong border border-line text-text-primary text-sm px-3 pr-8 py-2 rounded-md"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-text-quaternary pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs">
            회수 코인 (clamp 0)
          </label>
          <input
            type="number"
            min={1}
            max={100000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-card-strong border border-line text-text-primary text-sm px-3 py-2 rounded-md"
            placeholder="예: 50"
          />
          {amountNum > currentBalance && currentBalance > 0 && (
            <p className="text-warning text-[10px]">
              ⚠️ 잔여보다 큼 — 실제 회수는 {currentBalance} 코인 (0 까지)
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs">메모 (선택)</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={500}
            className="w-full bg-card-strong border border-line text-text-primary text-sm px-3 py-2 rounded-md resize-none"
            rows={2}
          />
        </div>

        {revoke.isError && (
          <p className="text-danger text-xs">
            {(revoke.error as { message?: string })?.message ?? '오류가 발생했습니다.'}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => revoke.mutate()}
            disabled={!valid || revoke.isPending}
            className="flex-1 bg-danger hover:bg-danger/80 text-text-primary text-sm font-semibold py-2.5 rounded-md disabled:opacity-50"
          >
            {revoke.isPending ? '회수 중...' : '회수'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-card-strong hover:bg-surface-2 border border-line text-text-secondary text-sm font-medium py-2.5 rounded-md"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
