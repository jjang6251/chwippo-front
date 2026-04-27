import { create } from 'zustand'

interface User {
  id: string
  nickname: string
  email: string | null
  role: 'user' | 'admin'
}

interface AuthState {
  user: User | null
  accessToken: string | null
  setUser: (user: User | null) => void
  setAccessToken: (token: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  setUser: (user) => set({ user }),
  setAccessToken: (token) => {
    if (token) localStorage.setItem('access_token', token)
    else localStorage.removeItem('access_token')
    set({ accessToken: token })
  },
  clearAuth: () => {
    localStorage.removeItem('access_token')
    set({ user: null, accessToken: null })
  },
}))
