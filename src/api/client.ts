import axios from 'axios'
import { toast } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        // 응답 구조: { data: { accessToken }, message }
        const accessToken: string = data.data?.accessToken ?? data.accessToken
        useAuthStore.getState().setAccessToken(accessToken)
        original.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(original)
      } catch {
        useAuthStore.getState().clearAuth()
        toast.error('로그인이 만료되었습니다.')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)
