import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import { parseNeedsTerms } from '@/utils/authRouting'

export function LoginCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setAccessToken, setUser } = useAuthStore()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const accessToken = params.get('access_token')
    const needsTerms = parseNeedsTerms(params.get('needs_terms'))

    if (!accessToken) {
      toast.error('로그인에 실패했습니다. 다시 시도해주세요.')
      navigate('/login', { replace: true })
      return
    }

    setAccessToken(accessToken)

    const userId = params.get('user_id')
    const userNickname = params.get('user_nickname')
    const userRole = params.get('user_role') as 'user' | 'admin'
    const userEmail = params.get('user_email')
    const userTermsAgreedAt = params.get('user_terms_agreed_at')
    const userOnboardedAt = params.get('user_onboarded_at')
    if (userId && userNickname && userRole) {
      setUser({ id: userId, nickname: userNickname, email: userEmail, role: userRole, termsAgreedAt: userTermsAgreedAt, onboardedAt: userOnboardedAt })
    }

    if (needsTerms) {
      navigate('/terms-agreement', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
    // setUser는 zustand setter라 stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, navigate, setAccessToken])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-text-tertiary text-sm">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        로그인 중...
      </div>
    </div>
  )
}
