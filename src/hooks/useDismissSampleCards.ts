import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dismissAllSampleCards } from '@/api/users'
import { applicationsApi } from '@/api/applications'
import { useAuthStore } from '@/stores/authStore'

/** W1 — 샘플 카드 전체 숨기기 (멱등) */
export function useDismissAllSampleCards() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: dismissAllSampleCards,
    onSuccess: () => {
      if (user) {
        setUser({ ...user, sampleCardsDismissedAt: new Date().toISOString() })
      }
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}

/** W1 — 개별 sample 카드 숨김 */
export function useDismissSampleCard() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => applicationsApi.dismissSample(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}
