import { create } from 'zustand'

interface DemoSignupState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useDemoSignupStore = create<DemoSignupState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
