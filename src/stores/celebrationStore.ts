import { create } from 'zustand'
import { toLocalDateString } from '@/utils/datetime'

/** A5 — 첫 카드 생성 보상 연출 데이터 (계정당 1회, 판정은 utils/firstCardCelebration) */
export interface FirstCardCelebrationData {
  appId: string
  companyName: string
  /** IN_PROGRESS 생성 → 전형 단계 템플릿 실제 생성됨 */
  hadTemplate: boolean
  /** 마감일 입력 → 첫 스텝 날짜 저장 (D-day·캘린더 소스). 없으면 null */
  deadline: string | null
  /** 지원 예정(PLANNED) 생성 — 스텝·D-day·캘린더 미발생 */
  planned: boolean
}

interface CelebrationState {
  companyName: string | null
  celebrate: (companyName: string) => void
  dismiss: () => void
  /** A5 — 첫 카드 연출 (합격 연출과 독립 슬롯) */
  firstCard: FirstCardCelebrationData | null
  showFirstCard: (data: FirstCardCelebrationData) => void
  dismissFirstCard: () => void
}

export const useCelebrationStore = create<CelebrationState>((set) => ({
  companyName: null,
  celebrate: (companyName) => set({ companyName }),
  dismiss: () => set({ companyName: null }),
  firstCard: null,
  showFirstCard: (data) => set({ firstCard: data }),
  dismissFirstCard: () => set({ firstCard: null }),
}))

// 컴포넌트 밖(뮤테이션 onSuccess 등)에서 호출 가능
export const celebrate = (companyName: string) =>
  useCelebrationStore.getState().celebrate(companyName)

export const showFirstCardCelebration = (data: FirstCardCelebrationData) =>
  useCelebrationStore.getState().showFirstCard(data)

// dev 전용 — 1회성 연출이라 실 흐름 재현이 번거로움 (기존 계정은 기회 소진).
// 콘솔에서 __showFirstCardCelebration() 로 시각 검증. 프로덕션 번들엔 미포함.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__showFirstCardCelebration = (
    over: Partial<FirstCardCelebrationData> = {},
  ) =>
    showFirstCardCelebration({
      appId: 'dev-preview',
      companyName: '카카오',
      hadTemplate: true,
      deadline: toLocalDateString(new Date(Date.now() + 14 * 86400_000)),
      planned: false,
      ...over,
    })
}
