import { create } from 'zustand'

/**
 * 회사 조사 스트립 — **어느 카드 얘기인지 · 왜 떴는지**만 들고 있다.
 *
 * 트리거는 둘이다: **카드 추가**(`AddCardModal`) · **보드 진입 1회**(`Board`, 기존 사용자용).
 * 노출 기회의 소진 여부는 여기가 아니라 localStorage 가 기억한다(`utils/researchIntro`) —
 * 세션 스토어에 두면 새로고침마다 되살아나 매번 뜬다.
 *
 * 규칙:
 * - 🔴 **한 번에 하나.** 새로 추가하면 대상이 그쪽으로 교체된다 (목록에 쌓이지 않는다).
 * - **닫기 가능.** 보드 상단 자리를 차지하므로 조용히 치울 수단은 준다(`dismiss`).
 * - 🔴 **세션성.** persist 를 붙이지 않는다. 새로고침하면 사라지는 게 맞다 — 다음 방문에
 *   되살아나면 "방금" 이라는 전제가 거짓이 된다.
 *
 * zustand 를 쓰는 이유: 트리거가 `AddCardModal` 의 mutation onSuccess 이고 소비처는
 * `Board` 상단이라 부모가 다르다. `celebrationStore` 가 같은 이유로 쓰이는 패턴.
 * (별도 store 인 이유 — 저쪽은 전역 오버레이 슬롯 모음이고 이건 보드 안 스트립이다.)
 */
/**
 * **왜 떴는가.** 자리(`strip`/`celebration`)와 다른 축이다 — 둘 다 스트립이지만
 * `intro` 는 3주 전 카드에 갑자기 뜨는 것이라 **한 줄 안내**가 붙고 계측 이름도 갈린다.
 */
export type RevealOrigin = 'add' | 'intro'

interface ResearchRevealState {
  /** 스트립을 띄울 application id. 없으면 스트립 자체가 없다 */
  appId: string | null
  origin: RevealOrigin
  reveal: (appId: string, origin?: RevealOrigin) => void
  dismiss: () => void
}

export const useResearchRevealStore = create<ResearchRevealState>((set) => ({
  appId: null,
  origin: 'add',
  reveal: (appId, origin = 'add') => set({ appId, origin }),
  dismiss: () => set({ appId: null }),
}))

/** 컴포넌트 밖(뮤테이션 onSuccess)에서 호출 */
export const revealCardResearch = (appId: string) =>
  useResearchRevealStore.getState().reveal(appId)
