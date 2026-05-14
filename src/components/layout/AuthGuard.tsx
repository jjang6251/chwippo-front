import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { resolvePostLoginDestination } from '@/utils/authRouting'

export function AuthGuard() {
  const { accessToken, setAccessToken, setUser, clearAuth } = useAuthStore()
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const [checking, setChecking] = useState(!accessToken)

  useEffect(() => {
    if (accessToken) return

    axios
      .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        const payload = data.data ?? data
        setAccessToken(payload.accessToken)
        if (payload.user) setUser(payload.user)
      })
      .catch(() => clearAuth())
      .finally(() => setChecking(false))
    // 마운트 시 1회만 refresh 시도. zustand setter들은 stable이라 deps에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checking) return null
  if (!accessToken) return <Navigate to="/" replace />
  // /terms-agreement 자체는 제외 — 리다이렉트 루프 방지
  if (user && location.pathname !== '/terms-agreement') {
    const dest = resolvePostLoginDestination(user.termsAgreedAt)
    if (dest === '/terms-agreement') return <Navigate to="/terms-agreement" replace />
  }
  return <Outlet />
}
