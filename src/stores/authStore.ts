import { create } from 'zustand'

interface User {
  id: string
  nickname: string
  email: string | null
  role: 'user' | 'admin'
  onboardedAt: string | null
  termsAgreedAt: string | null
  aiConsentAt: string | null
  aiConsentVersion: string | null
  /** PR_B1b — 코인 시스템 onboarding modal 표시 여부. NULL → 첫 로그인 modal 노출 */
  onboardedCoinAt: string | null
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
  accessToken: null,
  setUser: (user) => set({ user }),
  setAccessToken: (token) => set({ accessToken: token }),
  clearAuth: () => set({ user: null, accessToken: null }),
}))
