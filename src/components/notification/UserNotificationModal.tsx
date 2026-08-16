import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'

/**
 * PR_B2 Phase 1 — Q24 사용자 통지 모달.
 *
 * admin 액션 (코인 grant / revoke / 매트릭스 immediate / tier 변경) 후 me 호출 시 1회 표시.
 * 확인 버튼 → POST /me/notifications/dismiss → coin-balance refetch.
 */
export interface PendingNotification {
  type:
    | 'coin_grant'
    | 'coin_revoke'
    | 'quota_override'
    | 'matrix_change'
    | 'tier_downgrade'
    | 'tier_upgrade'
  title: string
  body: string
  createdAt: string
}

const ICON: Record<PendingNotification['type'], string> = {
  coin_grant: '🪙',
  coin_revoke: '⚖️',
  quota_override: '🎚️',
  matrix_change: '📊',
  tier_downgrade: '⬇️',
  tier_upgrade: '⬆️',
}

interface Props {
  notification: PendingNotification
}

export function UserNotificationModal({ notification }: Props) {
  const qc = useQueryClient()
  const dismiss = useMutation({
    mutationFn: () =>
      apiClient.post('/me/notifications/dismiss').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'coin-balance'] })
    },
  })

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-notification-title"
    >
      <div className="w-full max-w-sm bg-card border border-line rounded-xl px-6 py-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">
            {ICON[notification.type]}
          </span>
          <h2
            id="user-notification-title"
            className="text-text-primary text-base font-bold"
          >
            {notification.title}
          </h2>
        </div>
        <p className="text-text-secondary text-sm whitespace-pre-line leading-relaxed">
          {notification.body}
        </p>
        <button
          type="button"
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          className="w-full bg-brand hover:bg-accent text-bg text-sm font-semibold px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          확인했어요
        </button>
      </div>
    </div>
  )
}
