import { create } from 'zustand'

interface TourState {
  active: boolean
  step: number
  newCardId: string | null
  start: () => void
  stop: () => void
  next: () => void
  prev: () => void
  onCardCreated: (cardId: string) => void
}

export const useTourStore = create<TourState>((set) => ({
  active: false,
  step: 1,
  newCardId: null,
  start: () => set({ active: true, step: 1, newCardId: null }),
  stop: () => set({ active: false, step: 1, newCardId: null }),
  next: () => set((s) => ({ step: Math.min(s.step + 1, 14) })),
  prev: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
  onCardCreated: (cardId) => set({ newCardId: cardId, step: 5 }),
}))
