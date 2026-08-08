import { useCallback } from 'react'
import { useDemoMode } from '@/contexts/demoMode'
import { useDemoSignupStore } from '@/stores/demoSignupStore'
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
  const isDemo = useDemoMode()
  const showSignup = useDemoSignupStore((s) => s.show)

  return useCallback(async (): Promise<boolean> => {
    /**
     * 🔴 **데모는 로그인이 없어 여기서 조용히 멈췄다** (2026-08-09 실기 발견).
     * `AI 도움`·`다시 생성` 을 눌러도 **아무 일도 안 일어났다** — 이 게이트가 AI 호출
     * **앞에** 있어서 demoAdapter 의 차단 로직까지 가지도 못했기 때문이다.
     * 꼬리질문만 모달이 떴는데, 그건 이 게이트를 안 거치는 유일한 경로였다.
     *
     * 데모에서는 동의를 물을 게 아니라 **가입을 권해야** 한다. 차단 지점이 어디든
     * 사용자에겐 같은 안내가 보여야 한다.
     */
    if (isDemo) {
      showSignup()
      return false
    }
    if (!user) return false
    const consented =
      !!user.aiConsentAt &&
      user.aiConsentVersion === CURRENT_AI_CONSENT_VERSION
    if (consented) return true
    return requestModal()
  }, [user, requestModal, isDemo, showSignup])
}
