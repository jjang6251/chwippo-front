import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quotaResetApi, type ResetAiQuotaDto } from '@/api/quotaReset'

/**
 * F6 PR 2 Phase 5.6.9 — admin AI 사용량 reset mutation.
 * onSuccess → /me/ai-quotas + note-summary-status invalidate (사용자 chip 즉시 갱신)
 */
export function useResetAiQuota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: ResetAiQuotaDto) => quotaResetApi.reset(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'ai-quotas'] })
      qc.invalidateQueries({ queryKey: ['note-summary-status'] })
    },
  })
}
