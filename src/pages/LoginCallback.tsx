import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'

export function LoginCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setAccessToken } = useAuthStore()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const accessToken = params.get('access_token')
    const isNew = params.get('is_new') === 'true'

    if (!accessToken) {
      toast.error('로그인에 실패했습니다. 다시 시도해주세요.')
      navigate('/login', { replace: true })
      return
    }

    setAccessToken(accessToken)

    // isNew면 추후 온보딩 페이지로 분기 (MVP 2차), 지금은 dashboard로
    navigate('/dashboard', { replace: true })
    if (isNew) {
      toast.show('취뽀에 오신 것을 환영해요! 첫 지원 카드를 추가해보세요.')
    }
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
