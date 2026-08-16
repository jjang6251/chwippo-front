import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { REFRESH_HTTP_TIMEOUT_MS } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'

export function Login() {
  const { accessToken, setAccessToken } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSuspended = searchParams.get('error') === 'suspended'

  useEffect(() => {
    if (accessToken) { navigate('/calendar', { replace: true }); return }
    if (isSuspended) return
    // 유효한 refresh 쿠키가 있으면 자동 리다이렉트
    // 🔴 랜딩과 같은 이유로 performRefresh 를 쓰지 않는다 (Landing.tsx 주석 참조) —
    // 로그인 화면에서의 401 은 비로그인 방문자의 정상 상태다. 시간 상한만 맞춘다.
    axios
      .post(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: REFRESH_HTTP_TIMEOUT_MS },
      )
      .then(({ data }) => {
        const token = data.data?.accessToken ?? data.accessToken
        setAccessToken(token)
        navigate('/calendar', { replace: true })
      })
      .catch(() => { /* refresh 실패는 무시 — 로그인 화면 유지 */ })
    // 마운트 시 1회만 자동 로그인 체크
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKakaoLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/kakao`
  }

  const handleAppleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/apple`
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* 정지 안내 */}
        {isSuspended && (
          <div role="alert" className="w-full bg-danger/10 border border-danger/25 rounded-xl px-4 py-3.5 text-center">
            <p className="text-sm font-semibold text-danger mb-1">계정이 정지되었습니다</p>
            <p className="text-xs text-danger leading-relaxed">
              운영 정책 위반으로 계정이 제한되었습니다.<br />
              문의:{' '}
              <a
                href="mailto:support@chwippo.com"
                className="underline hover:text-danger"
              >
                support@chwippo.com
              </a>
            </p>
          </div>
        )}

        {/* 로고 */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl font-bold text-text-primary tracking-tight">치뽀</div>
          <p className="text-text-tertiary text-sm text-center leading-relaxed">
            취업 준비의 모든 것을<br />한 곳에서 관리하세요
          </p>
        </div>

        {/* 소셜 로그인 버튼 */}
        <div className="w-full flex flex-col gap-3">
          {/* 카카오 로그인 버튼 */}
          <button
            onClick={handleKakaoLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#F0D800] text-[#191919] font-semibold text-sm rounded-xl py-3.5 transition-colors"
          >
            <KakaoIcon />
            카카오 계정으로 로그인
          </button>

          {/* Apple 로그인 버튼 */}
          <button
            onClick={handleAppleLogin}
            className="w-full flex items-center justify-center gap-3 bg-black hover:bg-[#1a1a1a] text-white border border-line font-semibold text-sm rounded-xl py-3.5 transition-colors"
          >
            <AppleIcon />
            Apple로 계속하기
          </button>
        </div>

        {/* 로그인 없이 둘러보기 — 랜딩과 동일한 데모 진입(/demo → /demo/calendar) */}
        <Link
          to="/demo"
          className="text-sm font-medium text-text-tertiary hover:text-text-primary px-3 py-2.5 rounded-lg transition-colors"
        >
          로그인 없이 둘러보기 →
        </Link>

        <p className="text-text-tertiary text-xs text-center">
          로그인 시{' '}
          <Link to="/terms" className="underline hover:text-text-secondary">이용약관</Link>
          {' '}및{' '}
          <Link to="/privacy" className="underline hover:text-text-secondary">개인정보처리방침</Link>
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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
    </svg>
  )
}
