import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

export function AuthGuard() {
  const { accessToken, setAccessToken, setUser, clearAuth } = useAuthStore()
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
  return <Outlet />
}
