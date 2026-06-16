import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'

const REASONS = [
  { value: 'refund', label: '환불' },
  { value: 'event', label: '이벤트' },
  { value: 'bonus', label: '보너스' },
  { value: 'abuser_compensation', label: '어뷰저 처리 보상' },
  { value: 'manual', label: '기타 수동' },
] as const

type Reason = (typeof REASONS)[number]['value']

interface Props {
  userId: string
  nickname: string
  onClose: () => void
}

export function GrantCoinModal({ userId, nickname, onClose }: Props) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState<string>('')
  const [reason, setReason] = useState<Reason>('refund')
  const [memo, setMemo] = useState<string>('')

  const grant = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/admin/users/${userId}/coins/grant`, {
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
      aria-labelledby="grant-coin-title"
    >
      <div className="w-full max-w-sm bg-card border border-line rounded-xl p-6 space-y-4">
        <h2
          id="grant-coin-title"
          className="text-text-primary text-base font-bold"
        >
          🪙 코인 지급 — {nickname}
        </h2>

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
            지급 코인 (1 ~ 100,000)
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
          {amountNum > 10000 && (
            <p className="text-warning text-[10px]">
              ⚠️ 10,000 이상 지급 시 Discord 알림이 발송돼요
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs">
            메모 (선택, 최대 500자)
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={500}
            className="w-full bg-card-strong border border-line text-text-primary text-sm px-3 py-2 rounded-md resize-none"
            rows={2}
          />
        </div>

        {grant.isError && (
          <p className="text-danger text-xs">
            {(grant.error as { message?: string })?.message ?? '오류가 발생했습니다.'}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => grant.mutate()}
            disabled={!valid || grant.isPending}
            className="flex-1 bg-brand hover:bg-accent text-text-primary text-sm font-semibold py-2.5 rounded-md disabled:opacity-50"
          >
            {grant.isPending ? '지급 중...' : '지급'}
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
