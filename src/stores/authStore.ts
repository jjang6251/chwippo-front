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
  /**
   * W1 — signup 1 질문 (관심 직군) 답변.
   * NULL → /signup/question redirect / [] → 답변 완료 (건너뛰기) / [...] → 직군 array
   */
  signupJobCategories: string[] | null
  /** W1 — "기타" 직군 자유 입력 (NULL or "") */
  signupOtherText: string | null
  /** W1 — 샘플 카드 전체 dismiss 시각 (NULL → 샘플 살아있음) */
  sampleCardsDismissedAt: string | null
  /** 캘린더 UX 재구성 — "이제 캘린더가 홈이에요" 안내 배너 dismiss 시각 (NULL → 첫 방문 배너 노출) */
  calendarHomeIntroDismissedAt: string | null
  /** 알림 — soft-ask 모달 표시 시각 (NULL → native 최초 1회 모달) */
  alarmPromptedAt: string | null
  /** 로그인 방식 파생 필드 — /auth/me 에서 내려줌 (배포 순서 무관 optional) */
  loginProviders?: ('kakao' | 'apple')[]
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
