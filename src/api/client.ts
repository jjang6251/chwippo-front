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
      } catch (refreshErr) {
        useAuthStore.getState().clearAuth()
        const msg: string =
          (refreshErr as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ?? ''
        if (msg.includes('정지')) {
          toast.error('계정이 정지된 상태입니다. 문의하기를 통해 확인해 주세요.')
        } else {
          toast.error('로그인이 만료되었습니다.')
        }
        window.location.href = '/'
      }
    }

    return Promise.reject(error)
  },
)
