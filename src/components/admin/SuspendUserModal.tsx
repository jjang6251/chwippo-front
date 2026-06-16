import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'

const QUICK_DURATIONS = [
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
  { label: '영구', days: null },
] as const

interface Props {
  userId: string
  nickname: string
  onClose: () => void
}

export function SuspendUserModal({ userId, nickname, onClose }: Props) {
  const qc = useQueryClient()
  const [reason, setReason] = useState<string>('')
  const [permanent, setPermanent] = useState(false)
  const [expiresAtLocal, setExpiresAtLocal] = useState<string>('')

  // PR_B2 — render 안 Date.now() impure 회피 (mount 시점 고정, 사용자 quick chip 활성화 비교만 사용)
  const [renderedNow] = useState(() => Date.now())

  const suspend = useMutation({
    mutationFn: () =>
      apiClient
        .patch(`/admin/users/${userId}/suspend`, {
          reason: reason.trim(),
          expiresAt: permanent
            ? null
            : expiresAtLocal
              ? new Date(expiresAtLocal).toISOString()
              : null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-detail', userId] })
      onClose()
    },
  })

  const valid = reason.trim().length >= 1 && reason.trim().length <= 500

  const setQuick = (days: number | null) => {
    if (days === null) {
      setPermanent(true)
      setExpiresAtLocal('')
    } else {
      setPermanent(false)
      const d = new Date(renderedNow + days * 86400000)
      // datetime-local 포맷 (YYYY-MM-DDTHH:mm)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      setExpiresAtLocal(`${yyyy}-${mm}-${dd}T${hh}:${mi}`)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspend-title"
    >
      <div className="w-full max-w-sm bg-card border border-line rounded-xl p-6 space-y-4">
        <h2
          id="suspend-title"
          className="text-text-primary text-base font-bold"
        >
          ⛔ 사용자 정지 — {nickname}
        </h2>

        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs">
            정지 사유 (필수, 1~500자)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="예: 약관 위반 — 도배 행위 반복 (2회)"
            className="w-full bg-card-strong border border-line text-text-primary text-sm px-3 py-2 rounded-md resize-none"
          />
          <p className="text-text-quaternary text-[10px] text-right">
            {reason.length}/500
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs">예상 해제일</label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_DURATIONS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setQuick(q.days)}
                className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                  (permanent && q.days === null) ||
                  (!permanent &&
                    q.days !== null &&
                    expiresAtLocal !== '' &&
                    Math.abs(
                      new Date(expiresAtLocal).getTime() -
                        (renderedNow + q.days * 86400000),
                    ) <
                      60 * 1000)
                    ? 'bg-brand/15 text-brand border-brand/30'
                    : 'bg-card-strong border-line text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={expiresAtLocal}
            onChange={(e) => {
              setPermanent(false)
              setExpiresAtLocal(e.target.value)
            }}
            disabled={permanent}
            className="w-full bg-card-strong border border-line text-text-primary text-xs px-3 py-2 rounded-md disabled:opacity-40"
          />
        </div>

        {suspend.isError && (
          <p className="text-danger text-xs">
            {(suspend.error as { message?: string })?.message ?? '오류'}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => suspend.mutate()}
            disabled={!valid || suspend.isPending}
            className="flex-1 bg-danger hover:bg-danger/80 text-text-primary text-sm font-semibold py-2.5 rounded-md disabled:opacity-50"
          >
            {suspend.isPending ? '정지 중...' : '정지'}
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
