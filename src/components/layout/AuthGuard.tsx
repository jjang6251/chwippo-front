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
  }, [])

  if (checking) return null
  if (!accessToken) return <Navigate to="/login" replace />
  return <Outlet />
}
