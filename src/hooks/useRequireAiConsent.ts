import { useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useAiConsentStore } from '@/stores/aiConsentStore'
import { CURRENT_AI_CONSENT_VERSION } from '@/api/users'

/**
 * AI feature 호출 직전 consent gate.
 *
 * `await ensure()` — 동의 OK 면 true 즉시. 동의 안 됐으면 전역 모달 띄우고
 * 사용자가 [동의하고 계속] / [취소] 누를 때까지 대기.
 *
 * - 사용자가 [동의] → POST /users/me/ai-consent → authStore.user 갱신 → resolve(true)
 * - 사용자가 [취소] → resolve(false) — caller 는 silent return (토스트 X)
 */
export function useRequireAiConsent() {
  const user = useAuthStore((s) => s.user)
  const requestModal = useAiConsentStore((s) => s.request)

  return useCallback(async (): Promise<boolean> => {
    if (!user) return false
    const consented =
      !!user.aiConsentAt &&
      user.aiConsentVersion === CURRENT_AI_CONSENT_VERSION
    if (consented) return true
    return requestModal()
  }, [user, requestModal])
}
