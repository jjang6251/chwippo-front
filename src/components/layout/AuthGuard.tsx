import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

export function AuthGuard() {
  const { accessToken, setAccessToken, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(!accessToken)

  useEffect(() => {
    if (accessToken) return

    axios
      .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        const token = data.data?.accessToken ?? data.accessToken
        setAccessToken(token)
      })
      .catch(() => clearAuth())
      .finally(() => setChecking(false))
  }, [])

  if (checking) return null
  if (!accessToken) return <Navigate to="/login" replace />
  return <Outlet />
}
