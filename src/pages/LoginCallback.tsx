import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import { parseNeedsTerms } from '@/utils/authRouting'
import { parseHashParams } from '@/utils/parseHashParams'

export function LoginCallback() {
  const navigate = useNavigate()
  const { setAccessToken, setUser } = useAuthStore()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    // Fragment(#)로 토큰 수신 — server access log·Referer 노출 차단
    const params = parseHashParams(window.location.hash)
    // fragment 즉시 제거 (history에서 token 깔끔하게 정리)
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    const accessToken = params.access_token
    const needsTerms = parseNeedsTerms(params.needs_terms ?? null)

    if (!accessToken) {
      toast.error('로그인에 실패했습니다. 다시 시도해주세요.')
      navigate('/login', { replace: true })
      return
    }

    setAccessToken(accessToken)

    const userId = params.user_id
    const userNickname = params.user_nickname
    const userRole = params.user_role as 'user' | 'admin' | undefined
    const userEmail = params.user_email ?? null
    const userTermsAgreedAt = params.user_terms_agreed_at ?? null
    const userOnboardedAt = params.user_onboarded_at ?? null
    if (userId && userNickname && userRole) {
      // aiConsentAt/Version + onboardedCoinAt + signup* + sampleCardsDismissedAt 은 kakao callback URL 에 포함 안 됨
      // → 첫 /auth/refresh 응답에서 채워짐. 일단 null 로 init
      setUser({
        id: userId,
        nickname: userNickname,
        email: userEmail,
        role: userRole,
        termsAgreedAt: userTermsAgreedAt,
        onboardedAt: userOnboardedAt,
        aiConsentAt: null,
        aiConsentVersion: null,
        onboardedCoinAt: null,
        signupJobCategories: null,
        signupOtherText: null,
        signupSeriesId: null,
        signupJobTitle: null,
        sampleCardsDismissedAt: null,
        calendarHomeIntroDismissedAt: null,
        alarmPromptedAt: null,
      })
    }

    // W1 — 신규 user (onboardedAt null) → /signup/question redirect.
    // 약관 동의 미완 → 약관 우선. signup 답변 완료 → 캘린더 UX 재구성 → /calendar 로그인 후 홈
    if (needsTerms) {
      navigate('/terms-agreement', { replace: true })
    } else if (!userOnboardedAt) {
      navigate('/signup/question', { replace: true })
    } else {
      // 캘린더 UX 재구성 — 홈 = /calendar (대시보드는 "회고" 페이지로 강등)
      navigate('/calendar', { replace: true })
    }
    // setUser는 zustand setter라 stable / window.location.hash는 마운트 1회만 읽음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, setAccessToken])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-text-tertiary text-sm">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        로그인 중...
      </div>
    </div>
  )
}
