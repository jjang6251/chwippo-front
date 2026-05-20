import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { performRefresh } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { resolvePostLoginDestination } from '@/utils/authRouting'

export function AuthGuard() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const [checking, setChecking] = useState(!accessToken)
  const [rateLimited, setRateLimited] = useState(false)

  useEffect(() => {
    if (accessToken) return

    // performRefresh single-flight queue 사용 — dev StrictMode double-fire/멀티 caller 시
    // 동일 promise 공유로 HTTP 1회만 호출. PR C rotation race 방지 (hotfix-auth-refresh-race).
    // user·accessToken은 queue 내부에서 store에 반영됨.
    // 실패 시 handleAuthFailure가 분기 처리(429=세션 유지/토스트만, 401=clearAuth+redirect)
    // 하므로 caller catch는 unhandled rejection 방지용 no-op.
    performRefresh()
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response
          ?.status
        // 429는 세션 유효 — 랜딩 redirect 대신 현재 URL 유지하며 재시도 안내
        if (status === 429) setRateLimited(true)
      })
      .finally(() => setChecking(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checking) return null
  if (rateLimited) {
    return (
      <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center px-4">
        <div
          role="alert"
          className="w-full max-w-sm bg-card border border-line rounded-xl px-6 py-8 text-center"
        >
          <h2 className="text-base font-semibold mb-2">
            많은 새로고침 요청에 잠시 제한되었습니다
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-6">
            60초 뒤에 다시 시도해 주세요. 세션은 그대로 유지됩니다.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-brand hover:bg-accent text-text-primary text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }
  if (!accessToken) return <Navigate to="/" replace />
  // /terms-agreement 자체는 제외 — 리다이렉트 루프 방지
  if (user && location.pathname !== '/terms-agreement') {
    const dest = resolvePostLoginDestination(user.termsAgreedAt)
    if (dest === '/terms-agreement') return <Navigate to="/terms-agreement" replace />
  }
  return <Outlet />
}
