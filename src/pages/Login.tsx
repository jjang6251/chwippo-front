import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function Login() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const navigate = useNavigate()

  useEffect(() => {
    if (accessToken) navigate('/dashboard', { replace: true })
  }, [accessToken, navigate])

  const handleKakaoLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/kakao`
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* 로고 */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl font-bold text-text-primary tracking-tight">취뽀</div>
          <p className="text-text-tertiary text-sm text-center leading-relaxed">
            취업 준비의 모든 것을<br />한 곳에서 관리하세요
          </p>
        </div>

        {/* 카카오 로그인 버튼 */}
        <button
          onClick={handleKakaoLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#F0D800] text-[#191919] font-semibold text-sm rounded-xl py-3.5 transition-colors"
        >
          <KakaoIcon />
          카카오 계정으로 로그인
        </button>

        <p className="text-text-tertiary text-xs text-center">
          로그인 시{' '}
          <a href="/terms" className="underline hover:text-text-secondary">이용약관</a>
          {' '}및{' '}
          <a href="/privacy" className="underline hover:text-text-secondary">개인정보처리방침</a>
          에 동의한 것으로 간주됩니다.
        </p>
      </div>
    </div>
  )
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 0C4.029 0 0 3.168 0 7.08c0 2.52 1.611 4.734 4.05 6.003L3.06 17.1a.36.36 0 0 0 .54.378L8.37 14.1A10.43 10.43 0 0 0 9 14.16c4.971 0 9-3.168 9-7.08S13.971 0 9 0Z"
        fill="#191919"
      />
    </svg>
  )
}
