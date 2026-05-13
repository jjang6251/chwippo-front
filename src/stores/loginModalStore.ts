import { create } from 'zustand'

interface LoginModalState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useLoginModalStore = create<LoginModalState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
