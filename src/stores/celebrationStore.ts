import { create } from 'zustand'

interface CelebrationState {
  companyName: string | null
  celebrate: (companyName: string) => void
  dismiss: () => void
}

export const useCelebrationStore = create<CelebrationState>((set) => ({
  companyName: null,
  celebrate: (companyName) => set({ companyName }),
  dismiss: () => set({ companyName: null }),
}))

// 컴포넌트 밖(뮤테이션 onSuccess 등)에서 호출 가능
export const celebrate = (companyName: string) =>
  useCelebrationStore.getState().celebrate(companyName)
