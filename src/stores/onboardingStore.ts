import { create } from 'zustand'

interface OnboardingState {
  show: boolean
  open: () => void
  close: () => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  show: false,
  open: () => set({ show: true }),
  close: () => set({ show: false }),
}))
